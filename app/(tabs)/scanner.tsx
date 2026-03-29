import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '@/lib/theme';
import type { Database, Verdict } from '@/lib/database.types';
import { format } from 'date-fns';

type ProductScan = Database['public']['Tables']['product_scans']['Row'];

const FREE_SCAN_LIMIT = 3;

const VERDICT_CONFIG: Record<Verdict, { label: string; color: string; bg: string; icon: string }> = {
  suitable: { label: 'SUITABLE', color: Colors.verdictSuitable, bg: Colors.successLight, icon: '✓' },
  caution: { label: 'USE WITH CAUTION', color: Colors.verdictCaution, bg: Colors.warningLight, icon: '⚠' },
  unsuitable: { label: 'UNSUITABLE', color: Colors.verdictUnsuitable, bg: Colors.errorLight, icon: '✗' },
};

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

  const renderVerdictCard = (scan: ProductScan) => {
    const config = VERDICT_CONFIG[scan.verdict];
    return (
      <View style={[styles.verdictCard, { borderColor: config.color }]}>
        <LinearGradient
          colors={[config.bg, Colors.white]}
          style={styles.verdictHeader}
        >
          <View style={styles.verdictTopRow}>
            <Text style={styles.productName}>{scan.product_name}</Text>
            <View style={[styles.verdictBadge, { backgroundColor: config.color }]}>
              <Text style={styles.verdictIcon}>{config.icon}</Text>
              <Text style={styles.verdictLabel}>{config.label}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.verdictBody}>
          <Text style={styles.verdictReason}>{scan.reason}</Text>

          {scan.ingredients && scan.ingredients.length > 0 && (
            <View style={styles.flaggedSection}>
              <Text style={styles.flaggedTitle}>
                {scan.verdict === 'suitable' ? 'Beneficial Ingredients' : 'Flagged Ingredients'}
              </Text>
              <View style={styles.flaggedList}>
                {scan.ingredients.map((ing, i) => (
                  <View
                    key={i}
                    style={[
                      styles.flaggedChip,
                      {
                        backgroundColor:
                          scan.verdict === 'suitable'
                            ? Colors.successLight
                            : scan.verdict === 'unsuitable'
                            ? Colors.errorLight
                            : Colors.warningLight,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.flaggedChipText,
                        {
                          color:
                            scan.verdict === 'suitable'
                              ? Colors.verdictSuitable
                              : scan.verdict === 'unsuitable'
                              ? Colors.verdictUnsuitable
                              : Colors.verdictCaution,
                        },
                      ]}
                    >
                      {ing}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <Text style={styles.scanDate}>
            Scanned {format(new Date(scan.created_at), 'MMM d, yyyy')}
          </Text>
        </View>
      </View>
    );
  };

  const renderPaywall = () => (
    <View style={styles.paywallOverlay}>
      <LinearGradient
        colors={['#1A0A0F', '#3D1A28']}
        style={styles.paywallCard}
      >
        <Text style={styles.paywallEmoji}>🔒</Text>
        <Text style={styles.paywallTitle}>You've used your free scans</Text>
        <Text style={styles.paywallSubtitle}>
          Upgrade to Premium for unlimited product scans and personalized AI analysis
        </Text>
        <View style={styles.paywallFeatures}>
          {['Unlimited product scans', 'AI ingredient analysis', 'Personalized compatibility', 'Scan history'].map((f) => (
            <View key={f} style={styles.paywallFeatureRow}>
              <Text style={styles.paywallFeatureCheck}>✓</Text>
              <Text style={styles.paywallFeatureText}>{f}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity style={styles.upgradeButton} activeOpacity={0.85}>
          <LinearGradient
            colors={[Colors.secondary, Colors.primary]}
            style={styles.upgradeGradient}
          >
            <Text style={styles.upgradeText}>Upgrade for $9.99/month</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowPaywall(false)}>
          <Text style={styles.paywallDismiss}>Maybe later</Text>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <LinearGradient colors={['#FFF0F5', '#FFE0ED']} style={styles.header}>
        <Text style={styles.headerTitle}>Product Scanner</Text>
        <Text style={styles.headerSubtitle}>Check if products suit your skin</Text>
        {subscriptionTier === 'free' && (
          <View style={styles.scanCountBadge}>
            <Text style={styles.scanCountText}>
              {FREE_SCAN_LIMIT - scansUsed} free scans remaining
            </Text>
          </View>
        )}
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Camera scanner */}
        {scanning && permission?.granted ? (
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
              <Text style={styles.scannerInstruction}>
                Point camera at barcode
              </Text>
            </View>
            <TouchableOpacity
              style={styles.cancelScanButton}
              onPress={() => setScanning(false)}
            >
              <Text style={styles.cancelScanText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.scanActions}>
            <TouchableOpacity
              style={styles.scanButton}
              onPress={startCamera}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[Colors.primary, Colors.primaryDark]}
                style={styles.scanButtonGradient}
              >
                <Text style={styles.scanButtonIcon}>📷</Text>
                <Text style={styles.scanButtonText}>Scan Barcode</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Manual entry */}
            <View style={styles.manualEntry}>
              <Text style={styles.manualLabel}>Or enter barcode manually</Text>
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
          </View>
        )}

        {/* Current result */}
        {analyzing && (
          <View style={styles.analyzingCard}>
            <LinearGradient colors={[Colors.subtle, Colors.white]} style={styles.analyzingGradient}>
              <Text style={styles.analyzingEmoji}>🔍</Text>
              <Text style={styles.analyzingText}>Analyzing ingredients...</Text>
              <Text style={styles.analyzingSubtext}>Claude AI is checking compatibility with your skin profile</Text>
            </LinearGradient>
          </View>
        )}

        {currentResult && !analyzing && (
          <View style={styles.resultSection}>
            <Text style={styles.resultSectionTitle}>Scan Result</Text>
            {renderVerdictCard(currentResult)}
          </View>
        )}

        {/* Scan history */}
        {scanHistory.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.historySectionTitle}>Scan History</Text>
            {scanHistory.map((scan) => (
              <TouchableOpacity
                key={scan.id}
                style={styles.historyItem}
                onPress={() => setCurrentResult(scan)}
              >
                <View style={[styles.historyVerdict, { backgroundColor: VERDICT_CONFIG[scan.verdict].bg }]}>
                  <Text style={[styles.historyVerdictIcon, { color: VERDICT_CONFIG[scan.verdict].color }]}>
                    {VERDICT_CONFIG[scan.verdict].icon}
                  </Text>
                </View>
                <View style={styles.historyContent}>
                  <Text style={styles.historyProductName}>{scan.product_name}</Text>
                  <Text style={styles.historyBarcode}>#{scan.barcode}</Text>
                </View>
                <Text style={styles.historyDate}>
                  {format(new Date(scan.created_at), 'MMM d')}
                </Text>
              </TouchableOpacity>
            ))}
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
    paddingBottom: Spacing.xl,
  },
  headerTitle: {
    ...Typography.displaySmall,
    color: Colors.text,
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
    paddingBottom: 100,
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.lg,
    gap: Spacing.xl,
  },
  cameraContainer: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    height: 320,
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
    bottom: Spacing.xl,
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
  },
  scanActions: {
    gap: Spacing.lg,
  },
  scanButton: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  scanButtonGradient: {
    height: 60,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  scanButtonIcon: {
    fontSize: 24,
  },
  scanButtonText: {
    ...Typography.headlineSmall,
    color: Colors.white,
  },
  manualEntry: {
    gap: Spacing.md,
  },
  manualLabel: {
    ...Typography.labelMedium,
    color: Colors.textMuted,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  manualInputRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  manualInput: {
    flex: 1,
    height: 52,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    ...Typography.bodyMedium,
    color: Colors.text,
    backgroundColor: Colors.white,
  },
  manualScanButton: {
    width: 80,
    height: 52,
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
  analyzingCard: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  analyzingGradient: {
    padding: Spacing.xxl,
    alignItems: 'center',
    gap: Spacing.md,
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
  resultSection: {
    gap: Spacing.md,
  },
  resultSectionTitle: {
    ...Typography.headlineSmall,
    color: Colors.text,
  },
  verdictCard: {
    borderWidth: 2,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.md,
  },
  verdictHeader: {
    padding: Spacing.lg,
  },
  verdictTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  productName: {
    ...Typography.headlineMedium,
    color: Colors.text,
    flex: 1,
  },
  verdictBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.pill,
  },
  verdictIcon: {
    fontSize: 14,
    color: Colors.white,
    fontWeight: '700',
  },
  verdictLabel: {
    ...Typography.labelSmall,
    color: Colors.white,
    fontWeight: '700',
  },
  verdictBody: {
    padding: Spacing.lg,
    backgroundColor: Colors.white,
    gap: Spacing.md,
  },
  verdictReason: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  flaggedSection: {
    gap: Spacing.sm,
  },
  flaggedTitle: {
    ...Typography.labelMedium,
    color: Colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  flaggedList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  flaggedChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.pill,
  },
  flaggedChipText: {
    ...Typography.caption,
    fontWeight: '600',
  },
  scanDate: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  historySection: {
    gap: Spacing.md,
  },
  historySectionTitle: {
    ...Typography.headlineSmall,
    color: Colors.text,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Shadows.xs,
  },
  historyVerdict: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  historyVerdictIcon: {
    fontSize: 18,
    fontWeight: '700',
  },
  historyContent: {
    flex: 1,
  },
  historyProductName: {
    ...Typography.labelLarge,
    color: Colors.text,
  },
  historyBarcode: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  historyDate: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  paywallOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(26,10,15,0.85)',
    justifyContent: 'flex-end',
  },
  paywallCard: {
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
    color: Colors.secondary,
    fontWeight: '700',
    fontSize: 16,
  },
  paywallFeatureText: {
    ...Typography.bodyMedium,
    color: Colors.white,
  },
  upgradeButton: {
    width: '100%',
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    ...Shadows.md,
  },
  upgradeGradient: {
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
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
