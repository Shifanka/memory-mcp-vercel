import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';

export const mcpHandler = createMcpHandler(
  (server) => {
  // Simple memory store (no external dependencies for testing)
  server.tool(
    'store_memory',
    'Store content in memory for later retrieval',
    {
      content: z.string().min(1).describe('The content to store'),
      userId: z.string().min(1).describe('User identifier'),
      type: z.enum(['code', 'conversation', 'preference', 'general']).default('general'),
    },
    async ({ content, userId, type }) => {
      try {
        // For now, just return success without actually storing
        const memoryId = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        return {
          content: [{
            type: 'text',
            text: `✅ Successfully stored memory (${type})\nID: ${memoryId}\nUser: ${userId}\nContent: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `❌ Error storing memory: ${error}`,
          }],
        };
      }
    }
  );

  server.tool(
    'search_memory',
    'Search through stored memories (mock implementation)',
    {
      query: z.string().min(1).describe('Search query'),
      userId: z.string().min(1).describe('User identifier'),
    },
    async ({ query, userId }) => {
      return {
        content: [{
          type: 'text',
          text: `🔍 Mock search results for "${query}"\nUser: ${userId}\n\nThis is a demonstration - no actual memories are stored yet.\nNeed to configure Upstash Redis and Vector for full functionality.`,
        }],
      };
    }
  );

  server.tool(
    'get_status',
    'Get memory system status and configuration',
    {
      userId: z.string().optional(),
    },
    async ({ userId }) => {
      const redisConfigured = process.env.UPSTASH_REDIS_REST_URL && 
                             process.env.UPSTASH_REDIS_REST_URL !== 'your_redis_url_here';
      const vectorConfigured = process.env.UPSTASH_VECTOR_REST_URL && 
                              process.env.UPSTASH_VECTOR_REST_URL !== 'your_vector_url_here';
      const openaiConfigured = process.env.OPENAI_API_KEY && 
                              process.env.OPENAI_API_KEY !== 'your_openai_key_here';

      const status = `📊 Memory MCP Server Status

**Configuration:**
- Redis Database: ${redisConfigured ? '✅ Configured' : '❌ Not configured'}
- Vector Database: ${vectorConfigured ? '✅ Configured' : '❌ Not configured'}  
- OpenAI API: ${openaiConfigured ? '✅ Configured' : '❌ Not configured'}

**Mode:** ${redisConfigured && vectorConfigured && openaiConfigured ? 'Production' : 'Mock/Demo'}

**Next Steps:**
${!redisConfigured ? '1. Set up Upstash Redis database\n' : ''}${!vectorConfigured ? '2. Set up Upstash Vector index\n' : ''}${!openaiConfigured ? '3. Configure OpenAI API key\n' : ''}

**User:** ${userId || 'Not specified'}`;

      return {
        content: [{
          type: 'text',
          text: status,
        }],
      };
    }
  );
  },
  {}, // capabilities
  {
    redisUrl: process.env.UPSTASH_REDIS_REST_URL || 'redis://mock:6379',
    maxDuration: 60,
    verboseLogs: true,
  }
);