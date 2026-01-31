/**
 * Complexity Detector for AI Triage System
 *
 * Analyzes customer messages and project parameters to determine if a project
 * should be escalated to a specialist consultant.
 *
 * Scoring Logic:
 * - 1 zone = 0 points
 * - 2 zones = 20 points
 * - 3+ zones = 50 points
 * - Budget R150k+ = 30 points
 * - Complex keywords = 20 points
 * - Customer uncertain = 20 points
 * - THRESHOLD: 50+ points = ESCALATE
 */

export interface ComplexityAnalysis {
  zones: number;                      // Number of zones detected
  budget: number | null;              // Budget amount (if detected)
  hasMultiZone: boolean;              // 3+ zones detected
  isHighBudget: boolean;              // R150k+ detected
  hasComplexKeywords: boolean;        // Complex technical terms found
  customerUncertain: boolean;         // Customer expresses uncertainty
  score: number;                      // Total complexity score (0-100)
  shouldEscalate: boolean;            // True if score >= 50
  reasons: string[];                  // Human-readable reasons for escalation
}

interface KeywordPatterns {
  multiZone: RegExp[];
  uncertainty: RegExp[];
  complex: RegExp[];
}

// Keyword patterns for detection
const KEYWORDS: KeywordPatterns = {
  multiZone: [
    /whole\s+home/i,
    /multiple\s+rooms?/i,
    /distributed\s+audio/i,
    /entire\s+house/i,
    /all\s+rooms?/i,
    /throughout\s+the\s+house/i,
    /every\s+room/i,
    /several\s+rooms?/i,
    /different\s+rooms?/i,
    /various\s+rooms?/i,
    /\d+\s+zones?/i,  // "5 zones", "8 zones", etc.
    /large\s+house/i,
    /big\s+house/i,
    /large\s+property/i,
  ],
  uncertainty: [
    /not\s+sure/i,
    /don'?t\s+know/i,
    /help\s+me\s+decide/i,
    /what\s+do\s+i\s+need/i,
    /don'?t\s+understand/i,
    /confused/i,
    /uncertain/i,
    /advice/i,
    /recommend/i,
    /suggest/i,
  ],
  complex: [
    /dolby\s+atmos/i,
    /outdoor\s+speakers?/i,
    /commercial/i,
    /multiple\s+zones?/i,
    /integration/i,
    /whole\s+house/i,
    /distributed/i,
    /multi[\s-]?zone/i,
    /ceiling\s+speakers?.*multiple/i,
    /wiring/i,
    /installation/i,
    /professional\s+install/i,
  ],
};

// Budget patterns to extract amounts
const BUDGET_PATTERNS = [
  /r\s*(\d{1,3}(?:[,\s]?\d{3})*(?:\.\d{2})?)\s*k?/gi,  // R150k, R 150000, R150,000
  /(\d{1,3}(?:[,\s]?\d{3})*)\s*rand/gi,                 // 150000 rand
  /budget[:\s]+r?\s*(\d{1,3}(?:[,\s]?\d{3})*)/gi,      // budget: R150000
];

// Zone count patterns
const ZONE_PATTERNS = [
  /(\d+)\s+zones?/i,                    // "5 zones", "3 zone"
  /(\d+)\s+rooms?/i,                    // "8 rooms", "4 room"
  /(\d+)\s+areas?/i,                    // "6 areas"
  /(\d+)\s+spaces?/i,                   // "4 spaces"
  /(\d+)\s+other\s+zones?/i,            // "4 other zones"
];

// Room name patterns to count explicit room mentions
const ROOM_NAME_PATTERNS = [
  /\b(living\s*room|lounge|tv\s*room|family\s*room|great\s*room)\b/gi,
  /\b(bedroom|bed\s*room|master|guest\s*room)\b/gi,
  /\b(kitchen|dining|dining\s*room)\b/gi,
  /\b(bathroom|bath\s*room)\b/gi,
  /\b(office|study|den|library)\b/gi,
  /\b(patio|outdoor|deck|veranda|balcony|garden|pool\s*area)\b/gi,
  /\b(garage|basement|attic|loft)\b/gi,
  /\b(cinema|theater|theatre|home\s*cinema|media\s*room)\b/gi,
  /\b(bar|restaurant|cafe|shop|store|retail)\b/gi,
  /\b(conference\s*room|meeting\s*room|boardroom)\b/gi,
  /\b(gym|workout\s*room|exercise\s*room)\b/gi,
  /\b(hallway|corridor|entrance|foyer|lobby)\b/gi,
];

/**
 * Extract budget amount from text
 */
function extractBudget(text: string): number | null {
  for (const pattern of BUDGET_PATTERNS) {
    const matches = Array.from(text.matchAll(pattern));
    for (const match of matches) {
      const numStr = match[1].replace(/[,\s]/g, '');
      let amount = parseInt(numStr, 10);

      // Handle "k" suffix (e.g., "150k" = 150000)
      if (match[0].toLowerCase().includes('k')) {
        amount *= 1000;
      }

      // Return first valid budget found
      if (amount > 0) {
        return amount;
      }
    }
  }
  return null;
}

/**
 * Extract zone count from text
 */
function extractZoneCount(text: string): number {
  let maxZones = 1; // Default to single zone

  // First, check for explicit numeric zone mentions
  for (const pattern of ZONE_PATTERNS) {
    // Ensure pattern has 'g' flag for matchAll
    const globalPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
    const matches = Array.from(text.matchAll(globalPattern));
    for (const match of matches) {
      const count = parseInt(match[1], 10);
      if (count > maxZones) {
        maxZones = count;
      }
    }
  }

  // If no explicit count, try to count unique room names mentioned
  if (maxZones === 1) {
    const uniqueRooms = new Set<string>();

    for (const pattern of ROOM_NAME_PATTERNS) {
      // These already have 'gi' flags
      const matches = Array.from(text.matchAll(pattern));
      for (const match of matches) {
        // Normalize the room name to avoid duplicates
        const roomType = match[0].toLowerCase().trim().replace(/\s+/g, '_');
        uniqueRooms.add(roomType);
      }
    }

    const roomCount = uniqueRooms.size;
    if (roomCount > maxZones) {
      maxZones = roomCount;
    }
  }

  return maxZones;
}

/**
 * Check if text matches any patterns in array
 */
function matchesPatterns(text: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(text));
}

/**
 * Analyze complexity of customer message and project parameters
 *
 * @param message - Customer's message text
 * @param budget - Optional explicit budget amount (overrides text extraction)
 * @returns ComplexityAnalysis object with score and escalation decision
 */
export function analyzeComplexity(
  message: string,
  budget?: number
): ComplexityAnalysis {
  const normalizedText = message.toLowerCase();

  // Extract metrics
  const extractedBudget = budget ?? extractBudget(message);
  const zones = extractZoneCount(message);

  // Detect patterns
  const hasMultiZone = zones >= 3 || matchesPatterns(normalizedText, KEYWORDS.multiZone);
  const isHighBudget = extractedBudget !== null && extractedBudget >= 150000;
  const hasComplexKeywords = matchesPatterns(normalizedText, KEYWORDS.complex);
  const customerUncertain = matchesPatterns(normalizedText, KEYWORDS.uncertainty);

  // Calculate score
  let score = 0;
  const reasons: string[] = [];

  // Zone scoring
  if (zones === 1) {
    score += 0;
  } else if (zones === 2) {
    score += 20;
    reasons.push('2 zones detected');
  } else if (zones >= 3) {
    score += 50;
    reasons.push(`${zones} zones detected (multi-zone project)`);
  }

  // Multi-zone keyword override (if zones not explicitly stated)
  if (zones < 3 && hasMultiZone) {
    score += 50;
    reasons.push('Multi-zone keywords detected (whole home, distributed, etc.)');
  }

  // Budget scoring
  if (isHighBudget) {
    score += 30;
    reasons.push(`High budget detected (R${extractedBudget?.toLocaleString()})`);
  }

  // Complex keywords
  if (hasComplexKeywords) {
    score += 20;
    reasons.push('Complex technical requirements detected');
  }

  // Customer uncertainty
  if (customerUncertain) {
    score += 20;
    reasons.push('Customer expressed uncertainty or needs guidance');
  }

  // Determine escalation
  // Based on CHAT_QUOTE_PLAN_X7: "AI escalates when ANY of these conditions are met"
  // 1. Multi-zone (3+ zones) - triggers alone
  // 2. High budget (R150k+) - triggers alone
  // 3. Combined factors reaching threshold (score >= 50)
  const shouldEscalate =
    zones >= 3 ||                    // Multi-zone projects
    hasMultiZone ||                  // Multi-zone keywords (whole home, etc.)
    isHighBudget ||                  // High budget projects
    score >= 50;                     // Combined complexity factors

  return {
    zones,
    budget: extractedBudget,
    hasMultiZone,
    isHighBudget,
    hasComplexKeywords,
    customerUncertain,
    score,
    shouldEscalate,
    reasons,
  };
}

/**
 * Get human-readable explanation of complexity analysis
 */
export function explainComplexity(analysis: ComplexityAnalysis): string {
  const lines = [
    `Complexity Score: ${analysis.score}/100`,
    `Zones: ${analysis.zones}`,
    `Budget: ${analysis.budget ? `R${analysis.budget.toLocaleString()}` : 'Not specified'}`,
    `Decision: ${analysis.shouldEscalate ? '⚠️ ESCALATE TO SPECIALIST' : '✅ AI CAN HANDLE'}`,
  ];

  if (analysis.reasons.length > 0) {
    lines.push('');
    lines.push('Reasons:');
    analysis.reasons.forEach(reason => {
      lines.push(`  - ${reason}`);
    });
  }

  return lines.join('\n');
}
