import { mcpHandler } from '@/lib/mcp-handler-simple';
import type { NextRequest } from 'next/server';

async function handler(req: NextRequest) {
  console.log(`MCP HTTP Request: ${req.method} /http`);
  return mcpHandler(req);
}

export { handler as GET, handler as POST, handler as DELETE };
