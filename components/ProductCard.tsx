import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions, Linking } from 'react-native';
import { Colors, Shadows } from '@/lib/theme';
import type { Product } from '@/lib/products';
import { cleanProductName } from '@/lib/clean-product-name';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 14;
const HORIZONTAL_PADDING = 20;
export const CARD_WIDTH = (SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - CARD_GAP) / 2;

const CATEGORY_ICONS: Record<string, string> = {
  Skincare: '\u2728',
  Supplements: '\u{1F48A}',
  Foods: '\u{1F957}',
  Herbal: '\u{1F33F}',
  Accessories: '\u{1F6CF}',
};

interface ProductCardProps {
  product: Product;
  onPress: (product: Product) => void;
}

function openAmazon(product: Product) {
  const url = product.asin
    ? `https://www.amazon.com/dp/${product.asin}`
    : `https://www.amazon.com/s?k=${encodeURIComponent(product.brand + ' ' + product.name)}`;
  Linking.openURL(url);
}

export default function ProductCard({ product, onPress }: ProductCardProps) {
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.92}
      onPress={() => onPress(product)}
    >
      {/* Image or icon area */}
      <View style={styles.iconBox}>
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} style={styles.productImage} resizeMode="contain" />
        ) : (
          <Text style={styles.categoryEmoji}>{CATEGORY_ICONS[product.category] || '\u2728'}</Text>
        )}
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{product.match_percent}%</Text>
        </View>
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.brand}>{product.brand}</Text>
        <Text style={styles.name} numberOfLines={2}>{cleanProductName(product.name, product.brand)}</Text>
        <Text style={styles.desc} numberOfLines={2}>{product.description}</Text>

        <View style={styles.bottomRow}>
          {product.price ? <Text style={styles.price}>{product.price}</Text> : null}
          <TouchableOpacity
            style={styles.amazonBtn}
            activeOpacity={0.8}
            onPress={(e) => { e.stopPropagation?.(); openAmazon(product); }}
          >
            <Text style={styles.amazonText}>Amazon {'\u2197'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  iconBox: {
    width: '100%',
    height: 90,
    backgroundColor: '#F7F5F1',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  productImage: {
    width: '70%',
    height: '70%',
  },
  categoryEmoji: {
    fontSize: 36,
  },
  badge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(45, 74, 62, 0.88)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  info: {
    padding: 14,
    paddingTop: 12,
    gap: 3,
    flex: 1,
  },
  brand: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9B9488',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 18,
    letterSpacing: -0.1,
  },
  desc: {
    fontSize: 11,
    fontWeight: '400',
    color: '#8A8A7A',
    lineHeight: 15,
    marginTop: 2,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D4A3E',
    letterSpacing: -0.2,
  },
  amazonBtn: {
    backgroundColor: '#F0EBE2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  amazonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B6358',
  },
});
