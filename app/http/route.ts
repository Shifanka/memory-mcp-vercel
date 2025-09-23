import { mcpHandler } from '@/lib/mcp-handler-simple';

async function handler(req: Request) {
  return mcpHandler(req);
}

export { handler as GET, handler as POST, handler as DELETE };
