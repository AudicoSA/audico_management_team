/**
 * Shared Embedding Utility
 * Generate semantic embeddings for products using Claude
 */

import Anthropic from '@anthropic-ai/sdk';

/**
 * Generate embedding for a text using Claude's message format
 * Returns 1536-dimensional vector for semantic search
 */
export async function generateEmbedding(
  text: string,
  anthropic: Anthropic
): Promise<number[]> {
  try {
    // Use Claude to generate a semantic representation
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: `Extract exactly 20 key semantic features from this product as a comma-separated list of numbers (0-1 scale). Focus on: type, use-case, price-range, brand-category, quality-tier, target-market, connectivity, form-factor, power-level, installation-type.

Product: ${text}

Return ONLY 20 comma-separated decimal numbers between 0 and 1, nothing else.`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      const numbers = content.text
        .split(',')
        .map((n: string) => parseFloat(n.trim()))
        .filter((n: number) => !isNaN(n) && n >= 0 && n <= 1);

      if (numbers.length >= 20) {
        // Pad to 1536 dimensions (repeat pattern)
        const embedding: number[] = [];
        while (embedding.length < 1536) {
          embedding.push(
            ...numbers.slice(0, Math.min(20, 1536 - embedding.length))
          );
        }
        return embedding.slice(0, 1536);
      }
    }

    throw new Error('Failed to generate valid embedding');
  } catch (error) {
    console.error('Embedding error:', error);
    throw error;
  }
}

/**
 * Create rich text representation for product embedding
 */
export function createProductText(product: {
  brand?: string;
  product_name: string;
  category_name?: string;
  selling_price?: number;
}): string {
  const parts = [
    product.brand,
    product.product_name,
    product.category_name,
    product.selling_price ? `R${product.selling_price}` : null,
  ].filter(Boolean);

  return parts.join(' ');
}
