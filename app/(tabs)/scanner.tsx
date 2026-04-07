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
  Modal,
  Image,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useTabTransition } from '@/hooks/useTabTransition';
import { supabase } from '@/lib/supabase';
import { Colors, Shadows } from '@/lib/theme';
import ScreenBackground from '@/components/ScreenBackground';
import type { Database } from '@/lib/database.types';
import { PRODUCTS, PRODUCT_CATEGORIES, CATEGORY_META } from '@/lib/products';
import type { Product, ProductCategory } from '@/lib/products';
import { searchProducts, fetchByCategory } from '@/lib/product-search';
import ProductCard from '@/components/ProductCard';
import { useFavorites } from '@/hooks/useFavorites';
import { cleanProductName } from '@/lib/clean-product-name';

type ProductScan = Database['public']['Tables']['product_scans']['Row'];

const CARD_GAP = 14;
const SEARCH_DEBOUNCE = 600;

export default function ScannerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { animatedStyle } = useTabTransition();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [scansUsed, setScansUsed] = useState(0);
  const [activeFilter, setActiveFilter] = useState<'All' | ProductCategory>('All');
  const [sortBy, setSortBy] = useState<'match' | 'price_asc' | 'price_desc'>('match');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [categoryProducts, setCategoryProducts] = useState<Product[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { favorites, toggle: toggleFavorite, isFavorite } = useFavorites();

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

  useEffect(() => {
    if (activeFilter === 'All') { setCategoryProducts([]); return; }
    setCategoryLoading(true);
    fetchByCategory(activeFilter)
      .then(setCategoryProducts)
      .catch(() => setCategoryProducts([]))
      .finally(() => setCategoryLoading(false));
  }, [activeFilter]);

  const handleBarcodeScan = async (barcode: string) => {
    if (!barcode.trim()) return;
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
    if (!permission?.granted) await requestPermission();
    setScanning(true);
  };

  // Show search results if we have them, otherwise filter curated picks
  const isLiveSearch = hasSearched && searchResults.length > 0;

  const baseProducts = activeFilter === 'All' ? PRODUCTS.slice(0, 30) : categoryProducts;

  const filteredPicks = baseProducts
    .filter((p) => {
      const q = searchQuery.trim().toLowerCase();
      return !q ||
        p.name.toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortBy === 'price_asc') return (a.price_numeric ?? 999) - (b.price_numeric ?? 999);
      if (sortBy === 'price_desc') return (b.price_numeric ?? 0) - (a.price_numeric ?? 0);
      return b.match_percent - a.match_percent;
    });

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
        <TouchableOpacity
          style={[styles.backBtn, { top: insets.top + 12 }]}
          onPress={() => setScanning(false)}
          activeOpacity={0.8}
        >
          <Text style={styles.backBtnText}>{'\u2039'}</Text>
        </TouchableOpacity>
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            facing="back"
            zoom={0}
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
          </View>
        </View>
      </View>
    );
  }

  const counts: Record<string, number> = { All: PRODUCTS.length };
  for (const p of PRODUCTS) counts[p.category] = (counts[p.category] || 0) + 1;

  return (
    <Animated.View style={[styles.container, { paddingTop: insets.top }, animatedStyle]}>
      <ScreenBackground preset="shop" />
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Skin Shop</Text>
          <Text style={styles.subtitle}>Curated for skin health</Text>
        </View>
        <TouchableOpacity style={styles.favBtn} onPress={() => setShowFavorites(true)} activeOpacity={0.8}>
          <Text style={styles.favBtnIcon}>{'\u2665'}</Text>
          {favorites.length > 0 && (
            <View style={styles.favCount}>
              <Text style={styles.favCountText}>{favorites.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollInner} showsVerticalScrollIndicator={false}>
        {/* Search + Scan row */}
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search skincare, supplements, foods..."
              placeholderTextColor="#B5AFA5"
              value={searchQuery}
              onChangeText={handleSearchChange}
              returnKeyType="search"
            />
            {isSearching && <ActivityIndicator size="small" color="#7C5CFC" style={{ marginRight: 4 }} />}
            {searchQuery.length > 0 && !isSearching && (
              <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.clearIcon}>{'\u2715'}</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={styles.scanBtn} onPress={startCamera} activeOpacity={0.8}>
            <View style={styles.scanBtnIcon}>
              <View style={[styles.scanCorner, { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2 }]} />
              <View style={[styles.scanCorner, { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2 }]} />
              <View style={[styles.scanCorner, { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2 }]} />
              <View style={[styles.scanCorner, { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2 }]} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Category tabs — hide during live search */}

        {/* Section heading */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>
            {isLiveSearch ? `Results for "${searchQuery}"` : activeFilter === 'All' ? 'Recommended' : CATEGORY_META[activeFilter as ProductCategory].label}
          </Text>
          <TouchableOpacity style={styles.filterBtn} onPress={() => setShowFilterMenu(true)} activeOpacity={0.8}>
            <Text style={styles.filterBtnText}>
              {sortBy === 'price_asc' ? 'Price: Low' : sortBy === 'price_desc' ? 'Price: High' : 'Filter'}
            </Text>
            <Text style={styles.filterBtnIcon}>{'\u25BC'}</Text>
          </TouchableOpacity>
        </View>

        {/* Filter modal */}
        <Modal visible={showFilterMenu} animationType="fade" transparent onRequestClose={() => setShowFilterMenu(false)}>
          <TouchableOpacity style={styles.filterOverlay} activeOpacity={1} onPress={() => setShowFilterMenu(false)}>
            <View style={styles.filterDropdown}>
              <Text style={styles.filterDropdownTitle}>Category</Text>
              {(['All', 'Skincare', 'Supplements', 'Foods', 'Herbal', 'Accessories'] as const).map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.filterOption, activeFilter === cat && styles.filterOptionActive]}
                  onPress={() => { setActiveFilter(cat); setShowFilterMenu(false); }}
                >
                  <Text style={[styles.filterOptionText, activeFilter === cat && styles.filterOptionTextActive]}>{cat === 'All' ? 'Recommended' : cat}</Text>
                  {activeFilter === cat && <Text style={styles.filterCheck}>{'\u2713'}</Text>}
                </TouchableOpacity>
              ))}
              <View style={styles.filterDivider} />
              <Text style={styles.filterDropdownTitle}>Sort by Price</Text>
              {([
                { key: 'match', label: 'Best Match' },
                { key: 'price_asc', label: 'Price: Low to High' },
                { key: 'price_desc', label: 'Price: High to Low' },
              ] as const).map((s) => (
                <TouchableOpacity
                  key={s.key}
                  style={[styles.filterOption, sortBy === s.key && styles.filterOptionActive]}
                  onPress={() => { setSortBy(s.key); setShowFilterMenu(false); }}
                >
                  <Text style={[styles.filterOptionText, sortBy === s.key && styles.filterOptionTextActive]}>{s.label}</Text>
                  {sortBy === s.key && <Text style={styles.filterCheck}>{'\u2713'}</Text>}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Search hint */}
        {searchQuery.trim().length > 0 && searchQuery.trim().length < 3 && !isSearching && (
          <Text style={styles.searchHint}>Type 3+ characters to search</Text>
        )}

        {(analyzing || categoryLoading) && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#7C5CFC" />
            <Text style={styles.loadingText}>{categoryLoading ? `Loading ${activeFilter}...` : 'Analyzing product...'}</Text>
          </View>
        )}

        {/* Product grid */}
        <View style={styles.grid}>
          {displayProducts.map((product, i) => (
            <View key={product.id} style={[styles.gridCell, i % 2 === 0 ? { marginRight: CARD_GAP / 2 } : { marginLeft: CARD_GAP / 2 }]}>
              <ProductCard
                product={product}
                onPress={handleProductPress}
                isFavorite={isFavorite(product.id)}
                onToggleFavorite={toggleFavorite}
              />
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

      </ScrollView>

      {/* Favorites sidebar */}
      <Modal visible={showFavorites} animationType="slide" transparent onRequestClose={() => setShowFavorites(false)}>
        <View style={styles.favOverlay}>
          <TouchableOpacity style={styles.favBackdrop} activeOpacity={1} onPress={() => setShowFavorites(false)} />
          <View style={[styles.favDrawer, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.favHeader}>
              <Text style={styles.favTitle}>Saved Favorites</Text>
              <TouchableOpacity onPress={() => setShowFavorites(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.favClose}>{'\u2715'}</Text>
              </TouchableOpacity>
            </View>
            {favorites.length === 0 ? (
              <View style={styles.favEmpty}>
                <Text style={styles.favEmptyIcon}>{'\u2661'}</Text>
                <Text style={styles.favEmptyText}>No favorites yet</Text>
                <Text style={styles.favEmptySubtext}>Tap the heart on any product to save it here.</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {favorites.map((product) => (
                  <View key={product.id} style={styles.favItem}>
                    {product.image_url ? (
                      <Image source={{ uri: product.image_url }} style={styles.favImage} resizeMode="contain" />
                    ) : (
                      <View style={styles.favImagePlaceholder} />
                    )}
                    <View style={styles.favItemInfo}>
                      <Text style={styles.favItemBrand}>{product.brand}</Text>
                      <Text style={styles.favItemName} numberOfLines={2}>{cleanProductName(product.name, product.brand)}</Text>
                      {product.price ? <Text style={styles.favItemPrice}>{product.price}</Text> : null}
                    </View>
                    <TouchableOpacity
                      onPress={() => toggleFavorite(product)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.favItemHeart}>{'\u2665'}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08080F' },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 30, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.4 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  scroll: { flex: 1 },
  scrollInner: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 130 },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14,
  },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F2EDE6', borderRadius: 14,
    paddingHorizontal: 14, height: 48,
  },
  scanBtn: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: '#7C5CFC',
    alignItems: 'center', justifyContent: 'center',
  },
  scanBtnIcon: {
    width: 20, height: 20, position: 'relative',
  },
  scanCorner: {
    position: 'absolute', width: 7, height: 7,
    borderColor: '#FFFFFF', borderRadius: 1,
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
  tabActive: { backgroundColor: '#7C5CFC' },
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
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.2 },
  sectionCount: { fontSize: 13, color: '#FFFFFF' },

  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  loadingText: { fontSize: 13, color: '#7C5CFC', fontWeight: '500' },

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
  ctaCorner: { position: 'absolute', width: 9, height: 9, borderColor: '#7C5CFC', borderRadius: 1 },
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
  backBtn: {
    position: 'absolute', left: 16, zIndex: 20,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center', justifyContent: 'center',
  },
  backBtnText: { fontSize: 30, color: '#FFFFFF', fontWeight: '300', marginTop: -2 },
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
    backgroundColor: '#7C5CFC', borderTopLeftRadius: 32, borderTopRightRadius: 32,
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

  // Filter button
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.card, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  filterBtnText: { fontSize: 13, fontWeight: '600', color: Colors.white },
  filterBtnIcon: { fontSize: 8, color: '#9B9488' },

  // Filter dropdown
  filterOverlay: { flex: 1, justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 180, paddingRight: 20 },
  filterDropdown: {
    backgroundColor: Colors.card, borderRadius: 16,
    paddingVertical: 8, minWidth: 200,
    borderWidth: 1, borderColor: Colors.border,
  },
  filterDropdownTitle: { fontSize: 10, fontWeight: '700', color: '#9B9488', letterSpacing: 1.2, paddingHorizontal: 16, paddingVertical: 8 },
  filterOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  filterOptionActive: { backgroundColor: 'rgba(124,92,252,0.12)' },
  filterOptionText: { fontSize: 14, fontWeight: '500', color: Colors.white },
  filterOptionTextActive: { color: Colors.primary, fontWeight: '600' },
  filterCheck: { fontSize: 14, color: Colors.primary, fontWeight: '700' },
  filterDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 4 },

  // Header favorites button
  favBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.card,
    alignItems: 'center', justifyContent: 'center',
  },
  favBtnIcon: { fontSize: 24, color: '#E8507A' },
  favCount: {
    position: 'absolute', top: 4, right: 4,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  favCountText: { fontSize: 9, fontWeight: '700', color: '#FFFFFF' },

  // Favorites drawer
  favOverlay: { flex: 1, justifyContent: 'flex-end' },
  favBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent' },
  favDrawer: {
    backgroundColor: Colors.backgroundAlt,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 20, paddingHorizontal: 20,
    maxHeight: '80%',
  },
  favHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 20,
  },
  favTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  favClose: { fontSize: 18, color: '#FFFFFF' },
  favEmpty: { alignItems: 'center', paddingVertical: 48 },
  favEmptyIcon: { fontSize: 40, marginBottom: 12, color: '#FFFFFF' },
  favEmptyText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', marginBottom: 6 },
  favEmptySubtext: { fontSize: 13, color: '#9B9488', textAlign: 'center' },
  favItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.card, borderRadius: 14,
    padding: 12, marginBottom: 10,
  },
  favImage: { width: 56, height: 56, borderRadius: 10, backgroundColor: '#FFFFFF' },
  favImagePlaceholder: { width: 56, height: 56, borderRadius: 10, backgroundColor: Colors.card },
  favItemInfo: { flex: 1 },
  favItemBrand: { fontSize: 10, fontWeight: '700', color: '#9B9488', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 2 },
  favItemName: { fontSize: 14, fontWeight: '600', color: '#FFFFFF', lineHeight: 18 },
  favItemPrice: { fontSize: 13, fontWeight: '700', color: Colors.primary, marginTop: 4 },
  favItemHeart: { fontSize: 20, color: '#E8507A' },
});
