import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '@/lib/theme';
import type { Database, Verdict } from '@/lib/database.types';
import { format } from 'date-fns';

type ProductScan = Database['public']['Tables']['product_scans']['Row'];

const FREE_SCAN_LIMIT = 3;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = Spacing.md;
const CARD_WIDTH = (SCREEN_WIDTH - Spacing.xxl * 2 - CARD_GAP) / 2;

const FILTER_CATEGORIES = ['All', 'Cleanser', 'Serum', 'SPF', 'Moisturizer'];

const CATEGORY_EMOJIS: Record<string, string> = {
  cleanser: '\u{1F9F4}',
  serum: '\u{1F4A7}',
  spf: '\u{1F324}',
  moisturizer: '\u{1F4A7}',
  toner: '\u{1F4A7}',
  default: '\u{1F9F4}',
};

interface RecommendedProduct {
  id: string;
  brand: string;
  name: string;
  matchPercent: number;
  emoji: string;
  category: string;
  fromScan?: ProductScan;
}

const PLACEHOLDER_PRODUCTS: RecommendedProduct[] = [
  { id: 'rec-1', brand: 'CERAVE', name: 'Hydrating Cleanser', matchPercent: 92, emoji: '\u{1F9F4}', category: 'Cleanser' },
  { id: 'rec-2', brand: 'GOOD MOLECULES', name: 'Niacinamide Toner 10%', matchPercent: 87, emoji: '\u{1F4A7}', category: 'Serum' },
  { id: 'rec-3', brand: 'ELTAMD', name: 'UV Clear SPF 46', matchPercent: 84, emoji: '\u{1F324}', category: 'SPF' },
  { id: 'rec-4', brand: 'NEUTROGENA', name: 'Hydro Boost Gel', matchPercent: 61, emoji: '\u{1F4A7}', category: 'Moisturizer' },
];

function getMatchPercent(verdict: Verdict): number {
  switch (verdict) {
    case 'suitable': return 90 + Math.floor(Math.random() * 8);
    case 'caution': return 60 + Math.floor(Math.random() * 21);
    case 'unsuitable': return 15 + Math.floor(Math.random() * 25);
  }
}

function getEmoji(productName: string): string {
  const lower = productName.toLowerCase();
  if (lower.includes('cleanser') || lower.includes('wash') || lower.includes('clean')) return '\u{1F9F4}';
  if (lower.includes('spf') || lower.includes('sunscreen') || lower.includes('sun')) return '\u{1F324}';
  if (lower.includes('serum') || lower.includes('toner') || lower.includes('acid')) return '\u{1F4A7}';
  if (lower.includes('moistur') || lower.includes('cream') || lower.includes('gel') || lower.includes('hydro')) return '\u{1F4A7}';
  return '\u{1F9F4}';
}

function getCategory(productName: string): string {
  const lower = productName.toLowerCase();
  if (lower.includes('cleanser') || lower.includes('wash') || lower.includes('clean')) return 'Cleanser';
  if (lower.includes('spf') || lower.includes('sunscreen') || lower.includes('sun')) return 'SPF';
  if (lower.includes('serum') || lower.includes('toner') || lower.includes('acid')) return 'Serum';
  if (lower.includes('moistur') || lower.includes('cream') || lower.includes('gel') || lower.includes('hydro')) return 'Moisturizer';
  return 'All';
}

function extractBrand(productName: string): string {
  const parts = productName.split(' ');
  if (parts.length <= 2) return parts[0].toUpperCase();
  return parts.slice(0, Math.min(2, parts.length - 1)).join(' ').toUpperCase();
}

export default function ScannerScreen() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [currentResult, setCurrentResult] = useState<ProductScan | null>(null);
  const [scanHistory, setScanHistory] = useState<ProductScan[]>([]);
  const [scansUsed, setScansUsed] = useState(0);
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'premium'>('free');
  const [showPaywall, setShowPaywall] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const loadUserData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [profileRes, historyRes] = await Promise.all([
      supabase.from('profiles').select('product_scans_used, subscription_tier').eq('id', user.id).single(),
      supabase
        .from('product_scans')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    if (profileRes.data) {
      setScansUsed(profileRes.data.product_scans_used || 0);
      setSubscriptionTier(profileRes.data.subscription_tier as 'free' | 'premium');
    }
    if (historyRes.data) {
      setScanHistory(historyRes.data);
    }
  }, []);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  const checkScanLimit = (): boolean => {
    if (subscriptionTier === 'premium') return true;
    if (scansUsed >= FREE_SCAN_LIMIT) {
      setShowPaywall(true);
      return false;
    }
    return true;
  };

  const handleBarcodeScan = async (barcode: string) => {
    if (!checkScanLimit()) return;
    if (!barcode.trim()) return;

    setScanning(false);
    setAnalyzing(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.functions.invoke('scan-product', {
        body: { barcode: barcode.trim(), user_id: user.id },
      });

      if (error) throw error;

      const result = data as ProductScan;
      setCurrentResult(result);
      setScanHistory(prev => [result, ...prev.slice(0, 19)]);

      // Update scan count
      await supabase
        .from('profiles')
        .update({ product_scans_used: scansUsed + 1 })
        .eq('id', user.id);
      setScansUsed(prev => prev + 1);

    } catch (err) {
      console.error('Scan error:', err);
      Alert.alert('Scan failed', 'Could not analyze this product. Please try again.');
    } finally {
      setAnalyzing(false);
      setManualBarcode('');
    }
  };

  const startCamera = async () => {
    if (!checkScanLimit()) return;
    if (!permission?.granted) {
      await requestPermission();
    }
    setCurrentResult(null);
    setScanning(true);
  };

  // Build recommended products from scan history + placeholders
  const recommendedProducts: RecommendedProduct[] = (() => {
    const fromScans: RecommendedProduct[] = scanHistory.map((scan) => ({
      id: scan.id,
      brand: extractBrand(scan.product_name),
      name: scan.product_name,
      matchPercent: getMatchPercent(scan.verdict),
      emoji: getEmoji(scan.product_name),
      category: getCategory(scan.product_name),
      fromScan: scan,
    }));

    // Fill in with placeholders if scan history is sparse
    const existingIds = new Set(fromScans.map(p => p.id));
    const combined = [...fromScans];
    for (const placeholder of PLACEHOLDER_PRODUCTS) {
      if (!existingIds.has(placeholder.id) && combined.length < 8) {
        combined.push(placeholder);
      }
    }

    return combined;
  })();

  // Filter products
  const filteredProducts = recommendedProducts.filter((p) => {
    const matchesFilter = activeFilter === 'All' || p.category === activeFilter;
    const matchesSearch = !searchQuery.trim() ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.brand.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const renderProductCard = (product: RecommendedProduct, index: number) => {
    const isLeft = index % 2 === 0;
    return (
      <TouchableOpacity
        key={product.id}
        style={[
          styles.productCard,
          { marginRight: isLeft ? CARD_GAP : 0 },
        ]}
        activeOpacity={0.8}
        onPress={() => {
          if (product.fromScan) {
            setCurrentResult(product.fromScan);
          }
        }}
      >
        <View style={styles.matchBadge}>
          <Text style={styles.matchBadgeText}>{product.matchPercent}%</Text>
        </View>
        <View style={styles.cardEmojiContainer}>
          <Text style={styles.cardEmoji}>{product.emoji}</Text>
        </View>
        <Text style={styles.cardBrand}>{product.brand}</Text>
        <Text style={styles.cardName} numberOfLines={2}>{product.name}</Text>
      </TouchableOpacity>
    );
  };

  const renderPaywall = () => (
    <View style={styles.paywallOverlay}>
      <View style={styles.paywallCard}>
        <Text style={styles.paywallEmoji}>{'\u{1F512}'}</Text>
        <Text style={styles.paywallTitle}>You've used your free scans</Text>
        <Text style={styles.paywallSubtitle}>
          Upgrade to Premium for unlimited product scans and personalized AI analysis
        </Text>
        <View style={styles.paywallFeatures}>
          {['Unlimited product scans', 'AI ingredient analysis', 'Personalized compatibility', 'Scan history'].map((f) => (
            <View key={f} style={styles.paywallFeatureRow}>
              <Text style={styles.paywallFeatureCheck}>{'\u2713'}</Text>
              <Text style={styles.paywallFeatureText}>{f}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity style={styles.upgradeButton} activeOpacity={0.85}>
          <Text style={styles.upgradeText}>Upgrade for $9.99/month</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowPaywall(false)}>
          <Text style={styles.paywallDismiss}>Maybe later</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCurrentResult = () => {
    if (!currentResult || analyzing) return null;
    const verdictColor = currentResult.verdict === 'suitable'
      ? Colors.success
      : currentResult.verdict === 'caution'
      ? Colors.warning
      : Colors.error;
    return (
      <View style={styles.resultCard}>
        <View style={styles.resultHeader}>
          <Text style={styles.resultProductName}>{currentResult.product_name}</Text>
          <View style={[styles.resultVerdictBadge, { backgroundColor: verdictColor }]}>
            <Text style={styles.resultVerdictText}>
              {currentResult.verdict === 'suitable' ? 'SUITABLE' : currentResult.verdict === 'caution' ? 'CAUTION' : 'UNSUITABLE'}
            </Text>
          </View>
        </View>
        <Text style={styles.resultReason}>{currentResult.reason}</Text>
        {currentResult.ingredients && currentResult.ingredients.length > 0 && (
          <View style={styles.ingredientsList}>
            {currentResult.ingredients.map((ing, i) => (
              <View key={i} style={[styles.ingredientChip, { backgroundColor: currentResult.verdict === 'suitable' ? Colors.successLight : currentResult.verdict === 'caution' ? Colors.warningLight : Colors.errorLight }]}>
                <Text style={[styles.ingredientChipText, { color: verdictColor }]}>{ing}</Text>
              </View>
            ))}
          </View>
        )}
        <Text style={styles.resultDate}>
          Scanned {format(new Date(currentResult.created_at), 'MMM d, yyyy')}
        </Text>
        <TouchableOpacity onPress={() => setCurrentResult(null)} style={styles.dismissResult}>
          <Text style={styles.dismissResultText}>Dismiss</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Camera scanner overlay
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
              <View style={[styles.scannerCorner, styles.scannerCornerTL]} />
              <View style={[styles.scannerCorner, styles.scannerCornerTR]} />
              <View style={[styles.scannerCorner, styles.scannerCornerBL]} />
              <View style={[styles.scannerCorner, styles.scannerCornerBR]} />
            </View>
            <Text style={styles.scannerInstruction}>Point camera at barcode</Text>
          </View>
          <TouchableOpacity
            style={styles.cancelScanButton}
            onPress={() => setScanning(false)}
          >
            <Text style={styles.cancelScanText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Discover</Text>
        <Text style={styles.headerSubtitle}>Matched to your skin profile</Text>
        {subscriptionTier === 'free' && (
          <View style={styles.scanCountBadge}>
            <Text style={styles.scanCountText}>
              {FREE_SCAN_LIMIT - scansUsed} free scans remaining
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Search bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrapper}>
            <Text style={styles.searchIcon}>Q</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search products, brands..."
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <TouchableOpacity style={styles.gridButton} onPress={startCamera}>
            <Text style={styles.gridButtonIcon}>{'\u{1F4F7}'}</Text>
          </TouchableOpacity>
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          style={styles.filterScrollView}
        >
          {FILTER_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.filterChip,
                activeFilter === cat ? styles.filterChipActive : styles.filterChipInactive,
              ]}
              onPress={() => setActiveFilter(cat)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeFilter === cat ? styles.filterChipTextActive : styles.filterChipTextInactive,
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Manual barcode entry */}
        <View style={styles.manualEntry}>
          <View style={styles.manualInputRow}>
            <TextInput
              style={styles.manualInput}
              placeholder="Enter barcode number"
              placeholderTextColor={Colors.textMuted}
              value={manualBarcode}
              onChangeText={setManualBarcode}
              keyboardType="number-pad"
            />
            <TouchableOpacity
              style={[
                styles.manualScanButton,
                (!manualBarcode.trim() || analyzing) && styles.manualScanButtonDisabled,
              ]}
              onPress={() => handleBarcodeScan(manualBarcode)}
              disabled={!manualBarcode.trim() || analyzing}
            >
              <Text style={styles.manualScanButtonText}>
                {analyzing ? '...' : 'Scan'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Analyzing state */}
        {analyzing && (
          <View style={styles.analyzingCard}>
            <Text style={styles.analyzingEmoji}>{'\u{1F50D}'}</Text>
            <Text style={styles.analyzingText}>Analyzing ingredients...</Text>
            <Text style={styles.analyzingSubtext}>Claude AI is checking compatibility with your skin profile</Text>
          </View>
        )}

        {/* Current scan result */}
        {renderCurrentResult()}

        {/* Section header */}
        <Text style={styles.sectionHeader}>RECOMMENDED FOR YOU</Text>

        {/* Product grid */}
        <View style={styles.productGrid}>
          {filteredProducts.map((product, index) => renderProductCard(product, index))}
        </View>

        {filteredProducts.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>{'\u{1F50D}'}</Text>
            <Text style={styles.emptyText}>No products match your search</Text>
          </View>
        )}
      </ScrollView>

      {showPaywall && renderPaywall()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  scanCountBadge: {
    marginTop: Spacing.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.warningLight,
    borderRadius: BorderRadius.pill,
  },
  scanCountText: {
    ...Typography.labelSmall,
    color: Colors.warning,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.sm,
  },

  // Search
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    height: 48,
    ...Shadows.xs,
  },
  searchIcon: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textMuted,
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...Typography.bodyMedium,
    color: Colors.text,
    height: 48,
  },
  gridButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  gridButtonIcon: {
    fontSize: 20,
  },

  // Filters
  filterScrollView: {
    marginBottom: Spacing.lg,
    marginHorizontal: -Spacing.xxl,
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xxl,
  },
  filterChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.pill,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
  },
  filterChipInactive: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipText: {
    ...Typography.labelMedium,
  },
  filterChipTextActive: {
    color: Colors.white,
  },
  filterChipTextInactive: {
    color: Colors.textSecondary,
  },

  // Manual entry
  manualEntry: {
    marginBottom: Spacing.lg,
  },
  manualInputRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  manualInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    ...Typography.bodyMedium,
    color: Colors.text,
    backgroundColor: Colors.white,
  },
  manualScanButton: {
    width: 72,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  manualScanButtonDisabled: {
    backgroundColor: Colors.subtleDeep,
  },
  manualScanButtonText: {
    ...Typography.labelLarge,
    color: Colors.white,
  },

  // Analyzing
  analyzingCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  analyzingEmoji: {
    fontSize: 40,
  },
  analyzingText: {
    ...Typography.headlineSmall,
    color: Colors.text,
  },
  analyzingSubtext: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    textAlign: 'center',
  },

  // Result card
  resultCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  resultProductName: {
    ...Typography.headlineMedium,
    color: Colors.text,
    flex: 1,
  },
  resultVerdictBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.pill,
  },
  resultVerdictText: {
    ...Typography.labelSmall,
    color: Colors.white,
    fontWeight: '700',
  },
  resultReason: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  ingredientsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  ingredientChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.pill,
  },
  ingredientChipText: {
    ...Typography.caption,
    fontWeight: '600',
  },
  resultDate: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  dismissResult: {
    alignSelf: 'flex-end',
  },
  dismissResultText: {
    ...Typography.labelMedium,
    color: Colors.primary,
    textDecorationLine: 'underline',
  },

  // Section header
  sectionHeader: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: Spacing.lg,
    marginTop: Spacing.sm,
  },

  // Product grid
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  productCard: {
    width: CARD_WIDTH,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: CARD_GAP,
    position: 'relative',
    ...Shadows.sm,
  },
  matchBadge: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: BorderRadius.sm,
    zIndex: 1,
  },
  matchBadgeText: {
    ...Typography.labelSmall,
    color: Colors.white,
    fontWeight: '700',
  },
  cardEmojiContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  cardEmoji: {
    fontSize: 40,
  },
  cardBrand: {
    ...Typography.caption,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.xxs,
  },
  cardName: {
    ...Typography.labelLarge,
    color: Colors.text,
    lineHeight: 18,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    gap: Spacing.md,
  },
  emptyEmoji: {
    fontSize: 40,
    opacity: 0.5,
  },
  emptyText: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
  },

  // Camera
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  scannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  scannerFrame: {
    width: 220,
    height: 130,
    position: 'relative',
  },
  scannerCorner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: Colors.white,
  },
  scannerCornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  scannerCornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  scannerCornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  scannerCornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  scannerInstruction: {
    ...Typography.bodyMedium,
    color: Colors.white,
    marginTop: Spacing.lg,
    textAlign: 'center',
  },
  cancelScanButton: {
    position: 'absolute',
    bottom: Spacing.xxxl,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  cancelScanText: {
    ...Typography.labelLarge,
    color: Colors.white,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.pill,
    overflow: 'hidden',
  },

  // Paywall
  paywallOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(28,28,26,0.85)',
    justifyContent: 'flex-end',
  },
  paywallCard: {
    backgroundColor: Colors.primary,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: Spacing.xxl,
    paddingBottom: 40,
    gap: Spacing.lg,
    alignItems: 'center',
  },
  paywallEmoji: {
    fontSize: 48,
  },
  paywallTitle: {
    ...Typography.displaySmall,
    color: Colors.white,
    textAlign: 'center',
  },
  paywallSubtitle: {
    ...Typography.bodyMedium,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 22,
  },
  paywallFeatures: {
    width: '100%',
    gap: Spacing.sm,
  },
  paywallFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  paywallFeatureCheck: {
    color: Colors.success,
    fontWeight: '700',
    fontSize: 16,
  },
  paywallFeatureText: {
    ...Typography.bodyMedium,
    color: Colors.white,
  },
  upgradeButton: {
    width: '100%',
    height: 54,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.md,
  },
  upgradeText: {
    ...Typography.headlineSmall,
    color: Colors.white,
  },
  paywallDismiss: {
    ...Typography.bodyMedium,
    color: 'rgba(255,255,255,0.5)',
    textDecorationLine: 'underline',
  },
});
