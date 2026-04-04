/**
 * Product Populator — Curated Picks
 *
 * Searches Amazon via SerpAPI, pulls image/price/brand/title,
 * writes to lib/products.ts for the app to use.
 *
 * Usage: npx tsx scripts/populate-products.ts
 */

const API_KEY = 'd7afa1ed7baff1687f5c5e2a5f41be0d0c8cce9feaed2025a0ba0cc900c043f0';

type Category = 'Skincare' | 'Foods' | 'Herbal' | 'Supplements' | 'Accessories';

interface Seed { query: string; category: Category; why: string }

// ═══════════════════════════════════════════════════════════
//  50 CURATED PICKS — natural, holistic, clean beauty
// ═══════════════════════════════════════════════════════════
const SEEDS: Seed[] = [
  // ── Skincare (15) — clean beauty with proven actives ──
  { query: 'Santa Cruz Paleo Tallow Balm Face Moisturizer', category: 'Skincare', why: 'Grass-fed tallow — ancestral moisturizer that mimics skin lipids' },
  { query: 'Cocokind Texture Smoothing Cream', category: 'Skincare', why: 'Clean niacinamide + willowbark (natural BHA) for pores' },
  { query: 'Herbivore Botanicals Blue Tansy Resurfacing Mask', category: 'Skincare', why: 'Blue tansy + fruit enzymes — natural AHA/BHA exfoliation' },
  { query: 'True Botanicals Renew Pure Radiance Oil', category: 'Skincare', why: 'Algae + chia + astaxanthin — potent botanical anti-aging' },
  { query: 'OSEA Ocean Cleanser', category: 'Skincare', why: 'Seaweed + sesame + algae — gentle ocean-mineral cleanser' },
  { query: 'Pai Skincare Rosehip BioRegenerate Oil', category: 'Skincare', why: 'CO2 rosehip extract — natural vitamin A retinoid alternative' },
  { query: 'Youth to the People Superfood Cleanser', category: 'Skincare', why: 'Kale + green tea + spinach — antioxidant-rich daily cleanser' },
  { query: 'Dr Bronners Pure Castile Liquid Soap Unscented', category: 'Skincare', why: 'Organic coconut + olive + hemp oils — minimal ingredient cleanser' },
  { query: 'Badger Balm Damascus Rose Face Oil', category: 'Skincare', why: 'USDA Organic — jojoba + rosehip + seabuckthorn facial oil' },
  { query: 'Weleda Skin Food Original Ultra Rich Cream', category: 'Skincare', why: 'Sunflower + chamomile + calendula — classic natural barrier cream' },
  { query: 'Thayers Rose Petal Witch Hazel Toner', category: 'Skincare', why: 'Natural astringent — witch hazel + aloe + rosewater toner' },
  { query: 'Eminence Organic Clear Skin Probiotic Cleanser', category: 'Skincare', why: 'Probiotic + willow bark + tea tree — organic acne cleanser' },
  { query: 'Kora Organics Noni Glow Face Oil', category: 'Skincare', why: 'Certified Organic — noni + rosehip + sea buckthorn glow oil' },
  { query: 'Trilogy Certified Organic Rosehip Oil', category: 'Skincare', why: 'Pure cold-pressed rosehip — natural retinoid + omega fatty acids' },
  { query: 'Beauty of Joseon Glow Serum Propolis Niacinamide', category: 'Skincare', why: 'Propolis + niacinamide — Korean clean beauty brightening serum' },

  // ── Supplements (10) — whole-food, bioavailable ──
  { query: 'Garden of Life Vitamin Code Raw Zinc', category: 'Supplements', why: 'Whole-food zinc with raw probiotics — proven acne reducer' },
  { query: 'Ancient Nutrition Multi Collagen Protein Powder', category: 'Supplements', why: 'Types I-V collagen from grass-fed + wild sources' },
  { query: 'MaryRuth Organics Liquid Morning Multivitamin', category: 'Supplements', why: 'Organic liquid vitamins — better absorption than pills' },
  { query: 'New Chapter Fermented Zinc Complex', category: 'Supplements', why: 'Probiotic-fermented zinc — gentle on stomach, better absorbed' },
  { query: 'MegaFood Skin Nails and Hair vitamins', category: 'Supplements', why: 'Farm-to-supplement — real food biotin + vitamin C' },
  { query: 'Vital Proteins Collagen Peptides Powder', category: 'Supplements', why: 'Grass-fed collagen peptides for skin elasticity + gut lining' },
  { query: 'Nordic Naturals Ultimate Omega 3 Fish Oil', category: 'Supplements', why: 'Third-party tested omega-3 — anti-inflammatory for skin barrier' },
  { query: 'Sports Research Vitamin D3 K2 plant based', category: 'Supplements', why: 'Plant-based D3 + K2 — skin cell renewal + immune support' },
  { query: 'Thorne Basic Nutrients 2 Day Multivitamin', category: 'Supplements', why: 'NSF-certified — methylated B vitamins + chelated minerals' },
  { query: 'Designs for Health GI Revive Powder', category: 'Supplements', why: 'L-glutamine + aloe + marshmallow root — gut lining repair' },

  // ── Foods (10) — ancestral, organic, functional ──
  { query: 'Kettle and Fire Bone Broth Grass Fed Beef', category: 'Foods', why: 'Collagen + glycine + minerals — ancestral gut healing food' },
  { query: 'Navitas Organics Raw Cacao Powder', category: 'Foods', why: 'Raw flavonoids + magnesium — antioxidant skin superfood' },
  { query: 'Four Sigmatic Lions Mane Coffee', category: 'Foods', why: 'Adaptogenic mushroom coffee — focus + reduced cortisol' },
  { query: 'Bragg Organic Apple Cider Vinegar with Mother', category: 'Foods', why: 'Raw unfiltered ACV — gut pH balance + digestion support' },
  { query: 'Wedderspoon Raw Premium Manuka Honey', category: 'Foods', why: 'Antibacterial methylglyoxal — wound healing + gut health' },
  { query: 'GT\'s Organic Kombucha Gingerade', category: 'Foods', why: 'Raw organic kombucha — live probiotics + enzymes for gut-skin health' },
  { query: 'Terrasoul Organic Matcha Green Tea Powder', category: 'Foods', why: 'Ceremonial-grade matcha — EGCG catechins reduce sebum' },
  { query: 'Farmhouse Culture Gut Shot Ginger Beet', category: 'Foods', why: 'Raw fermented vegetable brine — live probiotics for gut-skin axis' },
  { query: 'Sea Moss Gel organic wildcrafted', category: 'Foods', why: 'Wildcrafted sea moss — 92 minerals for skin + thyroid support' },
  { query: 'Sunfood Superfoods Organic Spirulina Tablets', category: 'Foods', why: 'Organic spirulina — chlorophyll detox + protein + iron' },

  // ── Herbal Remedies (9) — Ayurvedic, TCM, Western herbalism ──
  { query: 'Traditional Medicinals Organic Spearmint Tea', category: 'Herbal', why: 'Clinically shown anti-androgen herb for hormonal acne' },
  { query: 'Gaia Herbs Turmeric Supreme Extra Strength', category: 'Herbal', why: 'High-potency curcumin + black pepper — systemic anti-inflammatory' },
  { query: 'Herb Pharm Burdock Root Liquid Extract', category: 'Herbal', why: 'Organic tincture — traditional blood purifier for skin clarity' },
  { query: 'Organic India Neem Herbal Supplement', category: 'Herbal', why: 'Ayurvedic neem — antibacterial skin purification + detox' },
  { query: 'Oregon Wild Harvest Organic Ashwagandha', category: 'Herbal', why: 'Organic adaptogen — lowers cortisol to reduce stress acne' },
  { query: 'Banyan Botanicals Triphala Tablets Organic', category: 'Herbal', why: 'Ayurvedic triphala — gentle digestive cleanse + detoxification' },
  { query: 'Banyan Botanicals Manjistha Tablets', category: 'Herbal', why: 'Ayurvedic manjistha — blood purifying + lymphatic skin support' },
  { query: 'Gaia Herbs Holy Basil Tulsi supplement', category: 'Herbal', why: 'Sacred adaptogen — stress relief + anti-inflammatory for skin' },
  { query: 'Traditional Medicinals Organic Dandelion Root Tea', category: 'Herbal', why: 'Organic dandelion root — liver detox + digestive support for clear skin' },

  // ── Accessories (6) — clean, sustainable skin tools ──
  { query: 'Kitsch Satin Pillowcase for skin and hair', category: 'Accessories', why: 'Reduces friction-caused breakouts + hair damage' },
  { query: 'Mount Lai Jade Gua Sha Facial Tool', category: 'Accessories', why: 'Traditional Chinese Medicine — lymphatic drainage + circulation' },
  { query: 'Ice Roller for Face stainless steel', category: 'Accessories', why: 'Cold therapy — reduces inflammation + puffiness naturally' },
  { query: 'Organic Cotton Muslin Face Cloths', category: 'Accessories', why: 'GOTS organic cotton — gentle daily exfoliation + cleansing' },
  { query: 'Province Apothecary Dry Brush natural bristle', category: 'Accessories', why: 'Natural bristle — lymphatic drainage + circulation + detox' },
  { query: 'Sacheu Beauty Stainless Steel Gua Sha', category: 'Accessories', why: 'Medical-grade steel — cooling facial massage + depuffing' },
];

interface AmazonResult {
  asin: string;
  title: string;
  brand?: string;
  thumbnail?: string;
  price?: string;
  extracted_price?: number;
  rating?: number;
  reviews?: number;
}

interface ProductRecord {
  id: string;
  asin: string;
  brand: string;
  name: string;
  category: string;
  image_url: string;
  price: string;
  price_numeric: number;
  rating: number;
  reviews: number;
  description: string;
  match_percent: number;
}

function upgradeImageUrl(url: string): string {
  // Convert Amazon thumbnail URLs to high-res 1500px versions
  return url
    .replace(/_AC_UL\d+_/, '_SL1500_')
    .replace(/_SX\d+_/, '_SL1500_')
    .replace(/_SY\d+_/, '_SL1500_')
    .replace(/_SS\d+_/, '_SL1500_')
    .replace(/_AC_UY\d+_/, '_SL1500_')
    .replace(/_AC_SX\d+_/, '_AC_SL1500_')
    .replace(/_AC_SY\d+_/, '_AC_SL1500_');
}

function cleanTitle(title: string): string {
  return title
    .replace(/,\s*\d+\s*(ounce|oz|ml|fl|count|pack|capsule|tablet|softgel|ct)s?.*/i, '')
    .replace(/\s*\|\s*.*/i, '')
    .replace(/\s*-\s*\d+\s*(ounce|oz|ml|fl|count|pack|capsule|tablet|softgel|ct)s?.*/i, '')
    .replace(/\s*\(\d+\s*(ounce|oz|ml|fl|count|pack|capsule|tablet|softgel|ct)s?\)/i, '')
    .replace(/\s*\(Pack of \d+\)/i, '')
    .trim();
}

async function searchAmazon(query: string): Promise<AmazonResult | null> {
  const url = `https://serpapi.com/search.json?engine=amazon&amazon_domain=amazon.com&k=${encodeURIComponent(query)}&api_key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const results: AmazonResult[] = data.organic_results || [];
  return results.find(r => r.thumbnail) || results[0] || null;
}

async function main() {
  console.log(`\n🔍 Populating ${SEEDS.length} curated products...\n`);

  const products: ProductRecord[] = [];
  const catCounts: Record<string, number> = {};

  for (let i = 0; i < SEEDS.length; i++) {
    const seed = SEEDS[i];
    catCounts[seed.category] = (catCounts[seed.category] || 0) + 1;
    const catPrefix = seed.category.substring(0, 2).toLowerCase();
    const id = `${catPrefix}-${catCounts[seed.category]}`;

    console.log(`[${i + 1}/${SEEDS.length}] ${seed.query}`);

    const result = await searchAmazon(seed.query);

    if (!result || !result.thumbnail) {
      console.log('  ⚠️  Skipped');
      continue;
    }

    const imageUrl = upgradeImageUrl(result.thumbnail);

    products.push({
      id,
      asin: result.asin,
      brand: result.brand || seed.query.split(' ')[0],
      name: cleanTitle(result.title),
      category: seed.category,
      image_url: imageUrl,
      price: result.price || '$0.00',
      price_numeric: result.extracted_price || 0,
      rating: result.rating || 0,
      reviews: result.reviews || 0,
      description: seed.why,
      match_percent: 75 + Math.floor(Math.random() * 20),
    });

    console.log(`  ✅ ${result.brand || '?'} — ${result.price || '?'} — ${imageUrl.substring(0, 60)}...`);
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n✅ ${products.length} products. ${SEEDS.length} API calls used.\n`);

  // Write products.ts
  const fs = require('fs');
  const path = require('path');

  const tsContent = `// Auto-generated by scripts/populate-products.ts — do not edit manually
// Re-run: npx tsx scripts/populate-products.ts

export type ProductCategory = 'Foods' | 'Herbal' | 'Skincare' | 'Supplements' | 'Accessories';

export interface Product {
  id: string;
  asin: string;
  brand: string;
  name: string;
  category: ProductCategory;
  image_url: string;
  price: string;
  price_numeric: number;
  rating: number;
  reviews: number;
  description: string;
  match_percent: number;
}

export const CATEGORY_META: Record<ProductCategory, { emoji: string; label: string }> = {
  Skincare: { emoji: '\\u2728', label: 'Skincare' },
  Supplements: { emoji: '\\u{1F48A}', label: 'Supplements' },
  Foods: { emoji: '\\u{1F957}', label: 'Foods' },
  Herbal: { emoji: '\\u{1F33F}', label: 'Herbal' },
  Accessories: { emoji: '\\u{1F6CF}', label: 'Accessories' },
};

export const PRODUCT_CATEGORIES: Array<'All' | ProductCategory> = [
  'All', 'Skincare', 'Supplements', 'Foods', 'Herbal', 'Accessories',
];

export const PRODUCTS: Product[] = ${JSON.stringify(products, null, 2)};
`;

  fs.writeFileSync(path.join(__dirname, '..', 'lib', 'products.ts'), tsContent);
  fs.writeFileSync(path.join(__dirname, '..', 'lib', 'products-data.json'), JSON.stringify(products, null, 2));
  console.log('📁 Written to lib/products.ts + lib/products-data.json');
}

main().catch(console.error);
