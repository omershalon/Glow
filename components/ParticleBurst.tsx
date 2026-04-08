import { useRef, useImperativeHandle, forwardRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

const COLORS = ['#7C5CFC', '#A78BFA', '#C4B5FD', '#5B21B6', '#7C5CFC', '#A78BFA', '#C4B5FD', '#5B21B6'];
const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
const TRAVEL = 28;
const DURATION = 600;

export interface ParticleBurstHandle {
  trigger: () => void;
}

const ParticleBurst = forwardRef<ParticleBurstHandle>((_, ref) => {
  const anims = useRef(ANGLES.map(() => ({
    pos: new Animated.ValueXY({ x: 0, y: 0 }),
    opacity: new Animated.Value(0),
  }))).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useImperativeHandle(ref, () => ({
    trigger() {
      animRef.current?.stop();
      // Reset all
      anims.forEach(a => {
        a.pos.setValue({ x: 0, y: 0 });
        a.opacity.setValue(1);
      });

      const animations = anims.map((a, i) => {
        const rad = (ANGLES[i] * Math.PI) / 180;
        const tx = Math.round(Math.cos(rad) * TRAVEL);
        const ty = Math.round(Math.sin(rad) * TRAVEL);
        return Animated.parallel([
          Animated.timing(a.pos, {
            toValue: { x: tx, y: ty },
            duration: DURATION,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.delay(DURATION * 0.4),
            Animated.timing(a.opacity, {
              toValue: 0,
              duration: DURATION * 0.6,
              useNativeDriver: true,
            }),
          ]),
        ]);
      });

      animRef.current = Animated.stagger(18, animations);
      animRef.current.start();
    },
  }));

  return (
    <View style={styles.container} pointerEvents="none">
      {anims.map((a, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            { backgroundColor: COLORS[i] },
            {
              opacity: a.opacity,
              transform: [{ translateX: a.pos.x }, { translateY: a.pos.y }],
            },
          ]}
        />
      ))}
    </View>
  );
});

ParticleBurst.displayName = 'ParticleBurst';
export default ParticleBurst;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 0,
    height: 0,
    zIndex: 100,
  },
  dot: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 2,
  },
});
