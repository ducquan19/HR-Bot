import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { pipeline, FeatureExtractionPipeline, env } from '@xenova/transformers';

@Injectable()
export class LocalEmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(LocalEmbeddingService.name);
  private extractor: FeatureExtractionPipeline | null = null;
  private readonly modelName = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

  async onModuleInit() {
    try {
      this.logger.log(`Initializing Local Embedding Model: ${this.modelName}... This might take a while on the first run.`);
      
      this.extractor = await pipeline('feature-extraction', this.modelName, {
        quantized: true, // Use quantized ONNX model for smaller memory footprint and faster CPU inference
      });
      
      this.logger.log('Local Embedding Model loaded successfully.');
    } catch (error) {
      this.logger.error(`Failed to load Local Embedding Model: ${(error as Error).message}`, (error as Error).stack);
    }
  }

  async embed(text: string): Promise<number[]> {
    if (!this.extractor) {
      throw new Error('Local Embedding model is not initialized yet. Please wait a moment.');
    }
    
    // The pipeline returns a Tensor of shape [1, seq_length, embedding_dim]
    // using pooling: 'mean' gives us a [1, embedding_dim] vector
    const output = await this.extractor(text, { pooling: 'mean', normalize: true });
    
    // Extract the vector data as a Float32Array and convert to standard number array
    const vector = Array.from(output.data);
    
    return vector;
  }
}
