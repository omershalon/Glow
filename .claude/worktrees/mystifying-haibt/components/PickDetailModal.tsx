import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, FlatList, Linking, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Shadows } from '@/lib/theme';
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
          {product.category === 'Skincare' ? '\u2728' :
           product.category === 'Supplements' ? '\u{1F48A}' :
           product.category === 'Foods' ? '\u{1F957}' :
           product.category === 'Herbal' ? '\u{1F33F}' : '\u{1F6CF}'}
        </Text>
      </View>
      {product.brand ? <Text style={cStyles.carouselBrand}>{product.brand}</Text> : null}
      <Text style={cStyles.carouselName} numberOfLines={2}>{product.name}</Text>
      {product.price ? <Text style={cStyles.carouselPrice}>{product.price}</Text> : null}
      <Text style={cStyles.carouselLink}>View on Amazon {'\u2197'}</Text>
    </TouchableOpacity>
  );
}

export default function PickDetailModal({ visible, pick, onClose, onToggleRoutine, isInRoutine }: PickDetailModalProps) {
  const insets = useSafeAreaInsets();

  if (!pick) return null;

  const relatedProducts = matchProductsToPick(pick);
  const hasProducts = relatedProducts.length > 0;
  const pillarEmoji = PILLAR_EMOJIS[pick.pillar] || '\u2728';
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
          <Text style={styles.closeText}>{'\u2715'}</Text>
        </TouchableOpacity>

        <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 + insets.bottom }]} showsVerticalScrollIndicator={false}>
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

          {/* Impact rank */}
          <View style={styles.impactRow}>
            <View style={styles.impactBadge}>
              <Text style={styles.impactText}>#{pick.impact_rank} Impact</Text>
            </View>
          </View>

          {/* Add to routine */}
          <TouchableOpacity
            style={[styles.routineBtn, isInRoutine && styles.routineBtnActive]}
            activeOpacity={0.85}
            onPress={() => onToggleRoutine(pick)}
          >
            <Text style={[styles.routineBtnText, isInRoutine && styles.routineBtnTextActive]}>
              {isInRoutine ? '\u2713  In Your Routine' : '+  Add to Routine'}
            </Text>
          </TouchableOpacity>

          {/* Amazon search for this pick */}
          <TouchableOpacity
            style={styles.amazonBtn}
            activeOpacity={0.85}
            onPress={() => openAmazonSearch(pick.title)}
          >
            <Text style={styles.amazonBtnText}>Search "{pick.title}" on Amazon {'\u2197'}</Text>
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
    backgroundColor: '#FAF8F5',
  },
  handleBar: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#D4CFC6',
    borderRadius: 2,
  },
  closeBtn: {
    position: 'absolute',
    top: 52,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2EDE6',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeText: {
    fontSize: 16,
    color: '#6B6358',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 8 },

  pillarBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  pillarEmoji: { fontSize: 18 },
  pillarLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9B9488',
    letterSpacing: 1.5,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1C1C1A',
    letterSpacing: -0.4,
    marginBottom: 24,
  },

  section: { marginBottom: 20 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9B9488',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  rationale: {
    fontSize: 16,
    color: '#5A5A50',
    lineHeight: 24,
  },

  impactRow: { marginBottom: 24 },
  impactBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EDE8DF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  impactText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B6358',
  },

  routineBtn: {
    backgroundColor: '#2D4A3E',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  routineBtnActive: {
    backgroundColor: '#EDE8DF',
  },
  routineBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  routineBtnTextActive: {
    color: '#2D4A3E',
  },

  amazonBtn: {
    backgroundColor: '#F2EDE6',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 28,
  },
  amazonBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B6358',
  },

  carouselSection: { marginBottom: 20 },
  carouselTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1A',
    letterSpacing: -0.2,
    marginBottom: 14,
  },
  carouselList: {
    gap: 12,
    paddingRight: 4,
  },
});

const cStyles = StyleSheet.create({
  carouselCard: {
    width: CAROUSEL_CARD_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    gap: 4,
    ...Shadows.xs,
  },
  carouselIcon: {
    width: CAROUSEL_CARD_WIDTH - 24,
    height: 70,
    backgroundColor: '#F7F5F1',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  carouselEmoji: { fontSize: 24 },
  carouselBrand: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9B9488',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  carouselName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1C1C1A',
    lineHeight: 16,
  },
  carouselPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D4A3E',
    marginTop: 2,
  },
  carouselLink: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9B9488',
    marginTop: 4,
  },
});
