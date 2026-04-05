import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Circle, G, Polyline, Path, Rect, Line } from 'react-native-svg';
import { supabase } from '@/lib/supabase';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '@/lib/theme';
import type { Database, SkinType, AcneType, Severity } from '@/lib/database.types';
import { differenceInDays, format } from 'date-fns';

type Profile = Database['public']['Tables']['profiles']['Row'];
type SkinProfile = Database['public']['Tables']['skin_profiles']['Row'];
type PersonalizedPlan = Database['public']['Tables']['personalized_plans']['Row'];
type ProgressPhoto = Database['public']['Tables']['progress_photos']['Row'];

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const EXPLORE_GAP = Spacing.md;
const EXPLORE_CARD_W = (SCREEN_WIDTH - Spacing.xxl * 2 - EXPLORE_GAP) / 2;

const SKIN_TYPE_LABELS: Record<SkinType, string> = {
  oily: 'Oily', dry: 'Dry', combination: 'Combination', sensitive: 'Sensitive', normal: 'Normal',
};

const ACNE_TYPE_LABELS: Record<AcneType, string> = {
  hormonal: 'Hormonal', cystic: 'Cystic', comedonal: 'Comedonal', fungal: 'Fungal', inflammatory: 'Inflammatory',
};

/* ── Icon Components ── */

function CameraIcon({ color = '#333', size = 22 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={2} y={6} width={20} height={14} rx={3} stroke={color} strokeWidth={2} />
      <Circle cx={12} cy={13} r={4} stroke={color} strokeWidth={2} />
      <Rect x={8} y={3} width={8} height={3} rx={1} stroke={color} strokeWidth={1.5} />
    </Svg>
  );
}

function SearchIcon({ color = '#333', size = 16 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={10.5} cy={10.5} r={7} stroke={color} strokeWidth={2.5} />
      <Line x1={15.5} y1={15.5} x2={21} y2={21} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

function ClipboardIcon({ color = '#333', size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={4} width={16} height={18} rx={2} stroke={color} strokeWidth={2} />
      <Rect x={8} y={1} width={8} height={5} rx={1.5} stroke={color} strokeWidth={1.5} />
      <Line x1={8} y1={12} x2={16} y2={12} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Line x1={8} y1={16} x2={14} y2={16} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

function BottleIcon({ color = '#333', size = 32 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={8} y={1} width={8} height={3} rx={1} stroke={color} strokeWidth={1.5} />
      <Path d="M9 4 L8 8 L7 20 Q7 22 9 22 L15 22 Q17 22 17 20 L16 8 L15 4" stroke={color} strokeWidth={1.5} fill="none" strokeLinejoin="round" />
      <Line x1={8} y1={12} x2={16} y2={12} stroke={color} strokeWidth={1} strokeOpacity={0.4} />
    </Svg>
  );
}

function SaladIcon({ color = '#333', size = 32 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={13} r={8} stroke={color} strokeWidth={1.8} />
      <Path d="M12 7 C10 7 8 9 9 12 C10 10 12 9 12 7 Z" fill={color} fillOpacity={0.5} />
      <Path d="M12 7 C14 7 16 9 15 12 C14 10 12 9 12 7 Z" fill={color} fillOpacity={0.3} />
    </Svg>
  );
}

function LeafIcon({ color = '#333', size = 28 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 21 C6 21 6 12 12 6 C18 6 20 4 20 4 C20 4 18 16 12 18 C6 18 6 21 6 21 Z" stroke={color} strokeWidth={1.8} fill="none" />
      <Path d="M6 21 C10 15 14 12 20 4" stroke={color} strokeWidth={1.2} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function YogaIcon({ color = '#333', size = 32 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={5} r={2.5} stroke={color} strokeWidth={1.5} />
      <Path d="M12 8 L12 15" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M6 12 L12 10 L18 12" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8 22 L12 15 L16 22" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function DropletIcon({ color = '#333', size = 48 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3 C12 3 5 12 5 16 C5 19.866 8.134 22 12 22 C15.866 22 19 19.866 19 16 C19 12 12 3 12 3 Z" stroke={color} strokeWidth={1.8} fill="none" />
    </Svg>
  );
}

function SunIcon({ color = '#333', size = 48 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={5} stroke={color} strokeWidth={1.8} />
      <Line x1={12} y1={1} x2={12} y2={4} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={12} y1={20} x2={12} y2={23} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={1} y1={12} x2={4} y2={12} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={20} y1={12} x2={23} y2={12} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={4.2} y1={4.2} x2={6.3} y2={6.3} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={17.7} y1={17.7} x2={19.8} y2={19.8} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={4.2} y1={19.8} x2={6.3} y2={17.7} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={17.7} y1={6.3} x2={19.8} y2={4.2} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function ScaleIcon({ color = '#333', size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1={12} y1={3} x2={12} y2={20} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={4} y1={20} x2={20} y2={20} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={4} y1={7} x2={20} y2={7} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M4 7 L2 14 L6 14 Z" stroke={color} strokeWidth={1.5} fill="none" strokeLinejoin="round" />
      <Path d="M20 7 L18 14 L22 14 Z" stroke={color} strokeWidth={1.5} fill="none" strokeLinejoin="round" />
    </Svg>
  );
}

function HeartIcon({ color = '#333', size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 21 C12 21 3 14 3 8.5 C3 5.42 5.42 3 8.5 3 C10.24 3 11.91 3.81 12 5.08 C12.09 3.81 13.76 3 15.5 3 C18.58 3 21 5.42 21 8.5 C21 14 12 21 12 21 Z" stroke={color} strokeWidth={1.8} fill={color} fillOpacity={0.2} />
    </Svg>
  );
}

function ChatIcon({ color = '#333', size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 4 L20 4 Q22 4 22 6 L22 15 Q22 17 20 17 L8 17 L4 21 L4 17 Q2 17 2 15 L2 6 Q2 4 4 4 Z" stroke={color} strokeWidth={1.8} fill="none" />
    </Svg>
  );
}

function GearIcon({ color = '#333', size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={1.8} />
      <Path d="M12 1 L13.5 4.5 L17 3 L15.5 6.5 L19.5 6.5 L17 9 L21 10.5 L17 12 L21 13.5 L17 15 L19.5 17.5 L15.5 17.5 L17 21 L13.5 19.5 L12 23 L10.5 19.5 L7 21 L8.5 17.5 L4.5 17.5 L7 15 L3 13.5 L7 12 L3 10.5 L7 9 L4.5 6.5 L8.5 6.5 L7 3 L10.5 4.5 Z" stroke={color} strokeWidth={1.2} fill="none" />
    </Svg>
  );
}

function SparkleIcon({ color = '#fff', size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2 L13.5 9 L20 10.5 L13.5 12 L12 19 L10.5 12 L4 10.5 L10.5 9 Z" stroke={color} strokeWidth={1.5} fill={color} fillOpacity={0.3} />
      <Path d="M19 2 L19.8 5.2 L22 5.5 L19.8 5.8 L19 9 L18.2 5.8 L16 5.5 L18.2 5.2 Z" stroke={color} strokeWidth={1} fill={color} fillOpacity={0.3} />
    </Svg>
  );
}

function ChartIcon({ color = '#333', size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={14} width={4} height={8} rx={1} stroke={color} strokeWidth={1.5} fill={color} fillOpacity={0.2} />
      <Rect x={10} y={8} width={4} height={14} rx={1} stroke={color} strokeWidth={1.5} fill={color} fillOpacity={0.2} />
      <Rect x={17} y={3} width={4} height={19} rx={1} stroke={color} strokeWidth={1.5} fill={color} fillOpacity={0.2} />
    </Svg>
  );
}

/* ── Mini chart icon for results card ── */
function MiniChart({ size = 80 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size * 0.5} height={size * 0.35} viewBox="0 0 40 28">
        <Polyline
          points="2,24 10,18 18,22 26,10 34,14 38,4"
          fill="none"
          stroke="rgba(255,255,255,0.8)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [skinProfile, setSkinProfile] = useState<SkinProfile | null>(null);
  const [plan, setPlan] = useState<PersonalizedPlan | null>(null);
  const [lastProgress, setLastProgress] = useState<ProgressPhoto | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [profileRes, skinRes, planRes, progressRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('skin_profiles').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).single(),
      supabase.from('personalized_plans').select('*').eq('user_id', user.id).eq('is_active', true).single(),
      supabase.from('progress_photos').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).single(),
    ]);

    if (profileRes.data) setProfile(profileRes.data);
    if (skinRes.data) setSkinProfile(skinRes.data);
    if (planRes.data) setPlan(planRes.data);
    if (progressRes.data) setLastProgress(progressRes.data);
    setLoaded(true);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const daysSinceScan = skinProfile
    ? differenceInDays(new Date(), new Date(skinProfile.created_at))
    : null;

  const scanAgoLabel = daysSinceScan != null
    ? daysSinceScan === 0 ? 'Today' : daysSinceScan === 1 ? '1 day ago' : `${daysSinceScan} days ago`
    : null;

  const todayFormatted = format(new Date(), 'EEEE, MMM d');

  /* ══════════════════════════════════════════════════════════
     POST-SCAN HOME — shown after the user has a skin profile
     ══════════════════════════════════════════════════════════ */
  if (loaded && skinProfile) {
    return (
      <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.lg }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.appTitle}>Glow</Text>
            <Text style={styles.dateLabel}>{todayFormatted}</Text>
          </View>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.push('/(tabs)/plan')}>
            <ClipboardIcon color={Colors.text} size={18} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn}>
            <GearIcon color={Colors.text} size={18} />
          </TouchableOpacity>
        </View>

        {/* ── Search bar ── */}
        <View style={styles.searchBar}>
          <View style={styles.searchIconWrap}>
            <SearchIcon color={Colors.textMuted} size={16} />
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={() => {
              if (searchQuery.trim()) router.push('/(tabs)/scanner');
            }}
          />
        </View>

        {/* ── Scan a Product card ── */}
        <TouchableOpacity
          style={styles.scanProductCard}
          activeOpacity={0.85}
          onPress={() => router.push('/(tabs)/scanner')}
        >
          <View style={styles.scanProductIconCircle}>
            <CameraIcon color="#8B6914" size={22} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.scanProductTitle}>Scan a Product</Text>
            <Text style={styles.scanProductSubtext}>Snap a photo of any skincare product to see your match</Text>
          </View>
          <Text style={styles.scanProductArrow}>›</Text>
        </TouchableOpacity>

        {/* ── Your Results card (dark green) ── */}
        <TouchableOpacity
          style={styles.resultsCard}
          activeOpacity={0.85}
          onPress={() => router.push('/(tabs)/scan')}
        >
          <View style={styles.resultsHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <SparkleIcon color="#fff" size={18} />
              <Text style={styles.resultsTitle}>Your Results</Text>
            </View>
            {scanAgoLabel && (
              <View style={styles.resultsAgoBadge}>
                <Text style={styles.resultsAgoText}>✓ {scanAgoLabel}</Text>
              </View>
            )}
          </View>

          <View style={styles.resultsBody}>
            <MiniChart />
            <View style={styles.resultsInfo}>
              <Text style={styles.resultsLabel}>SKIN TYPE</Text>
              <Text style={styles.resultsValue}>{SKIN_TYPE_LABELS[skinProfile.skin_type]}</Text>
              <Text style={styles.resultsCta}>Tap to view your results →</Text>
            </View>
          </View>

          {/* Referral / share row */}
          <View style={styles.resultsShareRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.resultsShareText}>Invite a friend to get your{'\n'}complete analysis</Text>
            </View>
            <TouchableOpacity style={styles.shareButton} activeOpacity={0.8}>
              <Text style={styles.shareButtonText}>Share</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        {/* ── Your Product Matches ── */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Your Product Matches</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/scanner')}>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productMatchRow}>
          {([
            { brand: 'CERAVE', name: 'Hydrating Cleanser', icon: <BottleIcon color="#6B5B3E" size={48} /> },
            { brand: 'GOOD MOLECULES', name: 'Niacinamide Toner', icon: <DropletIcon color="#5B7B9B" size={48} /> },
            { brand: 'ELTAMD', name: 'UV Clear SPF 46', icon: <SunIcon color="#B8860B" size={48} /> },
          ] as const).map((p) => (
            <TouchableOpacity
              key={p.name}
              style={styles.productMatchCard}
              activeOpacity={0.8}
              onPress={() => router.push('/(tabs)/scanner')}
            >
              <View style={styles.productMatchIconWrap}>{p.icon}</View>
              <Text style={styles.productMatchBrand}>{p.brand}</Text>
              <Text style={styles.productMatchName} numberOfLines={2}>{p.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Explore grid ── */}
        <Text style={[styles.sectionTitle, { marginTop: Spacing.xxl }]}>Explore</Text>
        <View style={styles.exploreGrid}>
          <TouchableOpacity
            style={[styles.exploreCard, { backgroundColor: '#E8F0E8' }]}
            activeOpacity={0.8}
            onPress={() => router.push('/(tabs)/plan')}
          >
            <View style={[styles.exploreIconCircle, { backgroundColor: '#C8D8C8' }]}>
              <HeartIcon color="#4A7C4A" size={18} />
            </View>
            <Text style={styles.exploreCardTitle}>Your Plan</Text>
            <Text style={styles.exploreCardSub}>Personalized for you</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.exploreCard, { backgroundColor: '#E8E4F0' }]}
            activeOpacity={0.8}
            onPress={() => router.push('/(tabs)/scanner')}
          >
            <View style={[styles.exploreIconCircle, { backgroundColor: '#D0CCE0' }]}>
              <SearchIcon color="#5B4A7C" size={18} />
            </View>
            <Text style={styles.exploreCardTitle}>Discover</Text>
            <Text style={styles.exploreCardSub}>Explore any product.</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.exploreCard, { backgroundColor: '#F0E8E8' }]}
            activeOpacity={0.8}
            onPress={() => router.push('/(tabs)/progress')}
          >
            <View style={[styles.exploreIconCircle, { backgroundColor: '#E0CCC8' }]}>
              <ChartIcon color="#7C4A4A" size={18} />
            </View>
            <Text style={styles.exploreCardTitle}>Progress</Text>
            <Text style={styles.exploreCardSub}>Track your journey.</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.exploreCard, { backgroundColor: '#F5F0E0' }]}
            activeOpacity={0.8}
            onPress={() => router.push('/coach')}
          >
            <View style={[styles.exploreIconCircle, { backgroundColor: '#E8E0C0' }]}>
              <ChatIcon color="#6B5B3E" size={18} />
            </View>
            <Text style={styles.exploreCardTitle}>Skin Coach</Text>
            <Text style={styles.exploreCardSub}>Ask your assistant.</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating chat bubble */}
      <TouchableOpacity
        style={[styles.chatBubble, { bottom: insets.bottom - 8 }]}
        activeOpacity={0.85}
        onPress={() => router.push('/coach')}
      >
        <ChatIcon color={Colors.white} size={22} />
      </TouchableOpacity>
    </>
    );
  }

  /* ══════════════════════════════════════════════════════════
     PRE-SCAN WELCOME — shown before first skin scan
     ══════════════════════════════════════════════════════════ */
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.lg }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>
            {(() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; })()}, {profile?.full_name?.split(' ')[0] || 'Beautiful'}
          </Text>
          <Text style={styles.appTitle}>Glow</Text>
        </View>
        <View style={styles.leafIconWrap}>
          <LeafIcon color={Colors.primary} size={28} />
        </View>
      </View>

      {/* Welcome card + steps — only show after data loaded */}
      {loaded && !skinProfile && (
        <View style={styles.welcomeSection}>
          <View style={styles.welcomeCard}>
            <View style={styles.welcomeIconRow}>
              <BottleIcon color="rgba(255,255,255,0.85)" size={32} />
              <SaladIcon color="rgba(255,255,255,0.85)" size={32} />
              <LeafIcon color="rgba(255,255,255,0.85)" size={32} />
              <YogaIcon color="rgba(255,255,255,0.85)" size={32} />
            </View>
            <Text style={styles.welcomeTitle}>Your skin journey{'\n'}starts here</Text>
            <Text style={styles.welcomeSubtext}>
              Take a quick selfie and our AI will analyze your skin type, acne patterns, and create a personalized 4-pillar plan just for you.
            </Text>
            <TouchableOpacity
              style={styles.welcomeButton}
              activeOpacity={0.85}
              onPress={() => router.push('/(tabs)/scan')}
            >
              <Text style={styles.welcomeButtonText}>Scan My Skin</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.welcomeSteps}>
            {[
              { num: '1', label: 'Take a selfie', desc: 'Our AI analyzes your skin' },
              { num: '2', label: 'Get your plan', desc: 'Products, diet, herbal & lifestyle' },
              { num: '3', label: 'Track progress', desc: 'Weekly check-ins & insights' },
            ].map((step) => (
              <View key={step.num} style={styles.welcomeStep}>
                <View style={styles.welcomeStepNum}>
                  <Text style={styles.welcomeStepNumText}>{step.num}</Text>
                </View>
                <View style={styles.welcomeStepBody}>
                  <Text style={styles.welcomeStepLabel}>{step.label}</Text>
                  <Text style={styles.welcomeStepDesc}>{step.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.xxl },

  /* ── Header ── */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  dateLabel: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    marginTop: 2,
  },
  greeting: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
    marginBottom: Spacing.xxs,
  },
  leafIconWrap: {
    marginTop: Spacing.xs,
  },
  headerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginLeft: Spacing.sm,
  },

  /* ── Search bar ── */
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: Spacing.lg,
  },
  searchIconWrap: { marginRight: Spacing.sm },
  searchInput: {
    flex: 1,
    ...Typography.bodyMedium,
    color: Colors.text,
    padding: 0,
  },

  /* ── Scan a Product card ── */
  scanProductCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: '#E8DCC8',
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  scanProductIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF5E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanProductTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  scanProductSubtext: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  scanProductArrow: {
    fontSize: 24,
    color: Colors.textMuted,
    fontWeight: '300',
  },

  /* ── Your Results card ── */
  resultsCard: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.xl,
    marginBottom: Spacing.xxl,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
  },
  resultsAgoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.pill,
  },
  resultsAgoText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  resultsBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  resultsInfo: { flex: 1 },
  resultsLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1,
    marginBottom: 4,
  },
  resultsValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: Spacing.sm,
  },
  resultsCta: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  resultsShareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
    paddingTop: Spacing.lg,
  },
  resultsShareText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.white,
    lineHeight: 20,
  },
  shareButton: {
    backgroundColor: '#C8A050',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.pill,
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },

  /* ── Product Matches ── */
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.secondary,
  },
  productMatchRow: {
    gap: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  productMatchCard: {
    width: 160,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  productMatchIconWrap: {
    marginBottom: Spacing.md,
    alignSelf: 'center',
  },
  productMatchBrand: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  productMatchName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 18,
  },

  /* ── Compare Products ── */
  compareCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  compareIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0E8E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compareTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  compareSubtext: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  compareArrow: {
    fontSize: 20,
    color: Colors.textMuted,
  },

  /* ── Explore grid ── */
  exploreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: EXPLORE_GAP,
    marginTop: Spacing.md,
  },
  exploreCard: {
    width: EXPLORE_CARD_W,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    minHeight: 140,
    justifyContent: 'flex-end',
  },
  exploreIconCircle: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  exploreCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  exploreCardSub: {
    fontSize: 13,
    color: Colors.textSecondary,
  },

  /* ── Welcome (pre-scan) ── */
  welcomeSection: {
    marginTop: Spacing.lg,
    gap: Spacing.xl,
  },
  welcomeCard: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.xxl,
    alignItems: 'center',
    gap: Spacing.lg,
  },
  welcomeIconRow: { flexDirection: 'row', gap: Spacing.lg },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.white,
    textAlign: 'center',
    lineHeight: 32,
  },
  welcomeSubtext: {
    ...Typography.bodyMedium,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 22,
  },
  welcomeButton: {
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.pill,
    marginTop: Spacing.sm,
  },
  welcomeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  welcomeSteps: { gap: Spacing.md },
  welcomeStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  welcomeStepNum: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  welcomeStepNumText: { fontSize: 14, fontWeight: '700', color: Colors.white },
  welcomeStepBody: { flex: 1, gap: 2 },
  welcomeStepLabel: { fontSize: 15, fontWeight: '600', color: Colors.text },
  welcomeStepDesc: { fontSize: 13, color: Colors.textMuted },

  /* Floating chat bubble */
  chatBubble: {
    position: 'absolute',
    right: Spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.lg,
    zIndex: 100,
  },
});
