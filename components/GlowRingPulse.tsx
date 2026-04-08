import { useRef, useImperativeHandle, forwardRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

const RING_COUNT = 3;
const STAGGER_MS = 200;
const DURATION = 800;

export interface GlowRingPulseHandle {
  trigger: () => void;
}

const GlowRingPulse = forwardRef<GlowRingPulseHandle>((_, ref) => {
  const rings = useRef(
    Array.from({ length: RING_COUNT }, () => ({
      scale: new Animated.Value(0.8),
      opacity: new Animated.Value(0),
    }))
  ).current;

  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useImperativeHandle(ref, () => ({
    trigger() {
      animRef.current?.stop();

      rings.forEach(r => {
        r.scale.setValue(0.8);
        r.opacity.setValue(0.7);
      });

      const animations = rings.map(r =>
        Animated.parallel([
          Animated.timing(r.scale, {
            toValue: 2.2,
            duration: DURATION,
            useNativeDriver: true,
          }),
          Animated.timing(r.opacity, {
            toValue: 0,
            duration: DURATION,
            useNativeDriver: true,
          }),
        ])
      );

      animRef.current = Animated.stagger(STAGGER_MS, animations);
      animRef.current.start();
    },
  }));

  return (
    <View style={styles.container} pointerEvents="none">
      {rings.map((r, i) => (
        <Animated.View
          key={i}
          style={[
            styles.ring,
            {
              opacity: r.opacity,
              transform: [{ scale: r.scale }],
            },
          ]}
        />
      ))}
    </View>
  );
});

GlowRingPulse.displayName = 'GlowRingPulse';
export default GlowRingPulse;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 0,
    height: 0,
    zIndex: 99,
  },
  ring: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(124,92,252,0.6)',
  },
});
