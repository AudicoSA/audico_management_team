// Export all shared utilities
export * from './types';
export * from './supabase-client';
export * from './logger';
export * from './pricing';
export * from './embedding';
export * from './auto-tagger';

// Default exports
export { SupabaseService } from './supabase-client';
export { logger, logSync } from './logger';
export { PricingCalculator } from './pricing';
export { generateEmbedding, createProductText } from './embedding';
export { ProductAutoTagger } from './auto-tagger';
