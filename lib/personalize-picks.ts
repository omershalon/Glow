/**
 * Personalize Picks
 *
 * Re-ranks the curated 50 products based on the user's scan history.
 * Products related to what they've scanned (by ingredients, category, keywords)
 * get boosted to the top. Products conflicting with unsuitable scans get demoted.
 */

import type { Product } from './products';

interface ScanRecord {
  product_name: string;
  verdict: 'suitable' | 'unsuitable' | 'caution';
  ingredients: string[];
}

/**
 * Extract scoring keywords from scan history.
 * Returns a map of keyword → score (+1 for suitable, -1 for unsuitable, 0 for caution).
 */
function buildKeywordScores(scans: ScanRecord[]): Record<string, number> {
  const scores: Record<string, number> = {};

  for (const scan of scans) {
    const weight = scan.verdict === 'suitable' ? 1 : scan.verdict === 'unsuitable' ? -0.5 : 0.3;

    // Score ingredient keywords
    for (const ing of scan.ingredients) {
      const key = ing.toLowerCase().trim();
      if (key.length < 3) continue;
      scores[key] = (scores[key] || 0) + weight;
    }

    // Score words from product name
    const words = scan.product_name.toLowerCase().split(/\s+/);
    for (const word of words) {
      if (word.length < 3) continue;
      // Skip generic words
      if (['the', 'for', 'and', 'with', 'free', 'from', 'pack'].includes(word)) continue;
      scores[word] = (scores[word] || 0) + weight * 0.5;
    }
  }

  return scores;
}

/**
 * Score a product based on how well it matches the user's scan-derived preferences.
 */
function scoreProduct(product: Product, keywordScores: Record<string, number>): number {
  let score = 0;
  const text = `${product.name} ${product.brand} ${product.description}`.toLowerCase();

  for (const [keyword, keyScore] of Object.entries(keywordScores)) {
    if (text.includes(keyword)) {
      score += keyScore;
    }
  }

  return score;
}

/**
 * Re-rank products based on user's scan history.
 * Products with higher relevance to positive scans appear first.
 * Falls back to original order if no scans exist.
 */
export function personalizeProducts(
  products: Product[],
  scanHistory: ScanRecord[]
): Product[] {
  if (!scanHistory || scanHistory.length === 0) {
    return products; // No scans yet — return original order
  }

  const keywordScores = buildKeywordScores(scanHistory);

  // Score each product
  const scored = products.map(product => ({
    product,
    score: scoreProduct(product, keywordScores),
  }));

  // Sort: highest score first, then by original match_percent as tiebreaker
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.product.match_percent - a.product.match_percent;
  });

  // Update match_percent to reflect personalization
  return scored.map(({ product, score }) => ({
    ...product,
    // Boost match_percent slightly for highly scored products
    match_percent: Math.min(99, Math.max(50, product.match_percent + Math.round(score * 3))),
  }));
}
