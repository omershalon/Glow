/**
 * Plan → Products
 *
 * Extracts product/food/supplement/herbal recommendations from a user's
 * personalized plan and converts them into Amazon search queries.
 * These queries are then used to populate the Discover page with
 * products that actually match what the AI recommended.
 */

import type {
  ProductsPillar,
  DietPillar,
  HerbalPillar,
  RankedItem,
} from './database.types';

export interface PlanSearchQuery {
  query: string;
  category: 'Skincare' | 'Supplements' | 'Foods' | 'Herbal' | 'Accessories';
  source: string; // e.g. "products_pillar.top_product_recommendations"
  rank: number;   // lower = higher priority
}

/**
 * Extract Amazon search queries from a personalized plan.
 * Returns queries sorted by priority (highest impact first).
 */
export function extractSearchQueries(plan: {
  products_pillar?: ProductsPillar;
  diet_pillar?: DietPillar;
  herbal_pillar?: HerbalPillar;
  ranked_items?: RankedItem[];
}): PlanSearchQuery[] {
  const queries: PlanSearchQuery[] = [];
  let rank = 0;

  // ── From ranked_items (highest priority — these are AI-ranked by impact) ──
  if (plan.ranked_items) {
    for (const item of plan.ranked_items) {
      rank++;
      const category = item.pillar === 'product' ? 'Skincare'
        : item.pillar === 'diet' ? 'Foods'
        : item.pillar === 'herbal' ? 'Herbal'
        : 'Skincare';

      queries.push({
        query: item.title,
        category,
        source: 'ranked_items',
        rank,
      });
    }
  }

  // ── From products_pillar ──
  if (plan.products_pillar) {
    const pp = plan.products_pillar;

    // Top product recommendations
    for (const rec of pp.top_product_recommendations || []) {
      if (!queries.some(q => q.query.toLowerCase() === rec.toLowerCase())) {
        rank++;
        queries.push({ query: rec, category: 'Skincare', source: 'top_product_recommendations', rank });
      }
    }

    // Morning + evening routine products
    for (const step of [...(pp.morning_routine || []), ...(pp.evening_routine || [])]) {
      const q = `${step.product_type} ${step.key_ingredients.slice(0, 2).join(' ')}`.trim();
      if (q.length > 3 && !queries.some(existing => existing.query.toLowerCase().includes(step.product_type.toLowerCase()))) {
        rank++;
        queries.push({ query: q, category: 'Skincare', source: 'routine_step', rank });
      }
    }

    // Key ingredients to search for
    for (const ingredient of pp.ingredients_to_use || []) {
      if (!queries.some(q => q.query.toLowerCase().includes(ingredient.toLowerCase()))) {
        rank++;
        queries.push({ query: `${ingredient} skincare serum`, category: 'Skincare', source: 'ingredients_to_use', rank });
      }
    }
  }

  // ── From diet_pillar ──
  if (plan.diet_pillar) {
    const dp = plan.diet_pillar;

    // Supplements
    for (const supp of dp.supplements || []) {
      if (!queries.some(q => q.query.toLowerCase().includes(supp.name.toLowerCase()))) {
        rank++;
        queries.push({ query: `${supp.name} supplement ${supp.dose}`, category: 'Supplements', source: 'diet_supplements', rank });
      }
    }

    // Foods to eat
    for (const food of dp.foods_to_eat || []) {
      if (!queries.some(q => q.query.toLowerCase().includes(food.food.toLowerCase()))) {
        rank++;
        queries.push({ query: food.food, category: 'Foods', source: 'foods_to_eat', rank });
      }
    }
  }

  // ── From herbal_pillar ──
  if (plan.herbal_pillar) {
    const hp = plan.herbal_pillar;

    // Remedies
    for (const remedy of hp.remedies || []) {
      if (!queries.some(q => q.query.toLowerCase().includes(remedy.name.toLowerCase()))) {
        rank++;
        queries.push({ query: `${remedy.name} ${remedy.form}`, category: 'Herbal', source: 'herbal_remedies', rank });
      }
    }

    // Teas
    for (const tea of hp.teas || []) {
      if (!queries.some(q => q.query.toLowerCase().includes(tea.name.toLowerCase()))) {
        rank++;
        queries.push({ query: `${tea.name} tea`, category: 'Herbal', source: 'herbal_teas', rank });
      }
    }
  }

  // Sort by rank (impact order) and cap at 50
  return queries.sort((a, b) => a.rank - b.rank).slice(0, 50);
}

/**
 * Convert plan data directly into Product objects for the Discover grid.
 * No API calls needed — just extracts names, categories, and rationale
 * from the user's AI-generated plan.
 */
export function planToProducts(plan: {
  products_pillar?: ProductsPillar;
  diet_pillar?: DietPillar;
  herbal_pillar?: HerbalPillar;
  ranked_items?: RankedItem[];
}): Array<{
  id: string;
  name: string;
  brand: string;
  category: 'Skincare' | 'Supplements' | 'Foods' | 'Herbal' | 'Accessories';
  description: string;
  match_percent: number;
  asin: string;
  image_url: string;
  price: string;
  price_numeric: number;
  rating: number;
  reviews: number;
}> {
  const products: Array<{
    id: string;
    name: string;
    brand: string;
    category: 'Skincare' | 'Supplements' | 'Foods' | 'Herbal' | 'Accessories';
    description: string;
    match_percent: number;
    asin: string;
    image_url: string;
    price: string;
    price_numeric: number;
    rating: number;
    reviews: number;
  }> = [];
  const seen = new Set<string>();

  function add(
    name: string,
    category: 'Skincare' | 'Supplements' | 'Foods' | 'Herbal' | 'Accessories',
    description: string,
    matchPercent: number,
  ) {
    const key = name.toLowerCase().trim();
    if (seen.has(key) || key.length < 3) return;
    seen.add(key);
    products.push({
      id: `plan-${products.length + 1}`,
      name,
      brand: '',
      category,
      description,
      match_percent: matchPercent,
      asin: '',
      image_url: '',
      price: '',
      price_numeric: 0,
      rating: 0,
      reviews: 0,
    });
  }

  // 1. Ranked items (highest priority — AI ranked by impact)
  if (plan.ranked_items) {
    for (const item of plan.ranked_items) {
      const cat = item.pillar === 'product' ? 'Skincare'
        : item.pillar === 'diet' ? 'Foods'
        : item.pillar === 'herbal' ? 'Herbal'
        : 'Skincare';
      add(item.title, cat, item.rationale, Math.max(70, 99 - products.length));
    }
  }

  // 2. Top product recommendations
  if (plan.products_pillar?.top_product_recommendations) {
    for (const rec of plan.products_pillar.top_product_recommendations) {
      add(rec, 'Skincare', 'Recommended for your skin type', Math.max(70, 95 - products.length));
    }
  }

  // 3. Routine steps (morning + evening)
  if (plan.products_pillar) {
    const steps = [
      ...(plan.products_pillar.morning_routine || []),
      ...(plan.products_pillar.evening_routine || []),
    ];
    for (const step of steps) {
      const name = step.name || step.product_type;
      const desc = step.instructions || `Key ingredients: ${step.key_ingredients.join(', ')}`;
      add(name, 'Skincare', desc, Math.max(65, 90 - products.length));
    }
  }

  // 4. Ingredients to use (as skincare search terms)
  if (plan.products_pillar?.ingredients_to_use) {
    for (const ing of plan.products_pillar.ingredients_to_use) {
      add(`${ing} serum`, 'Skincare', `Contains ${ing} — recommended for your skin`, Math.max(60, 85 - products.length));
    }
  }

  // 5. Supplements
  if (plan.diet_pillar?.supplements) {
    for (const supp of plan.diet_pillar.supplements) {
      add(`${supp.name} ${supp.dose}`, 'Supplements', supp.benefit, Math.max(65, 90 - products.length));
    }
  }

  // 6. Foods to eat
  if (plan.diet_pillar?.foods_to_eat) {
    for (const food of plan.diet_pillar.foods_to_eat) {
      add(food.food, 'Foods', food.reason, Math.max(60, 85 - products.length));
    }
  }

  // 7. Herbal remedies
  if (plan.herbal_pillar?.remedies) {
    for (const remedy of plan.herbal_pillar.remedies) {
      add(`${remedy.name} ${remedy.form}`, 'Herbal', remedy.application, Math.max(65, 88 - products.length));
    }
  }

  // 8. Herbal teas
  if (plan.herbal_pillar?.teas) {
    for (const tea of plan.herbal_pillar.teas) {
      add(`${tea.name} tea`, 'Herbal', tea.benefit, Math.max(60, 85 - products.length));
    }
  }

  return products;
}
