import { Index } from '@upstash/vector';
import { Memory, SearchResult, VectorData } from './types';
import { embeddingService } from './embeddings';
import crypto from 'crypto';

export class VectorStore {
  private index: Index | null = null;
  private mockVectors: Map<string, VectorData> = new Map();
  private mockMode: boolean;

  constructor() {
    // Check if real credentials are configured
    const hasCredentials = process.env.UPSTASH_VECTOR_REST_URL && 
                          process.env.UPSTASH_VECTOR_REST_TOKEN &&
                          process.env.UPSTASH_VECTOR_REST_URL !== 'your_vector_url_here';

    this.mockMode = !hasCredentials;

    if (hasCredentials) {
      this.index = new Index({
        url: process.env.UPSTASH_VECTOR_REST_URL!,
        token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
      });
    } else {
      console.log('Running in vector mock mode - Vector credentials not configured');
    }
  }

  async storeVector(memory: Memory): Promise<void> {
    try {
      const embedding = await embeddingService.generateEmbedding(memory.content);
      
      const vectorData: VectorData = {
        id: memory.id,
        vector: embedding,
        metadata: {
          userId: memory.userId,
          type: memory.type,
          timestamp: memory.metadata.timestamp,
          content: memory.content.substring(0, 500), // Truncate for metadata
          language: memory.metadata.language || '',
          tags: memory.metadata.tags?.join(',') || '',
          sessionId: memory.sessionId || '',
          title: memory.metadata.title || '',
        },
      };

      await this.index!.upsert(vectorData);
    } catch (error) {
      console.error('Error storing vector:', error);
      throw new Error(`Failed to store vector: ${error}`);
    }
  }

  async searchSimilar(
    query: string, 
    userId: string, 
    options: {
      limit?: number;
      type?: Memory['type'];
      minScore?: number;
      includeMetadata?: boolean;
    } = {}
  ): Promise<SearchResult[]> {
    const { limit = 10, type, minScore = 0.7, includeMetadata = true } = options;

    try {
      const queryEmbedding = await embeddingService.generateEmbedding(query);
      
      const filter = `userId = "${userId}"` + (type ? ` AND type = "${type}"` : '');
      
      const results = await this.index!.query({
        vector: queryEmbedding,
        topK: limit,
        filter,
        includeMetadata,
      });

      return results
        .filter(result => result.score >= minScore)
        .map(result => ({
          memory: {
            id: result.id,
            userId,
            type: result.metadata?.type as Memory['type'] || 'general',
            content: result.metadata?.content || '',
            metadata: {
              timestamp: result.metadata?.timestamp || Date.now(),
              language: result.metadata?.language || undefined,
              tags: result.metadata?.tags ? result.metadata.tags.split(',').filter(Boolean) : undefined,
              title: result.metadata?.title || undefined,
            },
            sessionId: result.metadata?.sessionId || undefined,
          },
          score: result.score,
          similarity: result.score,
        }));
    } catch (error) {
      console.error('Error searching vectors:', error);
      throw new Error(`Failed to search vectors: ${error}`);
    }
  }

  async deleteVector(id: string): Promise<void> {
    try {
      await this.index.delete(id);
    } catch (error) {
      console.error('Error deleting vector:', error);
      throw new Error(`Failed to delete vector: ${error}`);
    }
  }

  async findRelatedMemories(memory: Memory, limit: number = 5): Promise<SearchResult[]> {
    return this.searchSimilar(memory.content, memory.userId, {
      limit: limit + 1, // +1 to exclude the memory itself
      type: memory.type,
      minScore: 0.75,
    }).then(results => 
      results.filter(result => result.memory.id !== memory.id).slice(0, limit)
    );
  }

  async getVectorStats(userId: string): Promise<{
    totalVectors: number;
    byType: Record<string, number>;
  }> {
    try {
      // This is a simplified implementation since Upstash Vector doesn't have direct stats API
      // We'll get this info by querying with very low threshold
      const allResults = await this.index.query({
        vector: new Array(embeddingService.getDimensions()).fill(0),
        topK: 1000,
        filter: `userId = "${userId}"`,
        includeMetadata: true,
      });

      const byType: Record<string, number> = {};
      
      allResults.forEach(result => {
        const type = result.metadata?.type as string || 'general';
        byType[type] = (byType[type] || 0) + 1;
      });

      return {
        totalVectors: allResults.length,
        byType,
      };
    } catch (error) {
      console.error('Error getting vector stats:', error);
      return { totalVectors: 0, byType: {} };
    }
  }
}

export const vectorStore = new VectorStore();
