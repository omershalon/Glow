import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Polyline } from 'react-native-svg';
import { Colors, Fonts } from '@/lib/theme';

const { width: SW } = Dimensions.get('window');
const CARD_W = SW * 0.7;

const TESTIMONIALS = [
  { name: 'Sarah, 24', quote: "My skin hasn't been this clear since high school. The holistic plan actually worked." },
  { name: 'Marcus, 19', quote: "I stopped spending money on random products. This told me exactly what my skin needed." },
  { name: 'Priya, 31', quote: "The AI scan spotted things my dermatologist missed. The natural remedies are a game-changer." },
];

function CheckIcon({ size = 16, color = Colors.success }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline points="20 6 9 17 4 12" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

export default function SocialProofScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 }]}>
      <LinearGradient colors={['#08080F', '#100830', '#1A0845']} style={StyleSheet.absoluteFill} />

      {/* Stat */}
      <View style={s.statBlock}>
        <Text style={s.statNum}>92%</Text>
        <Text style={s.statText}>of users see improvement in 4 weeks</Text>
      </View>

      {/* Testimonial cards — compact, no flex stretch */}
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.cardsRow}
          snapToInterval={CARD_W + 12}
          decelerationRate="fast"
        >
          {TESTIMONIALS.map((t) => (
            <View key={t.name} style={s.card}>
              <Text style={s.stars}>{'★ ★ ★ ★ ★'}</Text>
              <Text style={s.quote}>"{t.quote}"</Text>
              <Text style={s.name}>{t.name}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Rating */}
      <View style={s.ratingBlock}>
        <Text style={s.ratingStars}>★ ★ ★ ★ ★</Text>
        <Text style={s.ratingText}>4.8 from 2,400+ reviews</Text>
      </View>

      {/* CTA */}
      <View style={s.bottom}>
        <View style={s.noPay}>
          <CheckIcon size={14} />
          <Text style={s.noPayText}>No Payment Due Now</Text>
        </View>
        <TouchableOpacity style={s.cta} onPress={() => router.push('/(auth)/onboarding')} activeOpacity={0.85}>
          <Text style={s.ctaText}>Start My Skin Analysis</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-between', gap: 24 },

  statBlock: { alignItems: 'center', gap: 8, paddingHorizontal: 32 },
  statNum: { fontFamily: Fonts.bold, fontSize: 60, color: Colors.primary, letterSpacing: -2 },
  statText: { fontFamily: Fonts.regular, fontSize: 17, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 24 },

  cardsRow: { paddingHorizontal: 24, gap: 12 },
  card: {
    width: CARD_W, backgroundColor: Colors.card,
    borderRadius: 18, padding: 20, gap: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  stars: { fontSize: 13, color: '#FCD34D', letterSpacing: 3 },
  quote: { fontFamily: Fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 21 },
  name: { fontFamily: Fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.3)' },

  ratingBlock: { alignItems: 'center', gap: 4 },
  ratingStars: { fontSize: 16, color: '#FCD34D', letterSpacing: 4 },
  ratingText: { fontFamily: Fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.35)' },

  bottom: { alignItems: 'center', gap: 12, paddingHorizontal: 24 },
  noPay: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noPayText: { fontFamily: Fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.35)' },
  cta: { width: '100%', height: 54, borderRadius: 14, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  ctaText: { fontFamily: Fonts.bold, fontSize: 16, color: '#000' },
});
