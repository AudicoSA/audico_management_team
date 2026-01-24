/**
 * Shared Embedding Utility
 * Generate semantic embeddings for products using Claude
 */
import Anthropic from '@anthropic-ai/sdk';
/**
 * Generate embedding for a text using Claude's message format
 * Returns 1536-dimensional vector for semantic search
 */
export declare function generateEmbedding(text: string, anthropic: Anthropic): Promise<number[]>;
/**
 * Create rich text representation for product embedding
 */
export declare function createProductText(product: {
    brand?: string;
    product_name: string;
    category_name?: string;
    selling_price?: number;
}): string;
//# sourceMappingURL=embedding.d.ts.map