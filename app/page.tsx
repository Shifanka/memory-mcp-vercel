export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Memory MCP Server</h1>
        <div className="space-y-4">
          <p className="text-gray-600">
            Semantic memory server for AI agents powered by Upstash Redis and Vector.
          </p>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <h2 className="text-lg font-semibold mb-2">Available Tools</h2>
            <ul className="space-y-2 text-sm">
              <li><strong>store_memory</strong> - Store content with semantic indexing</li>
              <li><strong>search_memory</strong> - Search memories using semantic similarity</li>
              <li><strong>get_context</strong> - Retrieve contextual memory for conversations</li>
              <li><strong>list_memories</strong> - List stored memories with filtering</li>
              <li><strong>delete_memory</strong> - Delete specific memories</li>
            </ul>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <h2 className="text-lg font-semibold mb-2">MCP Connection</h2>
            <p className="text-sm text-gray-700">
              Connect from Claude Desktop using SSE transport:
            </p>
            <code className="block mt-2 p-2 bg-white rounded text-xs">
              {`{
  "mcpServers": {
    "memory": {
      "transport": "sse",
      "url": "${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/sse"
    }
  }
}`}
            </code>
          </div>
        </div>
      </div>
    </main>
  );
}