#!/usr/bin/env tsx
/**
 * Calculate scores manually to debug
 */

// Supabase product
const sbName = 'wiim pro streamer';
const sbCoreWords = ['wiim', 'pro', 'streamer'];

// Candidates
const candidates = [
  'WiiM Pro Plus - Streaming Pre-Amplifier (What HiFi Awards 2024)',
  'WiiM Pro - Streaming Pre-Amplifier',
];

console.log(`\nSubabase: "${sbName}"`);
console.log(`Core words: [${sbCoreWords.join(', ')}]\n`);

function levenshtein(str1: string, str2: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= str2.length; i++) matrix[i] = [i];
  for (let j = 0; j <= str1.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[str2.length][str1.length];
}

function similarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  if (s1 === s2) return 1.0;
  const longer = s1.length > s2.length ? s1 : s2;
  const editDistance = levenshtein(s1, s2);
  return (longer.length - editDistance) / longer.length;
}

candidates.forEach((ocName) => {
  console.log(`\nCandidate: "${ocName}"`);

  const ocWords = ocName.toLowerCase().split(/[\s\-()]+/);
  console.log(`  Words: [${ocWords.slice(0, 5).join(', ')}...]`);

  // 1. Core score (50%)
  let coreMatched = 0;
  sbCoreWords.forEach(word => {
    if (ocWords.some(ocw => ocw.includes(word) || word.includes(ocw))) {
      coreMatched++;
    }
  });
  const coreScore = coreMatched / sbCoreWords.length;
  console.log(`  Core score: ${Math.round(coreScore * 100)}% (${coreMatched}/${sbCoreWords.length} matched)`);

  // 2. Early position (20%)
  const firstThree = ocWords.slice(0, 3).join(' ');
  let earlyMatched = 0;
  sbCoreWords.forEach(word => {
    if (firstThree.includes(word)) earlyMatched++;
  });
  const earlyScore = earlyMatched / sbCoreWords.length;
  console.log(`  Early position: ${Math.round(earlyScore * 100)}% (${earlyMatched}/${sbCoreWords.length} in first 3)`);

  // 3. Brevity (15%)
  const sbWordCount = sbName.split(/[\s\-()]+/).length;
  const ocWordCount = ocWords.filter(w => w.length > 0).length;
  const wordCountRatio = Math.min(sbWordCount / ocWordCount, 1.0);
  const brevityScore = coreScore > 0.8 ? wordCountRatio : 0;
  console.log(`  Brevity: ${Math.round(brevityScore * 100)}% (${sbWordCount}/${ocWordCount} words, core>${coreScore})`);

  // 4. Levenshtein (15%)
  const levScore = similarity(sbName, ocName.toLowerCase());
  console.log(`  Levenshtein: ${Math.round(levScore * 100)}%`);

  // Total
  const total = (coreScore * 0.5) + (earlyScore * 0.2) + (brevityScore * 0.15) + (levScore * 0.15);
  console.log(`  TOTAL: ${Math.round(total * 100)}%`);
});
