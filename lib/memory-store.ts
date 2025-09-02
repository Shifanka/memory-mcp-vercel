import { Redis } from '@upstash/redis';
import { Memory, ContextualMemory } from './types';
import { v4 as uuidv4 } from 'uuid';

export class MemoryStore {
  private redis: Redis;

  constructor() {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      throw new Error('Upstash Redis credentials not configured');
    }

    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }

  async storeMemory(memory: Omit<Memory, 'id'>): Promise<string> {
    const id = uuidv4();
    const fullMemory: Memory = {
      ...memory,
      id,
      metadata: {
        ...memory.metadata,
        timestamp: Date.now(),
      },
    };

    // Store memory with multiple keys for efficient retrieval
    const pipeline = this.redis.pipeline();
    
    // Store the full memory object
    pipeline.hset(`memory:${id}`, fullMemory);
    
    // Add to user's memory list
    pipeline.sadd(`user:${memory.userId}:memories`, id);
    
    // Add to type-based index
    pipeline.sadd(`type:${memory.type}:memories`, id);
    
    // Add to session index if applicable
    if (memory.sessionId) {
      pipeline.sadd(`session:${memory.sessionId}:memories`, id);
    }

    // Add to time-based index (for efficient recent retrieval)
    pipeline.zadd(`recent:${memory.userId}`, { score: Date.now(), member: id });

    await pipeline.exec();
    
    return id;
  }

  async getMemory(id: string): Promise<Memory | null> {
    const memory = await this.redis.hgetall(`memory:${id}`);
    if (!memory || Object.keys(memory).length === 0) {
      return null;
    }
    return memory as Memory;
  }

  async getUserMemories(userId: string, limit: number = 50): Promise<Memory[]> {
    const memoryIds = await this.redis.smembers(`user:${userId}:memories`);
    
    if (memoryIds.length === 0) return [];
    
    const memories: Memory[] = [];
    for (const id of memoryIds.slice(0, limit)) {
      const memory = await this.getMemory(id);
      if (memory) memories.push(memory);
    }
    
    // Sort by timestamp (most recent first)
    return memories.sort((a, b) => b.metadata.timestamp - a.metadata.timestamp);
  }

  async getRecentMemories(userId: string, limit: number = 10): Promise<Memory[]> {
    const recentIds = await this.redis.zrevrange(`recent:${userId}`, 0, limit - 1);
    
    const memories: Memory[] = [];
    for (const id of recentIds) {
      const memory = await this.getMemory(id);
      if (memory) memories.push(memory);
    }
    
    return memories;
  }

  async getMemoriesByType(userId: string, type: Memory['type'], limit: number = 20): Promise<Memory[]> {
    const typeMemoryIds = await this.redis.smembers(`type:${type}:memories`);
    const userMemoryIds = await this.redis.smembers(`user:${userId}:memories`);
    
    // Get intersection of type and user memories
    const relevantIds = typeMemoryIds.filter(id => userMemoryIds.includes(id));
    
    const memories: Memory[] = [];
    for (const id of relevantIds.slice(0, limit)) {
      const memory = await this.getMemory(id);
      if (memory) memories.push(memory);
    }
    
    return memories.sort((a, b) => b.metadata.timestamp - a.metadata.timestamp);
  }

  async deleteMemory(id: string): Promise<boolean> {
    const memory = await this.getMemory(id);
    if (!memory) return false;

    const pipeline = this.redis.pipeline();
    
    // Remove from all indexes
    pipeline.del(`memory:${id}`);
    pipeline.srem(`user:${memory.userId}:memories`, id);
    pipeline.srem(`type:${memory.type}:memories`, id);
    pipeline.zrem(`recent:${memory.userId}`, id);
    
    if (memory.sessionId) {
      pipeline.srem(`session:${memory.sessionId}:memories`, id);
    }

    await pipeline.exec();
    return true;
  }

  async getSessionContext(sessionId: string): Promise<Memory[]> {
    const memoryIds = await this.redis.smembers(`session:${sessionId}:memories`);
    
    const memories: Memory[] = [];
    for (const id of memoryIds) {
      const memory = await this.getMemory(id);
      if (memory) memories.push(memory);
    }
    
    return memories.sort((a, b) => a.metadata.timestamp - b.metadata.timestamp);
  }

  async cacheQuery(queryHash: string, response: string, ttl: number = 3600): Promise<void> {
    await this.redis.setex(`cache:${queryHash}`, ttl, response);
  }

  async getCachedQuery(queryHash: string): Promise<string | null> {
    return await this.redis.get(`cache:${queryHash}`);
  }
}