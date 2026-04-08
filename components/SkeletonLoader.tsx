import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, BorderRadius, Spacing } from '@/lib/theme';

const { width: SW } = Dimensions.get('window');

function Shimmer({ style }: { style?: any }) {
  const translateX = useRef(new Animated.Value(-SW)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(translateX, {
        toValue: SW,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  return (
    <View style={[styles.shimmerWrap, style]}>
      <Animated.View style={[styles.shimmerSlide, { transform: [{ translateX }] }]}>
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.06)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

/** Skeleton for the home screen hero card */
export function HomeCardSkeleton() {
  return (
    <View style={styles.homeCard}>
      <Shimmer />
      <View style={styles.homeBadgeRow}>
        <View style={styles.pill} />
        <View style={[styles.pill, { width: 50 }]} />
      </View>
      <View style={[styles.bar, { width: '40%', marginTop: 16 }]} />
      <View style={[styles.bar, { width: '70%', height: 22, marginTop: 10 }]} />
      <View style={[styles.bar, { width: '90%', marginTop: 10 }]} />
      <View style={styles.metricsRow}>
        <View style={styles.metricPill} />
        <View style={styles.metricPill} />
        <View style={styles.metricPill} />
      </View>
    </View>
  );
}

/** Skeleton for action cards row on home screen */
export function HomeActionsSkeleton() {
  return (
    <View style={styles.actionsRow}>
      <View style={styles.actionCard}><Shimmer /></View>
      <View style={styles.actionCard}><Shimmer /></View>
    </View>
  );
}

/** Full home skeleton */
export function HomeSkeleton() {
  return (
    <View style={styles.container}>
      <HomeCardSkeleton />
      <HomeActionsSkeleton />
      <View style={[styles.bar, { width: '35%', height: 18, marginTop: 24, marginBottom: 12 }]} />
      <HomeActionsSkeleton />
    </View>
  );
}

/** Skeleton for plan screen */
export function PlanSkeleton() {
  return (
    <View style={styles.container}>
      {/* Tab pills */}
      <View style={[styles.actionsRow, { marginBottom: 20 }]}>
        <View style={[styles.pill, { width: 80, height: 36 }]} />
        <View style={[styles.pill, { width: 80, height: 36 }]} />
      </View>
      {/* Cards */}
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.planCard}>
          <Shimmer />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={styles.planIcon} />
            <View style={{ flex: 1, gap: 8 }}>
              <View style={[styles.bar, { width: '60%' }]} />
              <View style={[styles.bar, { width: '90%', height: 10 }]} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

/** Skeleton for progress screen */
export function ProgressSkeleton() {
  return (
    <View style={styles.container}>
      {/* Chart placeholder */}
      <View style={styles.chartPlaceholder}>
        <Shimmer />
      </View>
      {/* Photo grid */}
      <View style={[styles.bar, { width: '30%', height: 18, marginTop: 20, marginBottom: 12 }]} />
      <View style={styles.photoGrid}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.photoCell}><Shimmer /></View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  shimmerWrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    borderRadius: BorderRadius.lg,
  },
  shimmerSlide: {
    ...StyleSheet.absoluteFillObject,
    width: SW,
  },

  // Home
  homeCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    minHeight: 200,
    overflow: 'hidden',
  },
  homeBadgeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pill: {
    width: 90,
    height: 24,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.subtle,
  },
  bar: {
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.subtle,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
  },
  metricPill: {
    flex: 1,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.subtle,
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  actionCard: {
    flex: 1,
    height: 90,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.card,
    overflow: 'hidden',
  },

  // Plan
  planCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: 12,
    overflow: 'hidden',
  },
  planIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.subtle,
  },

  // Progress
  chartPlaceholder: {
    height: 180,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.card,
    overflow: 'hidden',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoCell: {
    width: (SW - Spacing.xl * 2 - 10) / 2,
    height: 120,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.card,
    overflow: 'hidden',
  },
});
