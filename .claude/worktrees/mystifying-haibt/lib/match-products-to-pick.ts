/**
 * Match curated products to a plan pick by keyword relevance.
 */

import type { RankedItem } from './database.types';
import { PRODUCTS } from './products';
import type { Product } from './products';

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'for', 'with', 'in', 'on', 'to', 'of',
  'is', 'it', 'its', 'your', 'use', 'from', 'by', 'as', 'at', 'be',
  'this', 'that', 'can', 'will', 'more', 'less', 'each', 'per', 'daily',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOP_WORDS.has(w));
}

/**
 * Score a product against a set of keywords.
 * Higher score = more relevant to the pick.
 */
function scoreProduct(product: Product, keywords: string[]): number {
  const searchable = [
    product.name,
    product.brand,
    product.description,
  ].join(' ').toLowerCase();

  let score = 0;
  for (const kw of keywords) {
    if (searchable.includes(kw)) score += 1;
  }
  return score;
}

/** Map pillar type to product categories for boosting */
const PILLAR_TO_CATEGORIES: Record<string, string[]> = {
  product: ['Skincare'],
  diet: ['Foods', 'Supplements'],
  herbal: ['Herbal'],
  lifestyle: [],
};

/**
 * Find products from the curated 50 that match a plan pick.
 * Returns up to `limit` products sorted by relevance.
 * Returns empty array for lifestyle picks (no purchasable products).
 */
export function matchProductsToPick(pick: RankedItem, limit = 8): Product[] {
  // Lifestyle picks have no purchasable products
  if (pick.pillar === 'lifestyle') return [];

  const keywords = tokenize(`${pick.title} ${pick.rationale}`);
  if (keywords.length === 0) return [];

  const preferredCategories = PILLAR_TO_CATEGORIES[pick.pillar] || [];

  const scored = PRODUCTS
    .map(product => {
      let score = scoreProduct(product, keywords);
      // Boost products in the matching category
      if (preferredCategories.includes(product.category)) score += 0.5;
      return { product, score };
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(s => s.product);
}
