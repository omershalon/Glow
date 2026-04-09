import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Line, Rect, Polyline } from 'react-native-svg';
import { Colors, Fonts } from '@/lib/theme';

// ── SVG Feature Icons (no emojis) ──

function CameraIcon({ size = 24, color = Colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={12} cy={13} r={4} stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

function LeafIcon({ size = 24, color = Colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M17 8c2-5-7-6-13-2 4 8 11 8 13 2z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M6 16c2-2 4-3 8-4" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function ChartIcon({ size = 24, color = Colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

function ScanLogoIcon({ size = 80 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: 'rgba(124,92,252,0.12)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(124,92,252,0.25)' }}>
      <Svg width={size * 0.45} height={size * 0.45} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={10} r={4} stroke={Colors.primary} strokeWidth={2} />
        <Path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke={Colors.primary} strokeWidth={2} strokeLinecap="round" />
        <Path d="M20 4l-3 3M4 4l3 3M12 1v3" stroke={Colors.primary} strokeWidth={1.5} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function CheckIcon({ size = 16, color = Colors.success }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline points="20 6 9 17 4 12" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]}>
      <LinearGradient colors={['#08080F', '#100830', '#1A0845']} style={StyleSheet.absoluteFill} />

      {/* Hero */}
      <View style={s.hero}>
        <ScanLogoIcon size={90} />
        <Text style={s.appName}>SkinX</Text>
        <Text style={s.tagline}>Clear skin starts with{'\n'}understanding your skin.</Text>
      </View>

      {/* Features — SVG icons, no emojis */}
      <View style={s.features}>
        {[
          { icon: <CameraIcon />, text: 'AI-powered skin analysis' },
          { icon: <LeafIcon />, text: 'Personalized holistic plan' },
          { icon: <ChartIcon />, text: 'Track your progress weekly' },
        ].map((f) => (
          <View key={f.text} style={s.featureRow}>
            <View style={s.featureIconWrap}>{f.icon}</View>
            <Text style={s.featureText}>{f.text}</Text>
          </View>
        ))}
      </View>

      {/* Bottom */}
      <View style={s.bottom}>
        <View style={s.noPay}>
          <CheckIcon size={14} color={Colors.success} />
          <Text style={s.noPayText}>No Payment Due Now</Text>
        </View>

        <TouchableOpacity style={s.ctaButton} onPress={() => router.push('/(auth)/social-proof')} activeOpacity={0.85}>
          <Text style={s.ctaText}>Get Started</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(auth)/login')} activeOpacity={0.7}>
          <Text style={s.loginLink}>I already have an account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'space-between' },
  hero: { alignItems: 'center', gap: 16, paddingHorizontal: 32 },
  appName: { fontFamily: Fonts.bold, fontSize: 38, color: '#FFFFFF', letterSpacing: -1 },
  tagline: { fontFamily: Fonts.regular, fontSize: 18, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 26 },

  features: { gap: 20, paddingHorizontal: 40 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  featureIconWrap: { width: 28, alignItems: 'center' },
  featureText: { fontFamily: Fonts.medium, fontSize: 16, color: 'rgba(255,255,255,0.65)' },

  bottom: { alignItems: 'center', gap: 14, paddingHorizontal: 24 },
  noPay: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noPayText: { fontFamily: Fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.4)' },

  ctaButton: { width: '100%', height: 56, borderRadius: 16, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  ctaText: { fontFamily: Fonts.bold, fontSize: 17, color: '#000' },

  loginLink: { fontFamily: Fonts.medium, fontSize: 14, color: 'rgba(255,255,255,0.35)', marginTop: 4 },
});
