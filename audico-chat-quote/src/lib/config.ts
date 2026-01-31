/**
 * Feature Flags and Configuration
 * Controls experimental features and system behavior
 */

export const FEATURES = {
  /**
   * Enable the specialist agent for product recommendations
   * When true: Uses Claude with tool-calling for intelligent recommendations
   * When false: Uses simple keyword search (current behavior)
   */
  useSpecialistAgent: process.env.USE_SPECIALIST_AGENT === "true",

  /**
   * Model to use for the specialist agent
   */
  agentModel: process.env.AGENT_MODEL || "claude-sonnet-4-20250514",

  /**
   * Search weight configuration
   * Higher BM25 = more keyword-focused (better category accuracy)
   * Higher vector = more semantic (better for fuzzy queries)
   */
  searchWeights: {
    vector: parseFloat(process.env.SEARCH_VECTOR_WEIGHT || "0.3"),
    bm25: parseFloat(process.env.SEARCH_BM25_WEIGHT || "0.7"),
  },

  /**
   * Maximum iterations for agent tool-calling loop
   */
  agentMaxIterations: parseInt(process.env.AGENT_MAX_ITERATIONS || "5", 10),

  /**
   * Enable detailed logging for debugging
   */
  debugMode: process.env.DEBUG_MODE === "true",
};

/**
 * Search configuration
 */
export const SEARCH_CONFIG = {
  /**
   * Default number of results to return
   */
  defaultLimit: 10,

  /**
   * Maximum results for a single search
   */
  maxLimit: 50,

  /**
   * Default budget if not specified (R200,000)
   */
  defaultBudget: 200000,
};

/**
 * Quote configuration
 */
export const QUOTE_CONFIG = {
  /**
   * Maximum products per quote
   */
  maxProducts: 50,

  /**
   * Session timeout in milliseconds (24 hours)
   */
  sessionTimeout: 24 * 60 * 60 * 1000,
};
