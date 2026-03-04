/**
 * Advanced fuzzy matching utilities for client name matching
 */

// Levenshtein distance calculation
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

// Calculate similarity score (0-1, higher is better)
export function similarityScore(a: string, b: string): number {
  const aLower = a.toLowerCase().trim();
  const bLower = b.toLowerCase().trim();
  
  if (aLower === bLower) return 1;
  if (aLower.length === 0 || bLower.length === 0) return 0;
  
  const maxLength = Math.max(aLower.length, bLower.length);
  const distance = levenshteinDistance(aLower, bLower);
  
  return 1 - (distance / maxLength);
}

// Check if strings contain similar words
export function containsSimilarWords(search: string, target: string): number {
  const searchWords = search.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const targetWords = target.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  
  if (searchWords.length === 0 || targetWords.length === 0) return 0;
  
  let matchedWords = 0;
  for (const sw of searchWords) {
    for (const tw of targetWords) {
      if (tw.includes(sw) || sw.includes(tw) || similarityScore(sw, tw) > 0.7) {
        matchedWords++;
        break;
      }
    }
  }
  
  return matchedWords / searchWords.length;
}

// Generate acronym from name
export function generateAcronym(name: string): string {
  return name
    .split(/\s+/)
    .filter(w => w.length > 0 && w[0].match(/[a-zA-Z]/))
    .map(w => w[0].toUpperCase())
    .join('');
}

// Check if search matches as acronym
export function matchesAcronym(search: string, target: string): boolean {
  const acronym = generateAcronym(target);
  const searchUpper = search.toUpperCase().replace(/[^A-Z]/g, '');
  return acronym === searchUpper || acronym.includes(searchUpper) || searchUpper.includes(acronym);
}

export interface MatchResult {
  name: string;
  score: number;
  matchType: 'exact' | 'acronym' | 'partial' | 'fuzzy' | 'word-match';
  confidence: 'high' | 'medium' | 'low';
  lookerUrl?: string;
  ga4PropertyId?: string;
  domain?: string;
}

// Comprehensive fuzzy matching
export function findBestMatches(
  search: string,
  candidates: string[],
  additionalData?: {
    lookerUrls?: Record<string, string>;
    ga4Ids?: Record<string, string>;
    domains?: Record<string, string>;
  },
  maxResults = 5
): MatchResult[] {
  if (!search.trim()) return [];
  
  const searchLower = search.toLowerCase().trim();
  const results: MatchResult[] = [];
  
  for (const candidate of candidates) {
    const candidateLower = candidate.toLowerCase().trim();
    let score = 0;
    let matchType: MatchResult['matchType'] = 'fuzzy';
    
    // Exact match
    if (candidateLower === searchLower) {
      score = 1;
      matchType = 'exact';
    }
    // Acronym match
    else if (matchesAcronym(search, candidate)) {
      score = 0.95;
      matchType = 'acronym';
    }
    // Partial/contains match
    else if (candidateLower.includes(searchLower) || searchLower.includes(candidateLower)) {
      score = 0.85 + (0.1 * (searchLower.length / candidateLower.length));
      matchType = 'partial';
    }
    // Word match
    else {
      const wordScore = containsSimilarWords(search, candidate);
      if (wordScore > 0.5) {
        score = wordScore * 0.8;
        matchType = 'word-match';
      } else {
        // Fuzzy match
        score = similarityScore(search, candidate);
      }
    }
    
    if (score > 0.3) { // Minimum threshold
      const confidence: MatchResult['confidence'] = 
        score >= 0.85 ? 'high' : 
        score >= 0.6 ? 'medium' : 'low';
      
      results.push({
        name: candidate,
        score,
        matchType,
        confidence,
        lookerUrl: additionalData?.lookerUrls?.[candidateLower],
        ga4PropertyId: additionalData?.ga4Ids?.[candidateLower],
        domain: additionalData?.domains?.[candidateLower],
      });
    }
  }
  
  // Sort by score descending
  results.sort((a, b) => b.score - a.score);
  
  // Deduplicate by lowercase name, keeping highest scoring version
  const seenNames = new Set<string>();
  const dedupedResults = results.filter(r => {
    const lowerName = r.name.toLowerCase().trim();
    if (seenNames.has(lowerName)) return false;
    seenNames.add(lowerName);
    return true;
  });
  
  return dedupedResults.slice(0, maxResults);
}

// Find best single match across all data sources
export function findBestMatch(
  search: string,
  sheetTabs: string[],
  directoryNames: string[],
  additionalData?: {
    lookerUrls?: Record<string, string>;
    ga4Ids?: Record<string, string>;
    domains?: Record<string, string>;
  }
): MatchResult | null {
  // Combine all unique names
  const allNames = [...new Set([...sheetTabs, ...directoryNames])];
  const matches = findBestMatches(search, allNames, additionalData, 1);
  return matches[0] || null;
}
