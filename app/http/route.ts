// app/http/route.ts
import { mcpHandler } from '@/lib/mcp-handler-simple';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';

// ——— CORS helpers ———
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
};

function withCors(resp: Response) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => resp.headers.set(k, v));
  return resp;
}

export async function OPTIONS() {
  return withCors(new Response(null, { status: 204 }));
}

// ——— Main handler ———
async function handler(req: NextRequest) {
  // małe logi do Vercel → Runtime Logs
  console.log(`MCP HTTP Request: ${req.method} /http`);
  const resp = await mcpHandler(req); // ten sam handler co w [[transport]]
  return withCors(resp as Response);
}

export { handler as GET, handler as POST, handler as DELETE };
