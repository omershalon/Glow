/**
 * Product Search — Open Food Facts + Open Beauty Facts
 * Free, no API key, covers skincare/supplements/foods.
 */

import type { Product, ProductCategory } from './products';

const OFF_FOOD = 'https://world.openfoodfacts.org';
const OFF_BEAUTY = 'https://world.openbeautyfacts.org';
const USER_AGENT = 'GlowSkincare/1.0';

interface OFFProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  image_front_url?: string;
  image_url?: string;
  categories?: string;
}

function guessCategory(text: string): ProductCategory {
  const t = text.toLowerCase();
  if (t.match(/cleanser|moistur|serum|spf|sunscreen|toner|retinol|cream|lotion|face|skin/)) return 'Skincare';
  if (t.match(/vitamin|omega|zinc|magnesium|biotin|supplement|capsule|probiotic/)) return 'Supplements';
  if (t.match(/tea|turmeric|ashwagandha|herb|neem|echinacea|extract|essential oil/)) return 'Herbal';
  if (t.match(/pillow|towel|silk|satin|roller|cloth|brush/)) return 'Accessories';
  return 'Foods';
}

function offToProduct(item: OFFProduct, index: number): Product | null {
  if (!item.product_name) return null;
  const name = item.product_name;
  const brand = item.brands || '';
  const imageUrl = item.image_front_url || item.image_url || '';

  return {
    id: `search-${item.code || index}`,
    asin: '',
    brand,
    name,
    category: guessCategory(`${name} ${brand} ${item.categories || ''}`),
    image_url: imageUrl,
    price: '',
    price_numeric: 0,
    rating: 0,
    reviews: 0,
    description: '',
    match_percent: 75 + Math.floor(Math.random() * 20),
  };
}

async function searchOFF(base: string, query: string): Promise<Product[]> {
  try {
    const url = `${base}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10&fields=code,product_name,brands,image_front_url,image_url,categories`;
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) return [];
    const data = await res.json();
    const items: OFFProduct[] = data.products || [];
    return items.map((item, i) => offToProduct(item, i)).filter((p): p is Product => p !== null);
  } catch {
    return [];
  }
}

/**
 * Search for products across Open Beauty Facts and Open Food Facts.
 * Returns up to 15 results.
 */
export async function searchProducts(query: string): Promise<Product[]> {
  if (!query.trim() || query.trim().length < 2) return [];

  // Search both databases in parallel
  const [beautyResults, foodResults] = await Promise.all([
    searchOFF(OFF_BEAUTY, query),
    searchOFF(OFF_FOOD, query),
  ]);

  // Merge, deduplicate by name, cap at 15
  const seen = new Set<string>();
  const merged: Product[] = [];

  for (const p of [...beautyResults, ...foodResults]) {
    const key = p.name.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(p);
    if (merged.length >= 15) break;
  }

  return merged;
}
