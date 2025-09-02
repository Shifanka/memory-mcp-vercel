import { mcpHandler } from '@/lib/mcp-handler';
import type { NextRequest } from 'next/server';

async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ transport: string }> }
) {
  const { transport } = await params;
  
  // Log request for debugging
  console.log(`MCP Request: ${req.method} /${transport}`);
  
  return mcpHandler(req, { params: { transport } });
}

export { handler as GET, handler as POST, handler as DELETE };