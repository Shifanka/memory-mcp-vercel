import { MemoryStore } from './memory-store';
import { VectorStore } from './vector-store';
import { Memory, SearchResult, ContextualMemory } from './types';
import crypto from 'crypto';

export class MemoryService {
  private _memoryStore: MemoryStore;
  private _vectorStore: VectorStore;

  constructor() {
    this._memoryStore = new MemoryStore();
    this._vectorStore = new VectorStore();
  }

  async storeMemory(
    userId: string,
    content: string,
    options: {
      type?: Memory['type'];
      sessionId?: string;
      metadata?: Partial<Memory['metadata']>;
    } = {}
  ): Promise<string> {
    const memory: Omit<Memory, 'id'> = {
      userId,
      content,
      type: options.type || 'general',
      sessionId: options.sessionId,
      metadata: {
        timestamp: Date.now(),
        ...options.metadata,
      },
    };

    // Store in Redis
    const memoryId = await this._memoryStore.storeMemory(memory);
    
    // Store vector representation
    const fullMemory: Memory = { ...memory, id: memoryId };
    await this._vectorStore.storeVector(fullMemory);

    return memoryId;
  }

  async searchMemories(
    userId: string,
    query: string,
    options: {
      limit?: number;
      type?: Memory['type'];
      minScore?: number;
      includeRecent?: boolean;
    } = {}
  ): Promise<SearchResult[]> {
    const { limit = 10, type, minScore = 0.7, includeRecent = true } = options;

    // Check semantic cache first
    const queryHash = this.generateQueryHash(query, userId, options);
    const cachedResult = await this._memoryStore.getCachedQuery(queryHash);
    
    if (cachedResult) {
      return JSON.parse(cachedResult);
    }

    // Perform vector search
    const vectorResults = await this._vectorStore.searchSimilar(query, userId, {
      limit,
      type,
      minScore,
    });

    // Enhance with full memory data from Redis
    const enhancedResults: SearchResult[] = [];
    for (const result of vectorResults) {
      const fullMemory = await this._memoryStore.getMemory(result.memory.id);
      if (fullMemory) {
        enhancedResults.push({
          memory: fullMemory,
          score: result.score,
          similarity: result.similarity,
        });
      }
    }

    // Include recent memories if requested
    if (includeRecent && enhancedResults.length < limit) {
      const recentMemories = await this._memoryStore.getRecentMemories(
        userId, 
        limit - enhancedResults.length
      );
      
      for (const recent of recentMemories) {
        // Avoid duplicates
        if (!enhancedResults.some(r => r.memory.id === recent.id)) {
          enhancedResults.push({
            memory: recent,
            score: 0.5, // Lower score for recent but not semantically similar
            similarity: 0.5,
          });
        }
      }
    }

    // Cache the result
    await this._memoryStore.cacheQuery(queryHash, JSON.stringify(enhancedResults), 1800); // 30 min cache

    return enhancedResults.slice(0, limit);
  }

  async getContextualMemory(
    userId: string,
    currentQuery: string,
    sessionId?: string
  ): Promise<ContextualMemory> {
    // Get recent memories
    const recent = await this._memoryStore.getRecentMemories(userId, 5);
    
    // Get semantically related memories
    const related = await this.searchMemories(userId, currentQuery, {
      limit: 10,
      includeRecent: false,
    });

    // Get session context if available
    const sessionMemories = sessionId 
      ? await this._memoryStore.getSessionContext(sessionId)
      : [];

    // Merge and deduplicate
    const allMemories = [...recent, ...sessionMemories];
    const uniqueRecent = allMemories.filter(
      (memory, index, self) => self.findIndex(m => m.id === memory.id) === index
    );

    return {
      recent: uniqueRecent.slice(0, 8),
      related: related.slice(0, 12),
      summary: this.generateContextSummary(uniqueRecent, related),
    };
  }

  async listUserMemories(
    userId: string,
    options: {
      type?: Memory['type'];
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<Memory[]> {
    const { type, limit = 50, offset = 0 } = options;

    if (type) {
      return this._memoryStore.getMemoriesByType(userId, type, limit);
    }

    const allMemories = await this._memoryStore.getUserMemories(userId, limit + offset);
    return allMemories.slice(offset, offset + limit);
  }

  async deleteMemory(memoryId: string): Promise<boolean> {
    // Delete from both stores
    const deleted = await this._memoryStore.deleteMemory(memoryId);
    if (deleted) {
      await this._vectorStore.deleteVector(memoryId);
    }
    return deleted;
  }

  async getMemoryStats(userId: string): Promise<{
    total: number;
    byType: Record<string, number>;
    recentActivity: number;
  }> {
    const vectorStats = await this._vectorStore.getVectorStats(userId);
    const recentMemories = await this._memoryStore.getRecentMemories(userId, 10);
    
    // Count memories from last 24 hours
    const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const recentActivity = recentMemories.filter(
      m => m.metadata.timestamp > dayAgo
    ).length;

    return {
      total: vectorStats.totalVectors,
      byType: vectorStats.byType,
      recentActivity,
    };
  }

  // Expose stores for direct access in MCP tools
  get memoryStore() {
    return this._memoryStore;
  }

  get vectorStore() {
    return this._vectorStore;
  }

  private generateQueryHash(query: string, userId: string, options: any): string {
    const key = `${query}:${userId}:${JSON.stringify(options)}`;
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  private generateContextSummary(recent: Memory[], related: SearchResult[]): string {
    const totalMemories = recent.length + related.length;
    const types = [...new Set([
      ...recent.map(m => m.type),
      ...related.map(r => r.memory.type)
    ])];

    return `Context: ${totalMemories} memories available (${types.join(', ')})`;
  }
}

export const memoryService = new MemoryService();
