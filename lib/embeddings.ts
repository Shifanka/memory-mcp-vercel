import OpenAI from 'openai';
import { EmbeddingRequest } from './types';
import crypto from 'crypto';

export class EmbeddingService {
  private model = 'text-embedding-3-small';
  private dimensions = 1536;
  private openai: OpenAI | null = null;
  private mockMode: boolean;

  constructor() {
    const hasApiKey = process.env.OPENAI_API_KEY && 
                     process.env.OPENAI_API_KEY !== 'your_openai_key_here';

    this.mockMode = !hasApiKey;

    if (hasApiKey) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY!,
      });
    } else {
      console.log('Running in embedding mock mode - OpenAI API key not configured');
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (this.mockMode) {
      // Generate deterministic mock embedding based on text hash
      const hash = crypto.createHash('sha256').update(text).digest('hex');
      const mockEmbedding = Array.from({ length: this.dimensions }, (_, i) => {
        const charCode = hash.charCodeAt(i % hash.length);
        return (charCode / 255 - 0.5) * 2; // Normalize to [-1, 1]
      });
      return mockEmbedding;
    }

    try {
      const response = await this.openai!.embeddings.create({
        model: this.model,
        input: text,
        dimensions: this.dimensions,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new Error(`Failed to generate embedding: ${error}`);
    }
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    
    try {
      const response = await openai.embeddings.create({
        model: this.model,
        input: texts,
        dimensions: this.dimensions,
      });

      return response.data.map(d => d.embedding);
    } catch (error) {
      console.error('Error generating batch embeddings:', error);
      throw new Error(`Failed to generate batch embeddings: ${error}`);
    }
  }

  getDimensions(): number {
    return this.dimensions;
  }

  getModel(): string {
    return this.model;
  }
}

export const embeddingService = new EmbeddingService();