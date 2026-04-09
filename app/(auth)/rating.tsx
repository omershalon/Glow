import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as StoreReview from 'expo-store-review';
import { Colors, Fonts } from '@/lib/theme';

export default function RatingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const go = async () => {
      try {
        const available = await StoreReview.isAvailableAsync();
        if (available) {
          await StoreReview.requestReview();
        }
      } catch {}

      // Auto-advance after a short delay regardless
      setTimeout(() => {
        router.push({
          pathname: '/(auth)/results-preview',
          params,
        });
      }, 2000);
    };

    go();
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={['#08080F', '#100830', '#1A0845']} style={StyleSheet.absoluteFill} />
      <View style={styles.center}>
        <Text style={styles.stars}>★ ★ ★ ★ ★</Text>
        <Text style={styles.title}>Enjoying the experience?</Text>
        <Text style={styles.sub}>Your feedback helps us improve</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 32 },
  stars: { fontSize: 32, color: '#FCD34D', letterSpacing: 8 },
  title: { fontFamily: Fonts.bold, fontSize: 24, color: '#FFF', textAlign: 'center' },
  sub: { fontFamily: Fonts.regular, fontSize: 15, color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
});
