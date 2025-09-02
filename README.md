# Memory MCP Server

Semantic memory server for AI agents powered by Upstash Redis and Vector.

## Features

- 🧠 **Persistent Memory**: Store conversations, code, preferences, and general knowledge
- 🔍 **Semantic Search**: Find relevant memories using AI-powered similarity search
- ⚡ **Fast Retrieval**: Redis-powered caching and indexing
- 🎯 **Contextual Awareness**: Automatically surface relevant context for conversations
- 📱 **iOS Compatible**: Works with Claude app on iOS via remote MCP connection

## Architecture

- **Upstash Redis**: Stores structured memory data with fast key-value access
- **Upstash Vector**: Handles semantic search with 1536-dimensional embeddings
- **OpenAI Embeddings**: Generates vector representations using text-embedding-3-small
- **Next.js + Vercel**: Serverless deployment with edge optimization

## Environment Variables

```bash
# Upstash Redis
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token

# Upstash Vector  
UPSTASH_VECTOR_REST_URL=your_vector_url
UPSTASH_VECTOR_REST_TOKEN=your_vector_token

# OpenAI API
OPENAI_API_KEY=your_openai_key
```

## MCP Tools

### `store_memory`
Store content in persistent memory with automatic semantic indexing.

### `search_memory` 
Search memories using semantic similarity, not just keywords.

### `get_context`
Retrieve contextual memory for current conversation including recent interactions and related content.

### `list_memories`
List stored memories with filtering by type and statistics.

### `delete_memory`
Delete specific memories by ID with ownership verification.

## Claude Desktop Configuration

Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "memory": {
      "transport": "sse",
      "url": "https://your-vercel-app.vercel.app/sse"
    }
  }
}
```

## Deployment

1. Create Upstash Redis and Vector databases
2. Set environment variables in Vercel
3. Deploy to Vercel
4. Configure Claude Desktop with the SSE endpoint

## Local Development

```bash
npm install
npm run dev
```

Access at `http://localhost:3000`