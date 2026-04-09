import { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import { Colors, Fonts, BorderRadius } from '@/lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function BellIcon({ size = 80 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none">
        <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="rgba(255,255,255,0.2)" strokeWidth={2} fill="rgba(255,255,255,0.05)" />
        <Path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="rgba(255,255,255,0.2)" strokeWidth={2} strokeLinecap="round" />
      </Svg>
      {/* Red notification badge */}
      <View style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontFamily: Fonts.bold, fontSize: 13, color: '#FFF' }}>1</Text>
      </View>
    </View>
  );
}

export default function PaywallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState<'yearly' | 'monthly'>('yearly');

  const trialEndDate = new Date();
  trialEndDate.setDate(trialEndDate.getDate() + 3);
  const dateStr = trialEndDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const goNext = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    scrollRef.current?.scrollTo({ x: SCREEN_WIDTH * nextPage, animated: true });
  };

  const subscribe = () => {
    // TODO: Integrate RevenueCat / StoreKit for real payment
    // For now, just navigate to the app
    router.replace('/(tabs)');
  };

  const skip = () => {
    router.replace('/(tabs)');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={['#08080F', '#0D0D1A']} style={StyleSheet.absoluteFill} />

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => { if (page > 0) { setPage(page - 1); scrollRef.current?.scrollTo({ x: SCREEN_WIDTH * (page - 1), animated: true }); } }}>
          <Text style={styles.topBack}>{page > 0 ? '‹' : ''}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={skip}>
          <Text style={styles.restore}>Restore</Text>
        </TouchableOpacity>
      </View>

      {/* Horizontal paging screens */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))}
      >
        {/* ═══ SCREEN 1: "We want you to try it for free" ═══ */}
        <View style={[styles.page, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.pageCenter}>
            <Text style={styles.heading}>We want you to{'\n'}try Glow for free.</Text>

            {/* Phone mockup placeholder */}
            <View style={styles.phoneMockup}>
              <View style={styles.mockScreen}>
                <Text style={{ fontSize: 40 }}>📸</Text>
                <Text style={styles.mockText}>AI Skin Scan</Text>
              </View>
            </View>
          </View>

          <View style={styles.pageBottom}>
            <View style={styles.noPayRow}>
              <Text style={styles.noPayCheck}>✓</Text>
              <Text style={styles.noPayText}>No Payment Due Now</Text>
            </View>
            <TouchableOpacity style={styles.blackBtn} onPress={goNext} activeOpacity={0.85}>
              <Text style={styles.blackBtnText}>Try for $0.00</Text>
            </TouchableOpacity>
            <Text style={styles.priceHint}>Just $29.99 per year ($2.49/mo)</Text>
          </View>
        </View>

        {/* ═══ SCREEN 2: "We'll send you a reminder" ═══ */}
        <View style={[styles.page, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.pageCenter}>
            <Text style={styles.heading}>We'll send you{'\n'}a reminder before your{'\n'}free trial ends</Text>
            <BellIcon size={100} />
          </View>

          <View style={styles.pageBottom}>
            <View style={styles.noPayRow}>
              <Text style={styles.noPayCheck}>✓</Text>
              <Text style={styles.noPayText}>No Payment Due Now</Text>
            </View>
            <TouchableOpacity style={styles.blackBtn} onPress={goNext} activeOpacity={0.85}>
              <Text style={styles.blackBtnText}>Continue for FREE</Text>
            </TouchableOpacity>
            <Text style={styles.priceHint}>Just $29.99 per year ($2.49/mo)</Text>
          </View>
        </View>

        {/* ═══ SCREEN 3: Plan selection + payment ═══ */}
        <View style={[styles.page, { paddingBottom: insets.bottom + 20 }]}>
          <ScrollView contentContainerStyle={styles.screen3Content} showsVerticalScrollIndicator={false}>
            <Text style={styles.heading}>Start your 3-day FREE{'\n'}trial to continue.</Text>

            {/* Timeline */}
            <View style={styles.timeline}>
              <View style={styles.timelineItem}>
                <View style={[styles.timelineDot, { backgroundColor: '#F59E0B' }]}>
                  <Text style={styles.timelineDotIcon}>🔓</Text>
                </View>
                <View style={styles.timelineTextArea}>
                  <Text style={styles.timelineTitle}>Today</Text>
                  <Text style={styles.timelineDesc}>Unlock all the app's features like AI skin scanning and more.</Text>
                </View>
              </View>
              <View style={styles.timelineLine} />
              <View style={styles.timelineItem}>
                <View style={[styles.timelineDot, { backgroundColor: '#F59E0B' }]}>
                  <Text style={styles.timelineDotIcon}>🔔</Text>
                </View>
                <View style={styles.timelineTextArea}>
                  <Text style={styles.timelineTitle}>In 2 Days - Reminder</Text>
                  <Text style={styles.timelineDesc}>We'll send you a reminder that your trial is ending soon.</Text>
                </View>
              </View>
              <View style={styles.timelineLine} />
              <View style={styles.timelineItem}>
                <View style={[styles.timelineDot, { backgroundColor: '#6B7280' }]}>
                  <Text style={styles.timelineDotIcon}>👑</Text>
                </View>
                <View style={styles.timelineTextArea}>
                  <Text style={styles.timelineTitle}>In 3 Days - Billing Starts</Text>
                  <Text style={styles.timelineDesc}>You'll be charged on {dateStr} unless you cancel anytime before.</Text>
                </View>
              </View>
            </View>

            {/* Plan cards */}
            <View style={styles.planRow}>
              <TouchableOpacity
                style={[styles.planCard, selectedPlan === 'monthly' && styles.planCardSelected]}
                onPress={() => setSelectedPlan('monthly')} activeOpacity={0.85}
              >
                <Text style={styles.planTitle}>Monthly</Text>
                <Text style={styles.planPrice}>$9.99 /mo</Text>
                <View style={[styles.radio, selectedPlan === 'monthly' && styles.radioSelected]} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.planCard, styles.planCardYearly, selectedPlan === 'yearly' && styles.planCardSelected]}
                onPress={() => setSelectedPlan('yearly')} activeOpacity={0.85}
              >
                <View style={styles.freeBadge}>
                  <Text style={styles.freeBadgeText}>3 DAYS FREE</Text>
                </View>
                <Text style={styles.planTitle}>Yearly</Text>
                <Text style={styles.planPrice}>$2.49 /mo</Text>
                <View style={[styles.radio, selectedPlan === 'yearly' && styles.radioSelected]}>
                  {selectedPlan === 'yearly' && <View style={styles.radioInner} />}
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.noPayRow}>
              <Text style={styles.noPayCheck}>✓</Text>
              <Text style={styles.noPayText}>No Payment Due Now</Text>
            </View>

            <TouchableOpacity style={styles.blackBtn} onPress={subscribe} activeOpacity={0.85}>
              <Text style={styles.blackBtnText}>Start My 3-Day Free Trial</Text>
            </TouchableOpacity>

            <Text style={styles.priceHint}>3 days free, then $29.99 per year ($2.49/mo)</Text>

            <TouchableOpacity onPress={skip} style={{ marginTop: 12 }}>
              <Text style={styles.skipText}>Maybe later</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </ScrollView>

      {/* Page dots */}
      <View style={[styles.dotsRow, { bottom: insets.bottom + 8 }]}>
        {[0, 1, 2].map(i => (
          <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 8 },
  topBack: { fontSize: 28, color: 'rgba(255,255,255,0.5)', fontWeight: '300', width: 30 },
  restore: { fontFamily: Fonts.medium, fontSize: 14, color: 'rgba(255,255,255,0.35)' },

  page: { width: SCREEN_WIDTH, flex: 1, justifyContent: 'space-between', paddingHorizontal: 24 },
  pageCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 32 },
  pageBottom: { gap: 14, alignItems: 'center' },

  heading: { fontFamily: Fonts.bold, fontSize: 28, color: '#FFFFFF', textAlign: 'center', lineHeight: 36, letterSpacing: -0.5 },

  // Phone mockup
  phoneMockup: { width: 200, height: 300, borderRadius: 24, backgroundColor: '#1A1A2E', borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  mockScreen: { alignItems: 'center', gap: 8 },
  mockText: { fontFamily: Fonts.medium, fontSize: 14, color: 'rgba(255,255,255,0.4)' },

  // No payment row
  noPayRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noPayCheck: { fontSize: 14, color: Colors.success },
  noPayText: { fontFamily: Fonts.medium, fontSize: 14, color: 'rgba(255,255,255,0.5)' },

  // Black CTA button (Cal AI style)
  blackBtn: { width: '100%', height: 56, borderRadius: 16, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' },
  blackBtnText: { fontFamily: Fonts.bold, fontSize: 17, color: '#000000' },

  priceHint: { fontFamily: Fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' },
  skipText: { fontFamily: Fonts.medium, fontSize: 14, color: 'rgba(255,255,255,0.25)', textAlign: 'center' },

  // Screen 3 content
  screen3Content: { paddingTop: 20, paddingBottom: 40, gap: 20, paddingHorizontal: 24 },

  // Timeline
  timeline: { gap: 0 },
  timelineItem: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  timelineDot: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  timelineDotIcon: { fontSize: 16 },
  timelineTextArea: { flex: 1, paddingBottom: 4 },
  timelineTitle: { fontFamily: Fonts.bold, fontSize: 15, color: '#FFF' },
  timelineDesc: { fontFamily: Fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 19, marginTop: 2 },
  timelineLine: { width: 2, height: 20, backgroundColor: 'rgba(255,255,255,0.1)', marginLeft: 17 },

  // Plan cards
  planRow: { flexDirection: 'row', gap: 12 },
  planCard: {
    flex: 1, backgroundColor: Colors.card, borderRadius: 16,
    padding: 16, borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', gap: 6, position: 'relative',
  },
  planCardYearly: {},
  planCardSelected: { borderColor: Colors.primary, backgroundColor: 'rgba(124,92,252,0.1)' },
  planTitle: { fontFamily: Fonts.semibold, fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  planPrice: { fontFamily: Fonts.bold, fontSize: 18, color: '#FFF' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  radioSelected: { borderColor: Colors.primary },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primary },
  freeBadge: { position: 'absolute', top: -1, right: -1, backgroundColor: Colors.success, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, borderBottomLeftRadius: 0, borderTopLeftRadius: 8 },
  freeBadgeText: { fontFamily: Fonts.bold, fontSize: 10, color: '#FFF', letterSpacing: 0.5 },

  // Page dots
  dotsRow: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.15)' },
  dotActive: { backgroundColor: '#FFF', width: 20 },
});
