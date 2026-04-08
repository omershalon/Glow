import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Colors, Typography, BorderRadius, Spacing } from '@/lib/theme';

interface LoadingOverlayProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  steps?: string[];
}

export function LoadingOverlay({
  visible,
  title = 'Analyzing...',
  subtitle = 'Claude AI is working its magic',
  steps,
}: LoadingOverlayProps) {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Fade in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Rotate
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();

      // Pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none">
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <BlurView intensity={20} style={StyleSheet.absoluteFill} />
        <View style={styles.container}>
          <LinearGradient
            colors={['#FFFFFF', '#FFF8FB']}
            style={styles.card}
          >
            {/* Animated logo */}
            <Animated.View style={[styles.logoWrapper, { transform: [{ scale: pulseAnim }] }]}>
              <LinearGradient
                colors={[Colors.secondary, Colors.primary]}
                style={styles.logoCircle}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Animated.Text style={[styles.logoText, { transform: [{ rotate: rotation }] }]}>
                  ✨
                </Animated.Text>
              </LinearGradient>
            </Animated.View>

            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>

            {/* Progress dots */}
            <View style={styles.dotsRow}>
              {[0, 1, 2].map((i) => (
                <AnimatedDot key={i} delay={i * 200} />
              ))}
            </View>

            {/* Steps */}
            {steps && steps.length > 0 && (
              <View style={styles.stepsContainer}>
                {steps.map((step, i) => (
                  <View key={i} style={styles.stepRow}>
                    <View style={[styles.stepDot, i === 0 && styles.stepDotActive]} />
                    <Text style={[styles.stepText, i === 0 && styles.stepTextActive]}>
                      {step}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* SkinX branding */}
            <Text style={styles.brandText}>SkinX</Text>
          </LinearGradient>
        </View>
      </Animated.View>
    </Modal>
  );
}

function AnimatedDot({ delay }: { delay: number }) {
  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(bounceAnim, {
            toValue: -8,
            duration: 400,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(bounceAnim, {
            toValue: 0,
            duration: 400,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    }, delay);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <Animated.View
      style={[styles.dot, { transform: [{ translateY: bounceAnim }] }]}
    />
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 10, 15, 0.6)',
  },
  container: {
    width: '80%',
    maxWidth: 320,
  },
  card: {
    borderRadius: BorderRadius.xxl,
    padding: Spacing.xxl,
    alignItems: 'center',
    gap: Spacing.lg,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 40,
    elevation: 20,
  },
  logoWrapper: {
    marginBottom: Spacing.sm,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 32,
  },
  title: {
    ...Typography.headlineLarge,
    color: Colors.text,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'flex-end',
    height: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  stepsContainer: {
    width: '100%',
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: Spacing.lg,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.subtleDeep,
  },
  stepDotActive: {
    backgroundColor: Colors.primary,
  },
  stepText: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  stepTextActive: {
    color: Colors.text,
    fontWeight: '600',
  },
  brandText: {
    ...Typography.labelMedium,
    color: Colors.textLight,
    letterSpacing: 3,
  },
});
