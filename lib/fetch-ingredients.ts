/**
 * Fetch real ingredient lists from Open Beauty Facts + Open Food Facts.
 * Free, no API key needed.
 */

const OBF = 'https://world.openbeautyfacts.org';
const OFF = 'https://world.openfoodfacts.org';
const UA = 'GlowSkincare/1.0';

export interface IngredientInfo {
  name: string;
  status: 'good' | 'neutral' | 'concern';
  detail: string;
}

// ═══ COMPREHENSIVE BENEFICIAL INGREDIENTS ═══
const BENEFICIAL: Record<string, string> = {
  // Plant oils
  'jojoba': 'Closely mimics skin sebum. Non-comedogenic moisturizer that balances oil production.',
  'rosehip': 'Natural source of vitamin A (tretinoin precursor) + essential fatty acids. Fades scars, regenerates cells.',
  'argan oil': 'Rich in vitamin E and ferulic acid. Anti-inflammatory, moisturizing, and protective.',
  'hemp seed': 'Balanced omega-3:6 ratio. Anti-inflammatory and non-comedogenic.',
  'sea buckthorn': 'Rich in vitamins A, C, E and rare omega-7. Promotes skin repair and regeneration.',
  'tamanu oil': 'Antibacterial and anti-inflammatory. Traditionally used for wound healing and scar reduction.',
  'squalane': 'Plant-derived (olive/sugarcane). Lightweight, non-comedogenic moisturizer that mimics skin lipids.',
  'olive oil': 'Rich in squalene and oleocanthal. Anti-inflammatory and deeply nourishing.',
  'coconut oil': 'Antimicrobial lauric acid. Best for body use; deeply moisturizing.',
  'marula oil': 'High in antioxidants and oleic acid. Absorbs quickly, deeply hydrating.',
  'baobab oil': 'Rich in vitamins A, D, E, F. Improves elasticity and deeply moisturizes.',
  'camellia oil': 'Japanese beauty staple. Rich in oleic acid, absorbs quickly, anti-aging.',
  'meadowfoam seed': 'Excellent moisture barrier. Stable, non-comedogenic, extends product shelf life naturally.',
  'sunflower seed oil': 'Rich in linoleic acid. Strengthens skin barrier, non-comedogenic for most.',
  'castor oil': 'Ricinoleic acid is anti-inflammatory and antimicrobial. Traditional remedy for skin healing.',

  // Botanical extracts
  'tea tree': 'Clinically proven antibacterial. Comparable to benzoyl peroxide for mild acne, without the harshness.',
  'centella asiatica': 'Also known as Cica/Gotu Kola. Stimulates collagen, calms inflammation, speeds wound healing.',
  'green tea': 'EGCG polyphenols reduce sebum production, fight inflammation, and protect from UV damage.',
  'chamomile': 'Contains bisabolol — anti-inflammatory. Calms irritation, reduces redness, soothes eczema.',
  'calendula': 'Promotes wound healing. Anti-inflammatory, antimicrobial, and gentle enough for babies.',
  'aloe': 'Soothes, hydrates, and promotes healing. Contains 75+ active compounds including vitamins and enzymes.',
  'turmeric': 'Curcumin is a potent anti-inflammatory and antioxidant. Brightens skin and fights acne bacteria.',
  'neem': 'Ayurvedic antibacterial and blood-purifying herb. Used for centuries for skin purification.',
  'witch hazel': 'Natural astringent with tannins. Tightens pores and reduces inflammation.',
  'willow bark': 'Natural source of salicin (converts to salicylic acid). Gentle BHA exfoliation from nature.',
  'bakuchiol': 'Plant-based retinol alternative. Clinically shown to reduce wrinkles and pigmentation without irritation.',
  'licorice root': 'Contains glabridin. Brightens skin, reduces hyperpigmentation, anti-inflammatory.',
  'rosemary': 'Natural preservative with antioxidant and anti-inflammatory properties.',
  'manuka': 'Potent antibacterial (methylglyoxal). Promotes wound healing and supports gut health.',
  'lavender': 'Calming and antiseptic. Promotes healing and reduces scarring.',
  'frankincense': 'Anti-inflammatory boswellic acids. Promotes cell regeneration and reduces scarring.',
  'blue tansy': 'Contains azulene — powerful anti-inflammatory. Calms reactive and acne-prone skin.',
  'elderflower': 'Rich in bioflavonoids. Anti-inflammatory, brightening, and protective.',
  'echinacea': 'Immune-supportive and anti-inflammatory. Helps skin resist bacterial infection.',
  'ginseng': 'Adaptogenic root that boosts circulation, brightens skin, and has anti-aging properties.',
  'mushroom': 'Adaptogenic — tremella, reishi, chaga, cordyceps support skin hydration and immune function.',
  'propolis': 'Bee-derived antibacterial and anti-inflammatory. Accelerates wound healing.',
  'royal jelly': 'Rich in amino acids, vitamins, and fatty acids. Nourishing and collagen-supporting.',
  'spirulina': 'Blue-green algae rich in chlorophyll, protein, and antioxidants. Detoxifying for skin.',

  // Evidence-based actives
  'niacinamide': 'Vitamin B3. Minimizes pores, evens tone, reduces redness, strengthens barrier, regulates sebum.',
  'hyaluronic acid': 'Holds 1000x its weight in water. Multi-depth hydration, plumps fine lines, dewy texture.',
  'glycerin': 'Powerful humectant that draws moisture into skin. Strengthens barrier, prevents dryness.',
  'retinol': 'Vitamin A derivative. Stimulates cell turnover, boosts collagen, reduces wrinkles, fades dark spots.',
  'salicylic acid': 'BHA that penetrates pores to dissolve oil and dead skin. Treats acne, reduces blackheads.',
  'vitamin c': 'Powerful antioxidant that brightens, fades hyperpigmentation, and boosts collagen synthesis.',
  'ascorbic acid': 'Pure Vitamin C. Neutralizes free radicals and stimulates collagen production.',
  'zinc oxide': 'Mineral UV filter. Broad-spectrum sun protection with anti-inflammatory properties.',
  'allantoin': 'Plant-derived (comfrey). Soothes, promotes cell regeneration and wound healing.',
  'madecassoside': 'From centella asiatica. Potent anti-inflammatory, calms redness, promotes repair.',
  'asiaticoside': 'From centella asiatica. Stimulates collagen synthesis and wound healing.',
  'azelaic acid': 'Treats acne, rosacea, and hyperpigmentation. Anti-inflammatory and antibacterial.',
  'lactic acid': 'A gentle AHA. Exfoliates, hydrates, and brightens. Good for sensitive skin.',
  'glycolic acid': 'Smallest AHA. Deep exfoliation, boosts collagen, improves texture.',
  'mandelic acid': 'Larger AHA molecule. Gentle exfoliation, good for darker skin tones and sensitive skin.',
  'ferulic acid': 'Potent antioxidant. Stabilizes and boosts vitamin C and E effectiveness.',
  'kojic acid': 'Natural brightener from fungi. Inhibits melanin production for hyperpigmentation.',
  'collagen': 'Structural protein. Topically retains moisture; ingested supports skin elasticity.',
  'peptide': 'Amino acid chains that signal collagen production. Anti-aging and firming.',
  'sodium hyaluronate': 'Smaller molecule hyaluronic acid. Penetrates deeper for below-surface hydration.',
  'benzoyl peroxide': 'Kills acne bacteria and reduces inflammation. Effective but can be drying.',

  // Traditional / ancestral ingredients
  'tallow': 'Ancestral moisturizer from grass-fed animals. Closely matches human skin lipid profile.',
  'shea butter': 'Rich in vitamins A and E + fatty acids. Deeply moisturizing, anti-inflammatory, barrier repair.',
  'beeswax': 'Natural occlusive that protects and seals moisture. Antibacterial and healing.',
  'lanolin': 'From sheep wool. Closest to human sebum. Intensely moisturizing and barrier-protective.',
  'kaolin': 'Gentle mineral clay. Absorbs excess oil and draws out impurities without stripping.',
  'bentonite': 'Volcanic clay that detoxifies by drawing out impurities. Deep pore cleansing.',
  'colloidal oatmeal': 'FDA-recognized skin protectant. Soothes eczema, reduces itching and inflammation.',
  'honey': 'Natural humectant and antibacterial. Promotes wound healing and locks in moisture.',
  'rice bran': 'Rich in gamma oryzanol, ferulic acid, and vitamin E. Brightening and antioxidant.',
  'seaweed': 'Rich in minerals, vitamins, and amino acids. Hydrating, detoxifying, and anti-inflammatory.',
  'charcoal': 'Activated charcoal draws out impurities and toxins from pores. Deep cleansing.',

  // Fermented / probiotic
  'ferment': 'Fermented ingredients have smaller molecules for better absorption. Probiotic benefits for skin.',
  'lactobacillus': 'Probiotic that supports skin microbiome balance and strengthens barrier.',
  'saccharomyces': 'Fermented yeast extract. Brightening, hydrating, and skin-strengthening.',
  'bifida ferment': 'Probiotic extract that boosts skin immunity and improves barrier function.',
  'probiotics': 'Support skin microbiome. Strengthen barrier, reduce inflammation, calm reactive skin.',
  'kefir': 'Fermented milk with diverse probiotics. Supports gut-skin axis and microbiome health.',

  // Vitamins and minerals
  'tocopherol': 'Vitamin E. Fat-soluble antioxidant that protects cells and supports healing.',
  'panthenol': 'Provitamin B5. Deeply hydrates, reduces redness, accelerates healing, improves elasticity.',
  'retinyl palmitate': 'Gentle vitamin A ester. Milder retinoid for anti-aging and cell renewal.',
  'biotin': 'Vitamin B7. Supports hair, skin, and nail health from within.',
  'zinc': 'Essential mineral. Anti-inflammatory, antibacterial, reduces sebum production.',
  'selenium': 'Antioxidant mineral that protects skin cells from UV and free radical damage.',
  'copper peptide': 'Promotes collagen and elastin production. Wound healing and anti-aging.',
  'magnesium': 'Calming mineral that reduces stress-related skin issues and supports barrier function.',

  // Amino acids and proteins
  'ceramide': 'Lipid naturally found in skin barrier. Restores moisture retention and protects against irritants.',
  'amino acid': 'Building blocks of proteins. Support skin repair, hydration, and barrier function.',
  'arginine': 'Amino acid that promotes wound healing and supports skin barrier repair.',
  'lysine': 'Essential amino acid important for collagen production and tissue repair.',

  // Omega fatty acids
  'omega': 'Essential fatty acids. Maintain barrier integrity, reduce inflammation, keep skin supple.',
  'linoleic acid': 'Omega-6 fatty acid. Essential for barrier function, often depleted in acne-prone skin.',
  'gamma linolenic': 'GLA — omega-6 from evening primrose/borage. Balances hormonal skin issues.',
};

// ═══ COMPREHENSIVE CONCERNING INGREDIENTS ═══
const CONCERNS: Record<string, string> = {
  // Synthetic fragrances
  'fragrance': 'Undisclosed synthetic chemical blend. Top cause of contact dermatitis and potential endocrine disruptor.',
  'parfum': 'Same as fragrance. Can contain dozens of undisclosed chemicals that trigger allergic reactions.',
  'linalool': 'Fragrance component that oxidizes on skin. Common cause of allergic contact dermatitis.',
  'limonene': 'Fragrance terpene that oxidizes and becomes a skin sensitizer over time.',
  // Parabens
  'paraben': 'Synthetic preservative class. May mimic estrogen and disrupt hormonal balance.',
  'methylparaben': 'Paraben preservative with estrogenic activity. Banned in some countries.',
  'propylparaben': 'Paraben with stronger estrogenic activity than methylparaben.',
  'butylparaben': 'Paraben linked to hormone disruption. Found in breast tissue in studies.',
  'ethylparaben': 'Paraben preservative with endocrine disruption concerns.',
  // Formaldehyde releasers
  'formaldehyde': 'Known carcinogen and severe skin sensitizer.',
  'dmdm hydantoin': 'Formaldehyde-releasing preservative. Slowly releases formaldehyde over time.',
  'imidazolidinyl urea': 'Formaldehyde releaser. Can cause contact dermatitis.',
  'diazolidinyl urea': 'Formaldehyde-releasing preservative and skin sensitizer.',
  'quaternium-15': 'Formaldehyde releaser. One of the most common cosmetic contact allergens.',
  'bronopol': 'Releases formaldehyde. Also forms potentially carcinogenic nitrosamines.',
  // Sulfates
  'sodium lauryl sulfate': 'Harsh surfactant that strips natural oils, irritates skin, and disrupts the barrier.',
  'sodium laureth sulfate': 'Ethoxylated surfactant. May contain 1,4-dioxane (carcinogen) as a byproduct.',
  'ammonium lauryl sulfate': 'Aggressive surfactant similar to SLS. Strips barrier and causes irritation.',
  // Petroleum derivatives
  'mineral oil': 'Petroleum-derived occlusive. May contain PAH contaminants. No skin nourishment.',
  'petrolatum': 'Petroleum jelly. Creates artificial barrier with potential contamination concerns.',
  'paraffin': 'Petroleum-derived wax. Comedogenic and provides no skin benefit.',
  'isopropyl myristate': 'Petroleum-derived emollient. Highly comedogenic.',
  // Silicones
  'dimethicone': 'Synthetic silicone. Creates film that can trap bacteria and sebum in pores.',
  'cyclomethicone': 'Volatile silicone with environmental persistence and bioaccumulation concerns.',
  'cyclopentasiloxane': 'Synthetic silicone with bioaccumulation concerns in aquatic environments.',
  'amodimethicone': 'Silicone conditioner. Creates buildup requiring harsh surfactants to remove.',
  // Chemical sunscreens
  'oxybenzone': 'Chemical UV filter. Endocrine disruptor, harmful to coral reefs, detected in bloodstream.',
  'octinoxate': 'Chemical UV filter. Hormone disruption concerns, harmful to coral reefs.',
  'homosalate': 'Chemical sunscreen. Potential endocrine disruptor that accumulates in body.',
  'octocrylene': 'Chemical UV filter. Degrades into benzophenone (potential carcinogen) over time.',
  'avobenzone': 'Chemical UV filter that degrades in sunlight and can generate free radicals.',
  // Synthetic preservatives
  'phenoxyethanol': 'Synthetic preservative. Safer than parabens but can still irritate sensitive skin.',
  'methylisothiazolinone': 'Potent preservative and major contact allergen. Banned in EU leave-on products.',
  'methylchloroisothiazolinone': 'Highly sensitizing preservative. Causes contact dermatitis.',
  // Drying alcohols
  'alcohol denat': 'Denatured alcohol. Strips natural oils, damages barrier, causes dryness.',
  'isopropyl alcohol': 'Drying alcohol that strips oils, irritates skin, compromises the barrier.',
  'sd alcohol': 'Specially denatured alcohol. Same drying and barrier-damaging effects.',
  // PEGs
  'peg-': 'Polyethylene glycol. Ethoxylated — may contain 1,4-dioxane carcinogen. Penetration enhancer.',
  'polysorbate': 'Ethoxylated surfactant. May contain 1,4-dioxane.',
  'ceteareth': 'Ethoxylated emulsifier with 1,4-dioxane contamination potential.',
  // Synthetic colors
  'fd&c': 'Synthetic coal-tar dyes. Potential carcinogens and skin sensitizers.',
  'd&c red': 'Synthetic colorant. May contain heavy metal contaminants.',
  // Other
  'propylene glycol': 'Synthetic penetration enhancer. Can increase absorption of harmful chemicals.',
  'triclosan': 'Antibacterial linked to hormone disruption, antibiotic resistance, thyroid issues.',
  'hydroquinone': 'Skin lightener. Causes rebound hyperpigmentation. Banned in some countries.',
  'toluene': 'Industrial solvent. Neurotoxic with prolonged exposure.',
  'coal tar': 'Known carcinogen. Used in anti-dandruff/psoriasis products.',
  'butylated hydroxytoluene': 'BHT. Synthetic preservative with endocrine disruption concerns.',
  'butylated hydroxyanisole': 'BHA preservative. Potential carcinogen and endocrine disruptor.',
  'diethanolamine': 'DEA. Forms carcinogenic nitrosamines with other ingredients.',
  'triethanolamine': 'TEA. Can cause irritation and form nitrosamines.',
  'phthalate': 'Plasticizer and fragrance solvent. Known endocrine disruptor.',
  'talc': 'Mineral powder. Potential asbestos contamination risk.',
  'resorcinol': 'Synthetic antiseptic. Endocrine disruptor, restricted in EU.',
  'polyacrylamide': 'Can break down into acrylamide, a neurotoxin and potential carcinogen.',
};

function classifyIngredient(name: string): IngredientInfo {
  const lower = name.toLowerCase().trim();

  // Check beneficial
  for (const [key, detail] of Object.entries(BENEFICIAL)) {
    if (lower.includes(key)) {
      return { name, status: 'good', detail };
    }
  }

  // Check concerns
  for (const [key, detail] of Object.entries(CONCERNS)) {
    if (lower.includes(key)) {
      return { name, status: 'concern', detail };
    }
  }

  // Neutral — generic formulation ingredient
  return {
    name,
    status: 'neutral',
    detail: 'A formulation ingredient used for texture, stability, or delivery. Generally well-tolerated.',
  };
}

/**
 * Fetch ingredients for a product by searching Open Beauty Facts / Open Food Facts.
 * Tries by barcode first (if available), then by product name.
 */
export async function fetchIngredients(opts: {
  barcode?: string;
  productName: string;
  brand?: string;
}): Promise<IngredientInfo[]> {
  const { barcode, productName, brand } = opts;

  // Try barcode lookup first
  if (barcode) {
    for (const base of [OBF, OFF]) {
      try {
        const res = await fetch(
          `${base}/api/v2/product/${barcode}?fields=ingredients_text,ingredients_tags`,
          { headers: { 'User-Agent': UA } }
        );
        const data = await res.json();
        if (data.status === 1 && data.product?.ingredients_text) {
          return parseIngredientText(data.product.ingredients_text);
        }
      } catch { /* continue */ }
    }
  }

  // Fall back to name search
  const query = brand ? `${brand} ${productName}` : productName;
  for (const base of [OBF, OFF]) {
    try {
      const res = await fetch(
        `${base}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=1&page_size=3&fields=ingredients_text,product_name`,
        { headers: { 'User-Agent': UA } }
      );
      const data = await res.json();
      const products = data.products || [];
      for (const p of products) {
        if (p.ingredients_text) {
          return parseIngredientText(p.ingredients_text);
        }
      }
    } catch { /* continue */ }
  }

  return [];
}

function parseIngredientText(text: string): IngredientInfo[] {
  // Ingredient lists are comma-separated, sometimes with percentages and nested parens
  return text
    .replace(/\([^)]*\)/g, '') // Remove parenthetical details
    .split(/,|;/)
    .map(s => s.replace(/\d+(\.\d+)?%?/g, '').trim()) // Remove percentages
    .filter(s => s.length > 1)
    .map(name => classifyIngredient(name));
}
