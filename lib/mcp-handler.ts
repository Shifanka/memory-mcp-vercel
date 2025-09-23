import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { memoryService } from './memory-service';

export const mcpHandler = createMcpHandler((server) => {
  // Store memory (conversations, code, preferences)
  server.tool(
    'store_memory',
    'Store content in persistent memory with semantic search capabilities. Supports code snippets, conversations, preferences, and general knowledge.',
    {
      content: z.string().min(1).describe('The content to store in memory'),
      type: z.enum(['code', 'conversation', 'preference', 'general']).default('general').describe('Type of content being stored'),
      userId: z.string().min(1).describe('User identifier for memory ownership'),
      sessionId: z.string().optional().describe('Optional session identifier for grouping related memories'),
      language: z.string().optional().describe('Programming language (for code type)'),
      tags: z.array(z.string()).optional().describe('Tags for categorization'),
      title: z.string().optional().describe('Optional title or summary'),
      context: z.string().optional().describe('Additional context or explanation'),
    },
    async ({ content, type, userId, sessionId, language, tags, title, context }) => {
      try {
        const memoryId = await memoryService.storeMemory(userId, content, {
          type,
          sessionId,
          metadata: {
            language,
            tags,
            title,
            context,
          },
        });

        return {
          content: [{
            type: 'text',
            text: `Successfully stored memory with ID: ${memoryId}\nType: ${type}\nContent length: ${content.length} characters`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error storing memory: ${error}`,
          }],
        };
      }
    }
  );

  // Search memories with semantic similarity
  server.tool(
    'search_memory',
    'Search through stored memories using semantic similarity. Returns relevant memories based on content meaning, not just keywords.',
    {
      query: z.string().min(1).describe('Search query to find relevant memories'),
      userId: z.string().min(1).describe('User identifier to search within user\'s memories'),
      type: z.enum(['code', 'conversation', 'preference', 'general']).optional().describe('Filter by memory type'),
      limit: z.number().min(1).max(50).default(10).describe('Maximum number of results to return'),
      minScore: z.number().min(0).max(1).default(0.7).describe('Minimum similarity score (0-1)'),
    },
    async ({ query, userId, type, limit, minScore }) => {
      try {
        const results = await memoryService.searchMemories(userId, query, {
          type,
          limit,
          minScore,
        });

        if (results.length === 0) {
          return {
            content: [{
              type: 'text',
              text: `No memories found for query: "${query}"`,
            }],
          };
        }

        const formattedResults = results.map(result => 
          `**Memory ID**: ${result.memory.id}\n` +
          `**Type**: ${result.memory.type}\n` +
          '**Similarity**: ${((result.similarity || 0) * 100).toFixed(1)}%\n' +
          `**Content**: ${result.memory.content.substring(0, 200)}${result.memory.content.length > 200 ? '...' : ''}\n` +
          `**Tags**: ${result.memory.metadata.tags?.join(', ') || 'None'}\n` +
          `**Created**: ${new Date(result.memory.metadata.timestamp).toLocaleString()}\n`
        ).join('\n---\n');

        return {
          content: [{
            type: 'text',
            text: `Found ${results.length} relevant memories for "${query}":\n\n${formattedResults}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error searching memories: ${error}`,
          }],
        };
      }
    }
  );

  // Get contextual memory for current conversation
  server.tool(
    'get_context',
    'Retrieve contextual memory including recent interactions and related content for the current conversation.',
    {
      userId: z.string().min(1).describe('User identifier'),
      currentQuery: z.string().min(1).describe('Current conversation query or context'),
      sessionId: z.string().optional().describe('Current session identifier'),
    },
    async ({ userId, currentQuery, sessionId }) => {
      try {
        const context = await memoryService.getContextualMemory(userId, currentQuery, sessionId);

        const recentSection = context.recent.length > 0
          ? `**Recent Memories** (${context.recent.length}):\n` +
            context.recent.map(m => 
              `- [${m.type}] ${m.content.substring(0, 100)}${m.content.length > 100 ? '...' : ''}`
            ).join('\n')
          : 'No recent memories found.';

        const relatedSection = context.related.length > 0
          ? `\n\n**Related Memories** (${context.related.length}):\n` +
            context.related.map(r => 
              `- [${r.memory.type}] ${((r.similarity || 0) * 100).toFixed(1)}% - ${r.memory.content.substring(0, 100)}${r.memory.content.length > 100 ? '...' : ''}\n`
            ).join('\n')
          : '\n\nNo related memories found.';

        return {
          content: [{
            type: 'text',
            text: `${context.summary}\n\n${recentSection}${relatedSection}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error getting context: ${error}`,
          }],
        };
      }
    }
  );

  // List user memories with filtering
  server.tool(
    'list_memories',
    'List stored memories with optional filtering by type. Shows memory overview and statistics.',
    {
      userId: z.string().min(1).describe('User identifier'),
      type: z.enum(['code', 'conversation', 'preference', 'general']).optional().describe('Filter by memory type'),
      limit: z.number().min(1).max(100).default(20).describe('Maximum number of memories to return'),
      showStats: z.boolean().default(true).describe('Include memory statistics'),
    },
    async ({ userId, type, limit, showStats }) => {
      try {
        const memories = await memoryService.listUserMemories(userId, { type, limit });
        
        let result = '';

        if (showStats) {
          const stats = await memoryService.getMemoryStats(userId);
          result += `**Memory Statistics**\n`;
          result += `Total memories: ${stats.total}\n`;
          result += `Recent activity (24h): ${stats.recentActivity}\n`;
          result += `By type: ${Object.entries(stats.byType).map(([t, c]) => `${t}: ${c}`).join(', ')}\n\n`;
        }

        if (memories.length === 0) {
          result += type 
            ? `No memories found of type: ${type}`
            : 'No memories found for this user.';
        } else {
          result += `**Memories** ${type ? `(${type})` : ''}:\n\n`;
          result += memories.map(memory => 
            `**${memory.id}** [${memory.type}]\n` +
            `${memory.content.substring(0, 150)}${memory.content.length > 150 ? '...' : ''}\n` +
            `Tags: ${memory.metadata.tags?.join(', ') || 'None'} | ` +
            `Created: ${new Date(memory.metadata.timestamp).toLocaleDateString()}\n`
          ).join('\n---\n');
        }

        return {
          content: [{
            type: 'text',
            text: result,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error listing memories: ${error}`,
          }],
        };
      }
    }
  );

  // Delete specific memory
  server.tool(
    'delete_memory',
    'Delete a specific memory by ID. This removes the memory from both Redis storage and vector index.',
    {
      memoryId: z.string().min(1).describe('ID of the memory to delete'),
      userId: z.string().min(1).describe('User identifier for verification'),
    },
    async ({ memoryId, userId }) => {
      try {
        // Verify ownership
        const memory = await memoryService.memoryStore.getMemory(memoryId);
        if (!memory) {
          return {
            content: [{
              type: 'text',
              text: `Memory not found: ${memoryId}`,
            }],
          };
        }

        if (memory.userId !== userId) {
          return {
            content: [{
              type: 'text',
              text: `Access denied: Memory ${memoryId} does not belong to user ${userId}`,
            }],
          };
        }

        const deleted = await memoryService.deleteMemory(memoryId);
        
        return {
          content: [{
            type: 'text',
            text: deleted 
              ? `Successfully deleted memory: ${memoryId}`
              : `Failed to delete memory: ${memoryId}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error deleting memory: ${error}`,
          }],
        };
      }
    }
  );
});
