import OpenAI from 'openai';
import { EmbeddingRequest } from './types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export class EmbeddingService {
  private model = 'text-embedding-3-small';
  private dimensions = 1536;

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
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