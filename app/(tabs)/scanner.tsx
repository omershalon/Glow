import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Shadows } from '@/lib/theme';
import type { Database } from '@/lib/database.types';
import { PRODUCTS, PRODUCT_CATEGORIES, CATEGORY_META } from '@/lib/products';
import type { Product, ProductCategory } from '@/lib/products';
import { searchProducts } from '@/lib/product-search';
import ProductCard from '@/components/ProductCard';

type ProductScan = Database['public']['Tables']['product_scans']['Row'];

const FREE_SCAN_LIMIT = 3;
const CARD_GAP = 14;
const SEARCH_DEBOUNCE = 600;

export default function ScannerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [scansUsed, setScansUsed] = useState(0);
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'premium'>('free');
  const [showPaywall, setShowPaywall] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'All' | ProductCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);

    if (!text.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      setIsSearching(false);
      return;
    }

    // Debounced API search for 3+ chars
    if (text.trim().length >= 3) {
      setIsSearching(true);
      searchTimer.current = setTimeout(async () => {
        try {
          const results = await searchProducts(text.trim());
          setSearchResults(results);
          setHasSearched(true);
        } catch {
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      }, SEARCH_DEBOUNCE);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setHasSearched(false);
    setIsSearching(false);
    if (searchTimer.current) clearTimeout(searchTimer.current);
  };

  const loadUserData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const profileRes = await supabase
      .from('profiles')
      .select('product_scans_used, subscription_tier')
      .eq('id', user.id)
      .single();
    if (profileRes.data) {
      setScansUsed(profileRes.data.product_scans_used || 0);
      setSubscriptionTier(profileRes.data.subscription_tier as 'free' | 'premium');
    }
  }, []);

  useEffect(() => { loadUserData(); }, [loadUserData]);

  const checkScanLimit = (): boolean => {
    if (subscriptionTier === 'premium') return true;
    if (scansUsed >= FREE_SCAN_LIMIT) { setShowPaywall(true); return false; }
    return true;
  };

  const handleBarcodeScan = async (barcode: string) => {
    if (!checkScanLimit() || !barcode.trim()) return;
    setScanning(false);
    setAnalyzing(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const scanResult = await supabase.functions.invoke('scan-product', {
        body: { barcode: barcode.trim(), user_id: user.id },
      });
      if (scanResult.error) throw scanResult.error;
      await supabase.from('profiles').update({ product_scans_used: scansUsed + 1 }).eq('id', user.id);
      setScansUsed(prev => prev + 1);
    } catch (err) {
      console.error('Scan error:', err);
      Alert.alert('Scan failed', 'Could not analyze this product. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const startCamera = async () => {
    if (!checkScanLimit()) return;
    if (!permission?.granted) await requestPermission();
    setScanning(true);
  };

  // Show search results if we have them, otherwise filter curated picks
  const isLiveSearch = hasSearched && searchResults.length > 0;

  const filteredPicks = PRODUCTS
    .filter((p) => {
      const matchesFilter = activeFilter === 'All' || p.category === activeFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = !q ||
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    })
    .sort((a, b) => b.match_percent - a.match_percent);

  const displayProducts = isLiveSearch ? searchResults : filteredPicks;

  const handleProductPress = (product: Product) => {
    router.push({
      pathname: '/product/[id]',
      params: {
        id: product.id,
        data: JSON.stringify(product),
      },
    });
  };

  // Camera overlay
  if (scanning && permission?.granted) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'] }}
            onBarcodeScanned={({ data }) => handleBarcodeScan(data)}
          />
          <View style={styles.scannerOverlay}>
            <View style={styles.scannerFrame}>
              <View style={[styles.corner, { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 }]} />
              <View style={[styles.corner, { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 }]} />
              <View style={[styles.corner, { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 }]} />
              <View style={[styles.corner, { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 }]} />
            </View>
            <Text style={styles.scanLabel}>Point camera at barcode</Text>
          </View>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setScanning(false)}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const counts: Record<string, number> = { All: PRODUCTS.length };
  for (const p of PRODUCTS) counts[p.category] = (counts[p.category] || 0) + 1;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Shop</Text>
        <Text style={styles.subtitle}>Curated for skin health</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollInner} showsVerticalScrollIndicator={false}>
        {/* Search */}
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>{'\u{1F50E}'}</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search skincare, supplements, foods..."
            placeholderTextColor="#B5AFA5"
            value={searchQuery}
            onChangeText={handleSearchChange}
            returnKeyType="search"
          />
          {isSearching && <ActivityIndicator size="small" color="#2D4A3E" style={{ marginRight: 4 }} />}
          {searchQuery.length > 0 && !isSearching && (
            <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.clearIcon}>{'\u2715'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Category tabs — hide during live search */}
        {!isLiveSearch && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow} style={styles.tabsScroll}>
          {PRODUCT_CATEGORIES.map((cat) => {
            const active = activeFilter === cat;
            const meta = cat === 'All' ? null : CATEGORY_META[cat];
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setActiveFilter(cat)}
                activeOpacity={0.8}
              >
                {meta && <Text style={styles.tabEmoji}>{meta.emoji}</Text>}
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                  {cat === 'All' ? 'All' : meta!.label}
                </Text>
                <View style={[styles.countBubble, active && styles.countBubbleActive]}>
                  <Text style={[styles.countText, active && styles.countTextActive]}>{counts[cat] || 0}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>}

        {/* Section heading */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>
            {isLiveSearch ? `Results for "${searchQuery}"` : activeFilter === 'All' ? 'Our Picks' : CATEGORY_META[activeFilter].label}
          </Text>
          <Text style={styles.sectionCount}>{displayProducts.length} items</Text>
        </View>

        {/* Search hint */}
        {searchQuery.trim().length > 0 && searchQuery.trim().length < 3 && !isSearching && (
          <Text style={styles.searchHint}>Type 3+ characters to search</Text>
        )}

        {analyzing && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#2D4A3E" />
            <Text style={styles.loadingText}>Analyzing product...</Text>
          </View>
        )}

        {/* Product grid */}
        <View style={styles.grid}>
          {displayProducts.map((product, i) => (
            <View key={product.id} style={[styles.gridCell, i % 2 === 0 ? { marginRight: CARD_GAP / 2 } : { marginLeft: CARD_GAP / 2 }]}>
              <ProductCard product={product} onPress={handleProductPress} />
            </View>
          ))}
        </View>

        {displayProducts.length === 0 && !analyzing && !isSearching && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>{'\u{1F50D}'}</Text>
            <Text style={styles.emptyTitle}>{hasSearched ? 'No results found' : 'No matching picks'}</Text>
            <Text style={styles.emptyBody}>{hasSearched ? 'Try different keywords.' : 'Try a different search or category.'}</Text>
          </View>
        )}

        {/* Scan CTA */}
        <TouchableOpacity style={styles.scanCta} onPress={startCamera} activeOpacity={0.88}>
          <View style={styles.scanCtaIcon}>
            <View style={[styles.ctaCorner, { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2 }]} />
            <View style={[styles.ctaCorner, { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2 }]} />
            <View style={[styles.ctaCorner, { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2 }]} />
            <View style={[styles.ctaCorner, { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2 }]} />
          </View>
          <View>
            <Text style={styles.scanCtaTitle}>Scan a product</Text>
            <Text style={styles.scanCtaSub}>Point your camera at a barcode</Text>
          </View>
          <Text style={styles.scanCtaArrow}>{'\u203A'}</Text>
        </TouchableOpacity>
      </ScrollView>

      {showPaywall && (
        <View style={styles.paywallOverlay}>
          <View style={styles.paywallCard}>
            <Text style={styles.paywallEmoji}>{'\u{1F512}'}</Text>
            <Text style={styles.paywallTitle}>You've used your free scans</Text>
            <Text style={styles.paywallBody}>Upgrade to Premium for unlimited product scans and personalized AI analysis.</Text>
            <TouchableOpacity style={styles.upgradeBtn} activeOpacity={0.85}>
              <Text style={styles.upgradeText}>Upgrade for $9.99/month</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowPaywall(false)}>
              <Text style={styles.dismissText}>Maybe later</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F5' },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  title: { fontSize: 30, fontWeight: '700', color: '#1C1C1A', letterSpacing: -0.4 },
  subtitle: { fontSize: 14, color: '#9B9488', marginTop: 2 },
  scroll: { flex: 1 },
  scrollInner: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 130 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F2EDE6', borderRadius: 14,
    paddingHorizontal: 14, height: 48, marginBottom: 14,
  },
  searchIcon: { fontSize: 15, opacity: 0.45, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#1C1C1A', height: 48 },
  clearIcon: { fontSize: 13, color: '#9B9488', padding: 4 },
  searchHint: { fontSize: 12, color: '#B5AFA5', marginBottom: 12, fontStyle: 'italic' },

  tabsScroll: { marginHorizontal: -20, marginBottom: 22 },
  tabsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 24, backgroundColor: '#F2EDE6',
  },
  tabActive: { backgroundColor: '#2D4A3E' },
  tabEmoji: { fontSize: 14 },
  tabLabel: { fontSize: 13, fontWeight: '600', color: '#6B6358' },
  tabLabelActive: { color: '#FFFFFF' },
  countBubble: {
    backgroundColor: '#E4DED5', borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 1, minWidth: 22, alignItems: 'center',
  },
  countBubbleActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  countText: { fontSize: 11, fontWeight: '700', color: '#8A8478' },
  countTextActive: { color: '#FFFFFF' },

  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#1C1C1A', letterSpacing: -0.2 },
  sectionCount: { fontSize: 13, color: '#9B9488' },

  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  loadingText: { fontSize: 13, color: '#2D4A3E', fontWeight: '500' },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridCell: { marginBottom: CARD_GAP },

  empty: { alignItems: 'center', paddingVertical: 48, gap: 6 },
  emptyIcon: { fontSize: 36, opacity: 0.35, marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#1C1C1A' },
  emptyBody: { fontSize: 13, color: '#9B9488' },

  scanCta: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFFFFF', borderRadius: 16,
    padding: 18, marginTop: 8, ...Shadows.sm,
  },
  scanCtaIcon: { width: 28, height: 28, position: 'relative' },
  ctaCorner: { position: 'absolute', width: 9, height: 9, borderColor: '#2D4A3E', borderRadius: 1 },
  scanCtaTitle: { fontSize: 14, fontWeight: '600', color: '#1C1C1A' },
  scanCtaSub: { fontSize: 12, color: '#9B9488', marginTop: 1 },
  scanCtaArrow: { fontSize: 22, color: '#C4BDB0', marginLeft: 'auto', fontWeight: '300' },

  cameraContainer: { flex: 1, position: 'relative' },
  camera: { flex: 1 },
  scannerOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.45)',
  },
  scannerFrame: { width: 240, height: 140, position: 'relative' },
  corner: { position: 'absolute', width: 26, height: 26, borderColor: '#FFFFFF' },
  scanLabel: { fontSize: 14, color: '#FFFFFF', marginTop: 18, opacity: 0.85 },
  cancelBtn: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center' },
  cancelText: {
    fontSize: 15, fontWeight: '600', color: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 28, paddingVertical: 12,
    borderRadius: 100, overflow: 'hidden',
  },

  paywallOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(28,28,26,0.85)', justifyContent: 'flex-end',
  },
  paywallCard: {
    backgroundColor: '#2D4A3E', borderTopLeftRadius: 32, borderTopRightRadius: 32,
    padding: 28, paddingBottom: 44, gap: 16, alignItems: 'center',
  },
  paywallEmoji: { fontSize: 44 },
  paywallTitle: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  paywallBody: { fontSize: 14, color: 'rgba(255,255,255,0.65)', textAlign: 'center', lineHeight: 22 },
  upgradeBtn: {
    width: '100%', height: 52, borderRadius: 14,
    backgroundColor: '#C8573E', justifyContent: 'center', alignItems: 'center',
  },
  upgradeText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  dismissText: { fontSize: 14, color: 'rgba(255,255,255,0.4)', textDecorationLine: 'underline' },
});
