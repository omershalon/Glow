import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Dimensions, Linking, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Shadows } from '@/lib/theme';
import { PRODUCTS, CATEGORY_META } from '@/lib/products';
import type { Product } from '@/lib/products';
import { cleanProductName } from '@/lib/clean-product-name';
import { fetchIngredients } from '@/lib/fetch-ingredients';
import type { IngredientInfo } from '@/lib/fetch-ingredients';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Categories that should show ingredients (consumable/topical products)
const INGREDIENT_CATEGORIES = new Set(['Skincare', 'Supplements', 'Foods', 'Herbal']);

// Composition tags — static for now, could come from scan data later
const COMPOSITION_TAGS = [
  { label: 'Vegan', good: true },
  { label: 'Cruelty Free', good: true },
  { label: 'Fragrance Free', good: true },
  { label: 'Paraben Free', good: true },
  { label: 'Silicone Free', good: true },
  { label: 'Sulfate Free', good: true },
];

const KEY_BENEFITS = ['Hydration', 'Soothing', 'Anti-Aging', 'Barrier Repair'];

export default function ProductDetailsScreen() {
  const params = useLocalSearchParams<{ id: string; data?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [ingredientFilter, setIngredientFilter] = useState<'all' | 'beneficial' | 'concerns'>('all');
  const [expandedIngredient, setExpandedIngredient] = useState<number | null>(null);
  const [ingredients, setIngredients] = useState<IngredientInfo[]>([]);
  const [ingredientsLoading, setIngredientsLoading] = useState(false);

  const product: Product | null = params.data
    ? (() => { try { return JSON.parse(params.data) as Product; } catch { return null; } })()
    : PRODUCTS.find((p) => p.id === params.id) || null;

  // Fetch real ingredients from Open Food/Beauty Facts
  useEffect(() => {
    if (!product || !INGREDIENT_CATEGORIES.has(product.category)) return;
    setIngredientsLoading(true);
    fetchIngredients({
      barcode: product.asin || undefined, // asin isn't a barcode but try anyway
      productName: product.name,
      brand: product.brand,
    })
      .then(setIngredients)
      .catch(() => setIngredients([]))
      .finally(() => setIngredientsLoading(false));
  }, [product?.id]);

  if (!product) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 20, paddingTop: insets.top + 12 }}>
          <Text style={{ fontSize: 16, color: '#2D4A3E', fontWeight: '600' }}>{'\u2039'} Back</Text>
        </TouchableOpacity>
        <Text style={styles.errorText}>Product not found</Text>
      </View>
    );
  }

  const showIngredients = INGREDIENT_CATEGORIES.has(product.category);
  const beneficialCount = ingredients.filter(i => i.status === 'good').length;
  const concernCount = ingredients.filter(i => i.status === 'concern').length;

  const filteredIngredients = ingredients.filter(i => {
    if (ingredientFilter === 'all') return true;
    if (ingredientFilter === 'beneficial') return i.status === 'good';
    return i.status === 'concern';
  });

  const concerns = ingredients.filter(i => i.status === 'concern');

  const amazonUrl = product.asin
    ? `https://www.amazon.com/dp/${product.asin}`
    : `https://www.amazon.com/s?k=${encodeURIComponent((product.brand || '') + ' ' + product.name)}`;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Nav bar */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.navBack}>{'\u2039'}</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>Product Details</Text>
        <View style={styles.navRight}>
          <TouchableOpacity style={styles.navBtn} activeOpacity={0.7}>
            <Text style={styles.navIcon}>{'\u2661'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navBtn} activeOpacity={0.7}>
            <Text style={styles.navIcon}>{'\u{1F4E4}'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Safety Rating / Skin Match toggle */}
        <View style={styles.toggle}>
          <TouchableOpacity style={[styles.toggleTab, styles.toggleActive]} activeOpacity={0.8}>
            <Text style={styles.toggleActiveText}>Safety Rating</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.toggleTab, styles.toggleInactive]} activeOpacity={0.8}>
            <Text style={styles.toggleInactiveText}>{'\u{1F512}'} Skin Match</Text>
          </TouchableOpacity>
        </View>

        {/* Product image */}
        <View style={styles.imageSection}>
          <View style={styles.imageBg} />
          {product.image_url ? (
            <Image source={{ uri: product.image_url }} style={styles.productImage} resizeMode="contain" />
          ) : (
            <Text style={styles.imageEmoji}>{CATEGORY_META[product.category]?.emoji || '\u2728'}</Text>
          )}
        </View>

        {/* Brand + category */}
        <View style={styles.brandRow}>
          <Text style={styles.brandName}>{product.brand}</Text>
          {product.brand ? <Text style={styles.brandArrow}>{' \u203A'}</Text> : null}
          <View style={styles.categoryChip}>
            <Text style={styles.categoryChipText}>{product.category}</Text>
          </View>
        </View>

        {/* Product name */}
        <Text style={styles.productName}>{cleanProductName(product.name, product.brand || '')}</Text>

        {/* Buy Online button */}
        <TouchableOpacity style={styles.buyBtn} activeOpacity={0.85} onPress={() => Linking.openURL(amazonUrl)}>
          <Text style={styles.buyIcon}>{'\u{1F6D2}'}</Text>
          <Text style={styles.buyText}>Buy Online</Text>
        </TouchableOpacity>

        {/* ═══ Product Snapshot Card ═══ */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Product Snapshot</Text>

          {/* Key Benefits */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionEmoji}>{'\u2B50'}</Text>
              <Text style={styles.sectionLabel}>KEY BENEFITS</Text>
            </View>
            <View style={styles.benefitsGrid}>
              {KEY_BENEFITS.map(b => (
                <View key={b} style={styles.benefitItem}>
                  <Text style={styles.benefitStar}>{'\u2B50'}</Text>
                  <Text style={styles.benefitText}>{b}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Composition */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionEmoji}>{'\u2705'}</Text>
              <Text style={styles.sectionLabel}>COMPOSITION</Text>
            </View>
            <View style={styles.compositionGrid}>
              {COMPOSITION_TAGS.map(tag => (
                <View key={tag.label} style={styles.compositionItem}>
                  <View style={[styles.compositionDot, tag.good ? styles.dotGood : styles.dotBad]}>
                    <Text style={styles.dotIcon}>{tag.good ? '\u2713' : '\u2715'}</Text>
                  </View>
                  <Text style={[styles.compositionText, tag.good ? styles.textGood : styles.textBad]}>
                    {tag.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ═══ Ingredient Concerns Card ═══ */}
        {showIngredients && concerns.length > 0 && (
          <View style={styles.concernsCard}>
            <View style={styles.concernsHeader}>
              <Text style={styles.concernsIcon}>{'\u26A0\uFE0F'}</Text>
              <Text style={styles.concernsTitle}>Ingredient Concerns</Text>
            </View>
            {concerns.map(c => (
              <View key={c.name} style={styles.concernItem}>
                <View style={styles.concernDot}>
                  <Text style={styles.concernX}>{'\u2715'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.concernName}>{c.name}</Text>
                  <Text style={styles.concernDetail}>{c.detail}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ═══ Ingredients List ═══ */}
        {showIngredients && <View style={styles.ingredientsSection}>
          <View style={styles.ingredientsHeader}>
            <Text style={styles.ingredientsTitle}>Ingredients</Text>
            <Text style={styles.ingredientsCount}>{ingredients.length} total</Text>
          </View>

          {/* Filter tabs */}
          <View style={styles.filterRow}>
            {[
              { key: 'all' as const, label: `All (${ingredients.length})` },
              { key: 'beneficial' as const, label: `Beneficial (${beneficialCount})` },
              { key: 'concerns' as const, label: `Concerns (${concernCount})` },
            ].map(f => (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterTab, ingredientFilter === f.key && styles.filterTabActive]}
                onPress={() => setIngredientFilter(f.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterTabText, ingredientFilter === f.key && styles.filterTabTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Loading state */}
          {ingredientsLoading && (
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <ActivityIndicator size="small" color="#2D4A3E" />
              <Text style={{ fontSize: 13, color: '#9B9488', marginTop: 8 }}>Loading ingredients...</Text>
            </View>
          )}

          {/* No ingredients found */}
          {!ingredientsLoading && ingredients.length === 0 && (
            <Text style={{ fontSize: 13, color: '#9B9488', fontStyle: 'italic', paddingVertical: 12 }}>
              Ingredient data not available for this product.
            </Text>
          )}

          {/* Ingredient cards */}
          {filteredIngredients.map((ing, i) => (
            <TouchableOpacity
              key={`${ing.name}-${i}`}
              style={styles.ingredientCard}
              activeOpacity={0.8}
              onPress={() => setExpandedIngredient(expandedIngredient === i ? null : i)}
            >
              <View style={styles.ingredientRow}>
                <View style={[
                  styles.ingredientDot,
                  ing.status === 'good' ? styles.ingredientDotGood :
                  ing.status === 'concern' ? styles.ingredientDotConcern :
                  styles.ingredientDotNeutral,
                ]} />
                <Text style={styles.ingredientName}>{ing.name}</Text>
                <Text style={styles.ingredientChevron}>
                  {expandedIngredient === i ? '\u2303' : '\u2304'}
                </Text>
              </View>
              {expandedIngredient === i && (
                <Text style={styles.ingredientDetail}>{ing.detail}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF8F2' },
  errorText: { fontSize: 16, color: '#9B9488', textAlign: 'center', marginTop: 100 },

  // Nav
  navBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  navBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F0EBE2', alignItems: 'center', justifyContent: 'center',
  },
  navBack: { fontSize: 28, color: Colors.text, marginTop: -2, fontWeight: '300' },
  navTitle: { fontSize: 16, fontWeight: '600', color: Colors.text },
  navRight: { flexDirection: 'row', gap: 8 },
  navIcon: { fontSize: 17, color: Colors.text },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },

  // Toggle
  toggle: {
    flexDirection: 'row', backgroundColor: '#F0EBE2',
    borderRadius: 16, padding: 4, marginBottom: 16,
  },
  toggleTab: { flex: 1, paddingVertical: 14, borderRadius: 13, alignItems: 'center' },
  // Product image
  imageSection: {
    alignItems: 'center', justifyContent: 'center',
    height: SCREEN_WIDTH * 0.65, marginBottom: 16, position: 'relative',
  },
  imageBg: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.6, height: SCREEN_WIDTH * 0.5,
    borderRadius: SCREEN_WIDTH * 0.25,
    backgroundColor: '#C5CEB5', opacity: 0.3,
    transform: [{ rotate: '-12deg' }],
  },
  productImage: { width: SCREEN_WIDTH * 0.42, height: SCREEN_WIDTH * 0.56 },
  imageEmoji: { fontSize: 64 },

  // Brand row
  brandRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6,
  },
  brandName: {
    fontSize: 13, fontWeight: '600', color: '#8B8175',
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  brandArrow: { fontSize: 16, color: '#8B8175', fontWeight: '300' },
  categoryChip: {
    backgroundColor: '#F0EBE2', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10,
  },
  categoryChipText: { fontSize: 12, fontWeight: '500', color: '#6B6358' },

  // Product name
  productName: {
    fontSize: 26, fontWeight: '700', color: Colors.text,
    lineHeight: 32, marginBottom: 18,
  },

  toggleActive: { backgroundColor: '#7B8F6B', ...Shadows.xs },
  toggleInactive: { backgroundColor: 'transparent' },
  toggleActiveText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  toggleInactiveText: { fontSize: 14, fontWeight: '500', color: '#9B9183' },

  // Buy button
  buyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#4A5A3C', borderRadius: 14, paddingVertical: 16,
    gap: 8, marginBottom: 20, ...Shadows.sm,
  },
  buyIcon: { fontSize: 18 },
  buyText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },

  // ═══ Product Snapshot Card ═══
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20,
    marginBottom: 16, ...Shadows.sm,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 20 },

  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionEmoji: { fontSize: 14 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#8B8175', letterSpacing: 1.2 },

  // Benefits
  benefitsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  benefitItem: { flexDirection: 'row', alignItems: 'center', width: '50%', gap: 8, marginBottom: 12 },
  benefitStar: { fontSize: 13 },
  benefitText: { fontSize: 14, fontWeight: '500', color: Colors.text },

  // Composition
  compositionGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  compositionItem: { flexDirection: 'row', alignItems: 'center', width: '50%', gap: 8, marginBottom: 12 },
  compositionDot: {
    width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
  },
  dotGood: { backgroundColor: '#E8F5E9' },
  dotBad: { backgroundColor: '#FDEAEA' },
  dotIcon: { fontSize: 11, fontWeight: '700' },
  compositionText: { fontSize: 13, fontWeight: '500' },
  textGood: { color: '#4CAF87' },
  textBad: { color: '#C84040' },

  // ═══ Ingredient Concerns Card ═══
  concernsCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20,
    marginBottom: 16, borderWidth: 1, borderColor: '#F5D5D5',
  },
  concernsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  concernsIcon: { fontSize: 16 },
  concernsTitle: { fontSize: 16, fontWeight: '700', color: '#C84040' },
  concernItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFF5F5', borderRadius: 14, padding: 16, marginBottom: 10,
  },
  concernDot: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#FDEAEA', alignItems: 'center', justifyContent: 'center',
  },
  concernX: { fontSize: 12, color: '#C84040', fontWeight: '700' },
  concernName: { fontSize: 15, fontWeight: '600', color: '#C84040' },
  concernDetail: { fontSize: 12, color: '#9B7070', marginTop: 4, lineHeight: 18 },

  // ═══ Ingredients List ═══
  ingredientsSection: { marginTop: 8 },
  ingredientsHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14,
  },
  ingredientsTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  ingredientsCount: { fontSize: 13, color: '#9B9488' },

  // Filter tabs
  filterRow: {
    flexDirection: 'row', backgroundColor: '#F5F0E8', borderRadius: 12,
    padding: 3, marginBottom: 16,
  },
  filterTab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  filterTabActive: { backgroundColor: '#FFFFFF', ...Shadows.xs },
  filterTabText: { fontSize: 12, fontWeight: '600', color: '#9B9488' },
  filterTabTextActive: { color: Colors.text },

  // Ingredient cards
  ingredientCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14,
    padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#F0EBE2',
  },
  ingredientRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ingredientDot: { width: 10, height: 10, borderRadius: 5 },
  ingredientDotGood: { backgroundColor: '#4CAF87' },
  ingredientDotConcern: { backgroundColor: '#E8A838' },
  ingredientDotNeutral: { backgroundColor: '#C4BDB0' },
  ingredientName: { flex: 1, fontSize: 15, fontWeight: '500', color: Colors.text },
  ingredientChevron: { fontSize: 16, color: '#C4BDB0' },
  ingredientDetail: { fontSize: 13, color: '#8A8A7A', lineHeight: 20, marginTop: 10, paddingLeft: 22 },
});
