export interface Memory {
  id: string;
  userId: string;
  sessionId?: string;
  type: 'code' | 'conversation' | 'preference' | 'general';
  content: string;
  metadata: {
    language?: string;
    tags?: string[];
    timestamp: number;
    source?: string;
    title?: string;
    context?: string;
  };
}

export interface SearchResult {
  memory: Memory;
  score: number;
  similarity?: number;
}

export interface ContextualMemory {
  recent: Memory[];
  related: SearchResult[];
  summary?: string;
}

export interface EmbeddingRequest {
  text: string;
  model?: string;
}

export interface VectorData {
  id: string;
  vector: number[];
  metadata: {
    userId: string;
    type: string;
    timestamp: number;
    content: string;
    [key: string]: any;
  };
}