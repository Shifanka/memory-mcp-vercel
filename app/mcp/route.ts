// app/mcp/route.ts — prawdziwy MCP via Streamable HTTP (JSON-RPC POST), bez mocków
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const OAI_KEY  = process.env.OPENAI_API_KEY!;
const VEC_URL  = process.env.UPSTASH_VECTOR_REST_URL!;
const VEC_TOK  = process.env.UPSTASH_VECTOR_REST_TOKEN!;
const R_URL    = process.env.UPSTASH_REDIS_REST_URL || '';
const R_TOK    = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const MODEL    = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
const DIM      = Number(process.env.EMBEDDING_DIM || 1536);

export const runtime = 'nodejs';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, Mcp-Session-Id',
    'Content-Type': 'application/json; charset=utf-8',
  };
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

async function embed(texts: string[]) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, input: texts, dimensions: DIM }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`OpenAI: ${res.status} ${JSON.stringify(j)}`);
  return j.data.map((d: any) => d.embedding as number[]);
}

async function vecUpsert(items: { id: string; vector: number[]; metadata?: any }[]) {
  const res = await fetch(`${VEC_URL}/vectors`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${VEC_TOK}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ vectors: items }),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`Vector upsert ${res.status}: ${txt}`);
  try { return JSON.parse(txt); } catch { return {}; }
}

async function vecQuery(vector: number[], topK = 10) {
  const res = await fetch(`${VEC_URL}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${VEC_TOK}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ vector, topK }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`Vector query ${res.status}: ${JSON.stringify(j)}`);
  return j;
}

async function redisBatch(commands: any[][]) {
  if (!R_URL || !R_TOK) return null;
  const res = await fetch(R_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${R_TOK}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ commands }),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`Redis ${res.status}: ${txt}`);
  return JSON.parse(txt);
}

function respond(id: any, result?: any, error?: { code: number; message: string }) {
  return new NextResponse(
    JSON.stringify(error ? { jsonrpc: '2.0', id, error } : { jsonrpc: '2.0', id, result }),
    { status: error ? 400 : 200, headers: corsHeaders() },
  );
}

export async function POST(req: NextRequest) {
  let msg: any;
  try {
    msg = await req.json();
  } catch {
    return respond(null, undefined, { code: -32700, message: 'Parse error' });
  }

  if (!msg || msg.jsonrpc !== '2.0') {
    return respond(null, undefined, { code: -32600, message: 'Invalid Request' });
  }

  // 🔔 Poprawka: notification = tylko brak pola "id"
  const hasId = Object.prototype.hasOwnProperty.call(msg, 'id');
  if (!hasId) {
    // np. {"jsonrpc":"2.0","method":"notifications/initialized"}
    return new NextResponse(null, { status: 204, headers: corsHeaders() });
  }

  const id = msg.id; // null / string / number → traktujemy jako normalne żądanie

  try {
    switch (msg.method) {
      case 'initialize':
        return respond(id, {
          protocolVersion: '2025-03-26',
          serverInfo: { name: 'upstash-memory-http', version: '1.0.0' },
          capabilities: { tools: {} },
          tools: [
            { name: 'store_memory',   description: 'Store memory',  inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
            { name: 'search_memories',description: 'Vector search', inputSchema: { type: 'object', properties: { query: { type: 'string' }, topK: { type: 'number' } }, required: ['query'] } },
            { name: 'list_memories',  description: 'List (Redis)',  inputSchema: { type: 'object', properties: {}, required: [] } },
            { name: 'delete_memory',  description: 'Delete by id',  inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
          ],
        });

      case 'tools/list':
        return respond(id, { tools: [
          { name: 'store_memory' }, { name: 'search_memories' }, { name: 'list_memories' }, { name: 'delete_memory' }
        ] });

      case 'tools/call': {
        const { name, arguments: args } = msg.params || {};
        if (name === 'store_memory') {
          const text = String(args?.text || '');
          const [vec] = await embed([text]);
          const mid = `mem_${Date.now()}`;
          await vecUpsert([{ id: mid, vector: vec, metadata: { text } }]);
          if (R_URL && R_TOK) {
            await redisBatch([ ['HSET', mid, 'text', text], ['RPUSH', 'mem:list', mid] ]);
          }
          return respond(id, { content: [{ type: 'text', text: JSON.stringify({ id: mid, ok: true }) }] });
        }

        if (name === 'search_memories') {
          const [qv] = await embed([String(args?.query || '')]);
          const out = await vecQuery(qv, Number(args?.topK || 10));
          return respond(id, { content: [{ type: 'text', text: JSON.stringify(out) }] });
        }

        if (name === 'list_memories') {
          if (!R_URL || !R_TOK) return respond(id, { content: [{ type: 'text', text: 'Redis off; list disabled' }] });
          const ids: string[] = (await redisBatch([ ['LRANGE', 'mem:list', '0', '-1'] ]))?.result?.[0] || [];
          if (!ids.length) return respond(id, { content: [{ type: 'text', text: '[]' }] });
          const cmds = ids.map((k) => ['HGET', k, 'text']);
          const vals = (await redisBatch(cmds))?.result || [];
          const list = ids.map((k, i) => ({ id: k, text: vals[i] || '' }));
          return respond(id, { content: [{ type: 'text', text: JSON.stringify(list) }] });
        }

        if (name === 'delete_memory') {
          const did = String(args?.id || '');
          if (R_URL && R_TOK) await redisBatch([ ['LREM', 'mem:list', '0', did], ['DEL', did] ]);
          try {
            await fetch(`${VEC_URL}/vectors/delete`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${VEC_TOK}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids: [did] }),
            });
          } catch {}
          return respond(id, { content: [{ type: 'text', text: JSON.stringify({ id: did, ok: true }) }] });
        }

        return respond(id, undefined, { code: -32601, message: `Unknown tool ${name}` });
      }

      default:
        return respond(id, undefined, { code: -32601, message: `Unknown method ${msg.method}` });
    }
  } catch (e: any) {
    return respond(id, undefined, { code: -32000, message: e?.message || 'Server error' });
  }
}
