import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, FlatList, Linking, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Shadows, Spacing, BorderRadius, Typography } from '@/lib/theme';
import { PILLAR_EMOJIS, PILLAR_LABELS } from '@/lib/plan-constants';
import { matchProductsToPick } from '@/lib/match-products-to-pick';
import type { RankedItem } from '@/lib/database.types';
import type { Product } from '@/lib/products';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAROUSEL_CARD_WIDTH = 150;

interface PickDetailModalProps {
  visible: boolean;
  pick: RankedItem | null;
  onClose: () => void;
  onToggleRoutine: (item: RankedItem) => void;
  isInRoutine: boolean;
}

function openAmazonSearch(query: string) {
  Linking.openURL(`https://www.amazon.com/s?k=${encodeURIComponent(query)}`);
}

function CarouselCard({ product }: { product: Product }) {
  return (
    <TouchableOpacity
      style={cStyles.carouselCard}
      activeOpacity={0.88}
      onPress={() => openAmazonSearch(`${product.brand} ${product.name}`)}
    >
      <View style={cStyles.carouselIcon}>
        <Text style={cStyles.carouselEmoji}>
          {product.category === 'Skincare' ? '✨' :
           product.category === 'Supplements' ? '💊' :
           product.category === 'Foods' ? '🥗' :
           product.category === 'Herbal' ? '🌿' : '🛏️'}
        </Text>
      </View>
      {product.brand ? <Text style={cStyles.carouselBrand}>{product.brand}</Text> : null}
      <Text style={cStyles.carouselName} numberOfLines={2}>{product.name}</Text>
      {product.price ? <Text style={cStyles.carouselPrice}>{product.price}</Text> : null}
      <Text style={cStyles.carouselLink}>View on Amazon ↗</Text>
    </TouchableOpacity>
  );
}

export default function PickDetailModal({ visible, pick, onClose, onToggleRoutine, isInRoutine }: PickDetailModalProps) {
  const insets = useSafeAreaInsets();

  if (!pick) return null;

  const relatedProducts = matchProductsToPick(pick);
  const hasProducts = relatedProducts.length > 0;
  const pillarEmoji = PILLAR_EMOJIS[pick.pillar] || '✨';
  const pillarLabel = PILLAR_LABELS[pick.pillar] || pick.pillar.toUpperCase();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Handle bar */}
        <View style={styles.handleBar}>
          <View style={styles.handle} />
        </View>

        {/* Close button */}
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Pillar badge */}
          <View style={styles.pillarBadge}>
            <Text style={styles.pillarEmoji}>{pillarEmoji}</Text>
            <Text style={styles.pillarLabel}>{pillarLabel}</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>{pick.title}</Text>

          {/* Rationale */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>WHY THIS WAS RECOMMENDED</Text>
            <Text style={styles.rationale}>{pick.rationale}</Text>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Add to routine */}
          <TouchableOpacity
            style={[styles.routineBtn, isInRoutine && styles.routineBtnActive]}
            activeOpacity={0.85}
            onPress={() => onToggleRoutine(pick)}
          >
            <Text style={[styles.routineBtnText, isInRoutine && styles.routineBtnTextActive]}>
              {isInRoutine ? '✓  In Your Routine' : '+  Add to Routine'}
            </Text>
          </TouchableOpacity>

          {/* Amazon search */}
          <TouchableOpacity
            style={styles.amazonBtn}
            activeOpacity={0.85}
            onPress={() => openAmazonSearch(pick.title)}
          >
            <Text style={styles.amazonBtnText}>Search "{pick.title}" on Amazon ↗</Text>
          </TouchableOpacity>

          {/* Related products carousel */}
          {hasProducts && (
            <View style={styles.carouselSection}>
              <Text style={styles.carouselTitle}>Related Products</Text>
              <FlatList
                data={relatedProducts}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.carouselList}
                renderItem={({ item }) => <CarouselCard product={item} />}
              />
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  handleBar: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
  },
  closeBtn: {
    position: 'absolute',
    top: 52,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.cardGlass,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm },

  pillarBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  pillarEmoji: { fontSize: 18 },
  pillarLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 1.5,
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.4,
    lineHeight: 32,
    marginBottom: Spacing.xl,
  },

  section: { marginBottom: Spacing.lg },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1.4,
    marginBottom: Spacing.sm,
  },
  rationale: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 23,
  },

  impactRow: { marginBottom: Spacing.lg },
  impactBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(124,92,252,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(124,92,252,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: BorderRadius.md,
  },
  impactText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primaryLight,
  },

  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginBottom: Spacing.xl,
  },

  routineBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  routineBtnActive: {
    backgroundColor: 'rgba(124,92,252,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(124,92,252,0.35)',
  },
  routineBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  routineBtnTextActive: {
    color: Colors.primaryLight,
  },

  amazonBtn: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  amazonBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },

  carouselSection: { marginBottom: Spacing.lg },
  carouselTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.2,
    marginBottom: Spacing.md,
  },
  carouselList: {
    gap: Spacing.md,
    paddingRight: Spacing.xs,
  },
});

const cStyles = StyleSheet.create({
  carouselCard: {
    width: CAROUSEL_CARD_WIDTH,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    gap: 4,
  },
  carouselIcon: {
    width: CAROUSEL_CARD_WIDTH - 24,
    height: 70,
    backgroundColor: Colors.cardGlass,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  carouselEmoji: { fontSize: 24 },
  carouselBrand: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  carouselName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 16,
  },
  carouselPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
    marginTop: 2,
  },
  carouselLink: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textMuted,
    marginTop: 4,
  },
});
