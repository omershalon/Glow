import { useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Animated, Image, Dimensions, Linking } from 'react-native';
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
  isFavorite?: boolean;
  onToggleFavorite?: (product: Product) => void;
}

function openAmazon(product: Product) {
  const url = product.asin
    ? `https://www.amazon.com/dp/${product.asin}`
    : `https://www.amazon.com/s?k=${encodeURIComponent(product.brand + ' ' + product.name)}`;
  Linking.openURL(url);
}

export default function ProductCard({ product, onPress, isFavorite, onToggleFavorite }: ProductCardProps) {
  const heartScale = useRef(new Animated.Value(1)).current;

  // 6 bubbles, each with translate + opacity
  const BUBBLE_COUNT = 8;
  const bubbleSizes = useRef<number[]>(Array(BUBBLE_COUNT).fill(6)).current;
  const bubbles = useRef(
    Array.from({ length: BUBBLE_COUNT }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0),
    }))
  ).current;

  const onHeartPressIn = useCallback(() => {
    Animated.spring(heartScale, { toValue: 0.7, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  }, []);

  const onHeartPressOut = useCallback(() => {
    Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 12 }).start();
  }, []);

  const triggerBubbles = useCallback(() => {
    const FIXED_SIZES =  [5, 8, 5, 7, 5, 8, 6, 7];
    const FIXED_ANGLES = [0, 0.8, 1.6, 2.4, 3.2, 3.9, 4.7, 5.5];
    const FIXED_DISTS  = [28, 22, 30, 24, 26, 32, 20, 28];
    const animations = bubbles.map((b, i) => {
      bubbleSizes[i] = FIXED_SIZES[i];
      const angle = FIXED_ANGLES[i];
      const distance = FIXED_DISTS[i];
      b.x.setValue(0);
      b.y.setValue(0);
      b.opacity.setValue(1);
      b.scale.setValue(0);
      return Animated.parallel([
        Animated.timing(b.x, { toValue: Math.cos(angle) * distance, duration: 400, useNativeDriver: true }),
        Animated.timing(b.y, { toValue: Math.sin(angle) * distance, duration: 400, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(b.scale, { toValue: 1, duration: 150, useNativeDriver: true }),
          Animated.timing(b.scale, { toValue: 0, duration: 250, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(b.opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
          Animated.timing(b.opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
      ]);
    });
    Animated.parallel(animations).start();
  }, []);

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
        {onToggleFavorite && (
          <Pressable
            style={styles.heartBtn}
            onPress={(e) => { e.stopPropagation?.(); onToggleFavorite(product); triggerBubbles(); }}
            onPressIn={onHeartPressIn}
            onPressOut={onHeartPressOut}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Animated.Text style={[styles.heartIcon, isFavorite && styles.heartActive, { transform: [{ scale: heartScale }] }]}>
              {isFavorite ? '\u2665' : '\u2661'}
            </Animated.Text>
            {bubbles.map((b, i) => (
              <Animated.View
                key={i}
                pointerEvents="none"
                style={[
                  styles.bubble,
                  {
                    width: bubbleSizes[i],
                    height: bubbleSizes[i],
                    borderRadius: bubbleSizes[i] / 2,
                    opacity: b.opacity,
                    transform: [{ translateX: b.x }, { translateY: b.y }, { scale: b.scale }],
                  },
                ]}
              />
            ))}
          </Pressable>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.brand}>{product.brand}</Text>
        <Text style={styles.name}>{cleanProductName(product.name, product.brand)}</Text>

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
    height: 220,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  iconBox: {
    width: '100%',
    height: 110,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  productImage: {
    width: '80%',
    height: '80%',
  },
  categoryEmoji: {
    fontSize: 36,
  },
  heartBtn: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartIcon: {
    fontSize: 24,
    color: '#C4BDB0',
  },
  heartActive: {
    color: '#E8507A',
  },
  bubble: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E8507A',
  },
  badge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(124, 92, 252, 0.88)',
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
    paddingTop: 8,
    gap: 0,
  },
  brand: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9B9488',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  name: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1A1A2E',
    lineHeight: 15,
    letterSpacing: -0.1,
    marginBottom: 2,
  },
  desc: {
    fontSize: 11,
    fontWeight: '400',
    color: '#8A8A7A',
    lineHeight: 15,
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
    color: Colors.primary,
    letterSpacing: -0.2,
  },
  amazonBtn: {
    backgroundColor: 'rgba(124, 92, 252, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  amazonText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },
});
