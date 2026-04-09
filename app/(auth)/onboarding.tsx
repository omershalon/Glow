import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts } from '@/lib/theme';
import AgeRuler from '@/components/onboarding/AgeRuler';
import AnimatedGraph from '@/components/onboarding/AnimatedGraph';
import {
  MaleIcon, FemaleIcon, OtherGenderIcon,
  OilyIcon, DryIcon, ComboIcon, SensitiveIcon, NormalIcon, QuestionIcon,
  ClockIcon, TargetIcon, TrendDownIcon, ShieldIcon, SparkleIcon,
  LeafIcon, BlockIcon, FlameIcon,
  PillIcon, BottleIcon, SaladIcon, DoctorIcon, FacialIcon, EmptyIcon,
  BreakoutIcon, ScarIcon, SunIcon,
} from '@/components/onboarding/Icons';

const { width: SW } = Dimensions.get('window');

type Ans = {
  gender: string; age: string; skinType: string; duration: string;
  tried: string[]; concerns: string[]; goal: string; holistic: string;
  barriers: string[]; commitment: string;
};
const EMPTY: Ans = { gender: '', age: '', skinType: '', duration: '', tried: [], concerns: [], goal: '', holistic: '', barriers: [], commitment: '' };

// 10 questions + 3 affirmations + 1 graph = 14 screens
const TOTAL = 14;

// ═══════════════════════════════════════════════════
//  REUSABLE
// ═══════════════════════════════════════════════════

function Option({ label, selected, onPress, icon }: { label: string; selected: boolean; onPress: () => void; icon?: React.ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Haptics.selectionAsync();
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.96, friction: 5, tension: 300, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 100, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity style={[st.option, selected && st.optionSel]} onPress={handlePress} activeOpacity={0.8}>
        {icon && <View style={st.optionIcon}>{icon}</View>}
        <Text style={[st.optionText, selected && st.optionTextSel]}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[st.chip, selected && st.chipSel]}
      onPress={() => { Haptics.selectionAsync(); onPress(); }} activeOpacity={0.8}>
      <Text style={[st.chipText, selected && st.chipTextSel]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ═══════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [a, setA] = useState<Ans>(EMPTY);
  const prog = useRef(new Animated.Value(0)).current;
  const enterAnim = useRef(new Animated.Value(0)).current;

  const animateIn = () => {
    enterAnim.setValue(0);
    Animated.timing(enterAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  };

  const goTo = (s: number) => {
    Animated.timing(enterAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setStep(s);
      Animated.spring(prog, { toValue: s / (TOTAL - 1), friction: 10, tension: 40, useNativeDriver: false }).start();
      animateIn();
    });
  };

  const next = () => goTo(step + 1);
  const back = () => { if (step > 0) goTo(step - 1); };
  useEffect(() => { animateIn(); }, []);

  const finish = () => {
    router.push({ pathname: '/(auth)/photo-capture', params: { onboardingData: JSON.stringify(a) } });
  };

  const toggleMulti = (key: 'tried' | 'concerns' | 'barriers', val: string) => {
    setA(p => ({ ...p, [key]: p[key].includes(val) ? p[key].filter((v: string) => v !== val) : [...p[key], val] }));
  };

  const canNext = (): boolean => {
    switch (step) {
      case 0: return !!a.gender;
      case 1: return !!a.age;
      case 2: return !!a.skinType;
      case 3: return true; // graph (always can proceed)
      case 4: return !!a.duration;
      case 5: return true; // affirmation
      case 6: return a.tried.length > 0;
      case 7: return a.concerns.length > 0;
      case 8: return true; // affirmation
      case 9: return !!a.goal;
      case 10: return true; // affirmation
      case 11: return !!a.holistic;
      case 12: return a.barriers.length > 0;
      case 13: return !!a.commitment;
      default: return false;
    }
  };

  const isLastStep = step === 13;

  const renderStep = () => {
    switch (step) {
      // ── 0: Gender ──
      case 0: {
        const genderIcons: Record<string, React.ReactNode> = {
          Male: <MaleIcon color={a.gender === 'Male' ? '#FFF' : undefined} />,
          Female: <FemaleIcon color={a.gender === 'Female' ? '#FFF' : undefined} />,
          Other: <OtherGenderIcon color={a.gender === 'Other' ? '#FFF' : undefined} />,
        };
        return (
          <View style={st.content}>
            <Text style={st.title}>Choose your gender</Text>
            <Text style={st.subtitle}>This helps us personalize your skin analysis</Text>
            <View style={st.optionList}>
              {['Male', 'Female', 'Other'].map(o => (
                <Option key={o} label={o} icon={genderIcons[o]} selected={a.gender === o} onPress={() => setA(p => ({ ...p, gender: o }))} />
              ))}
            </View>
          </View>
        );
      }

      // ── 1: Age (horizontal ruler) ──
      case 1: return (
        <View style={st.content}>
          <Text style={st.title}>How old are you?</Text>
          <Text style={st.subtitle}>Drag the ruler to select your age</Text>
          <AgeRuler value={a.age} onChange={v => setA(p => ({ ...p, age: v }))} />
        </View>
      );

      // ── 2: Skin type ──
      case 2: {
        const skinIcons: Record<string, React.ReactNode> = {
          Oily: <OilyIcon />, Dry: <DryIcon />, Normal: <NormalIcon />,
        };
        return (
          <View style={st.content}>
            <Text style={st.title}>What's your skin type?</Text>
            <View style={st.optionList}>
              {['Oily', 'Dry', 'Normal'].map(o => (
                <Option key={o} label={o} icon={skinIcons[o]} selected={a.skinType === o} onPress={() => setA(p => ({ ...p, skinType: o }))} />
              ))}
            </View>
          </View>
        );
      }

      // ── 3: Animated graph proof screen ──
      case 3: return <AnimatedGraph skinType={a.skinType} />;

      // ── 4: Duration ──
      case 4: return (
        <View style={st.content}>
          <Text style={st.title}>How long have you dealt with skin issues?</Text>
          <View style={st.optionList}>
            {['Just started', 'Less than a year', '1 - 3 years', '3 - 5 years', '5+ years'].map(o => (
              <Option key={o} label={o} selected={a.duration === o} onPress={() => setA(p => ({ ...p, duration: o }))} />
            ))}
          </View>
        </View>
      );

      // ── 5: Affirmation 1 ──
      case 5: return (
        <View style={st.affirmCenter}>
          <Text style={st.affirmBig}>You're not alone.</Text>
          <Text style={st.affirmBody}>
            85% of people aged {a.age || '18-34'} deal with the same skin struggles. You're already taking the first step.
          </Text>
        </View>
      );

      // ── 6: What tried ──
      case 6: return (
        <View style={st.content}>
          <Text style={st.title}>What have you tried so far?</Text>
          <Text style={st.subtitle}>Select everything that applies</Text>
          <View style={st.chipGrid}>
            {['Prescription medications', 'Products from the store', 'Home remedies', 'Changed my diet', 'Saw a dermatologist', 'Facials or peels', 'Nothing yet'].map(o => (
              <Chip key={o} label={o} selected={a.tried.includes(o)} onPress={() => toggleMulti('tried', o)} />
            ))}
          </View>
        </View>
      );

      // ── 7: Concerns ──
      case 7: return (
        <View style={st.content}>
          <Text style={st.title}>What bothers you the most?</Text>
          <Text style={st.subtitle}>Pick up to 3</Text>
          <View style={st.chipGrid}>
            {['Breakouts', 'Acne scars', 'Dark spots', 'Large pores', 'Oily skin', 'Dry patches', 'Redness', 'Blackheads', 'Cystic acne', 'Uneven skin tone'].map(o => (
              <Chip key={o} label={o} selected={a.concerns.includes(o)}
                onPress={() => { if (a.concerns.includes(o) || a.concerns.length < 3) toggleMulti('concerns', o); }} />
            ))}
          </View>
          {a.concerns.length > 0 && <Text style={st.countLabel}>{a.concerns.length}/3 selected</Text>}
        </View>
      );

      // ── 8: Affirmation 2 (personalized stat) ──
      case 8: return (
        <View style={st.affirmCenter}>
          <Text style={st.affirmHuge}>67%</Text>
          <Text style={st.affirmBody}>
            People with {a.skinType?.toLowerCase() || 'your'} skin dealing with {a.concerns[0]?.toLowerCase() || 'breakouts'} see an average 67% improvement within 6 weeks.
          </Text>
        </View>
      );

      // ── 9: Goal ──
      case 9: {
        const goalIcons: Record<string, React.ReactNode> = {
          'Completely clear skin': <SparkleIcon />,
          'Fewer breakouts': <TrendDownIcon />,
          'Manage what I have': <NormalIcon />,
          'Prevent future issues': <ShieldIcon />,
          'Fade scars and marks': <ScarIcon />,
        };
        return (
          <View style={st.content}>
            <Text style={st.title}>What's your goal?</Text>
            <Text style={st.subtitle}>We'll build your plan around this</Text>
            <View style={st.optionList}>
              {['Completely clear skin', 'Fewer breakouts', 'Manage what I have', 'Prevent future issues', 'Fade scars and marks'].map(o => (
                <Option key={o} label={o} icon={goalIcons[o]} selected={a.goal === o} onPress={() => setA(p => ({ ...p, goal: o }))} />
              ))}
            </View>
          </View>
        );
      }

      // ── 10: Affirmation 3 (journey) ──
      case 10: return (
        <View style={st.affirmCenter}>
          <Text style={st.affirmBig}>Totally achievable.</Text>
          <Text style={st.affirmBody}>
            Most people with your profile start seeing real changes in 3 to 6 weeks. Consistency is everything.
          </Text>
        </View>
      );

      // ── 11: Holistic ──
      case 11: return (
        <View style={st.content}>
          <Text style={st.title}>Are you open to natural approaches?</Text>
          <Text style={st.subtitle}>Things like herbal remedies, diet changes, and clean skincare</Text>
          <View style={st.optionList}>
            {['Yes, I prefer natural', 'Open to trying', 'Not really', 'Tell me more'].map(o => (
              <Option key={o} label={o} selected={a.holistic === o} onPress={() => setA(p => ({ ...p, holistic: o }))} />
            ))}
          </View>
        </View>
      );

      // ── 12: Barriers ──
      case 12: return (
        <View style={st.content}>
          <Text style={st.title}>What's been your biggest challenge?</Text>
          <View style={st.chipGrid}>
            {["Don't know what to use", 'Too much conflicting info', "Can't afford a dermatologist", 'Nothing seems to work', 'No consistent routine', "Don't know what's causing it"].map(o => (
              <Chip key={o} label={o} selected={a.barriers.includes(o)} onPress={() => toggleMulti('barriers', o)} />
            ))}
          </View>
        </View>
      );

      // ── 13: Commitment ──
      case 13: return (
        <View style={st.content}>
          <Text style={st.title}>How committed are you?</Text>
          <View style={st.optionList}>
            {['Just browsing', 'Willing to try', 'Ready to commit', 'All in'].map(o => (
              <Option key={o} label={o} selected={a.commitment === o} onPress={() => setA(p => ({ ...p, commitment: o }))} />
            ))}
          </View>
        </View>
      );

      default: return null;
    }
  };

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <LinearGradient colors={['#08080F', '#100830', '#1A0845']} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={st.header}>
        {step > 0 ? (
          <TouchableOpacity onPress={back} style={st.backBtn} activeOpacity={0.7}>
            <Text style={st.backArrow}>{'‹'}</Text>
          </TouchableOpacity>
        ) : <View style={st.backBtn} />}
        <View style={st.progWrap}>
          <View style={st.progBar}>
            <Animated.View style={[st.progFill, { width: prog.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
          </View>
        </View>
        <View style={st.backBtn} />
      </View>

      {/* Content */}
      <Animated.View style={[st.body, {
        opacity: enterAnim,
        transform: [{ translateY: enterAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
      }]}>
        <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {renderStep()}
        </ScrollView>
      </Animated.View>

      {/* Next button */}
      <View style={[st.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[st.nextBtn, !canNext() && st.nextBtnOff]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); isLastStep ? finish() : next(); }}
          disabled={!canNext()} activeOpacity={0.85}>
          <Text style={st.nextBtnText}>{isLastStep ? "Let's go" : 'Next'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════
const st = StyleSheet.create({
  root: { flex: 1 },

  // Header — minimal, just back arrow + thin progress
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  backArrow: { fontSize: 30, color: 'rgba(255,255,255,0.35)', fontWeight: '300' },
  progWrap: { flex: 1, paddingHorizontal: 12 },
  progBar: { height: 3, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' },
  progFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 2 },

  body: { flex: 1 },
  scroll: { paddingHorizontal: 28, paddingTop: 28, paddingBottom: 24 },

  // Content — generous spacing
  content: { gap: 24 },
  title: { fontFamily: Fonts.bold, fontSize: 30, color: '#FFF', lineHeight: 38, letterSpacing: -0.6 },
  subtitle: { fontFamily: Fonts.regular, fontSize: 15, color: 'rgba(255,255,255,0.35)', lineHeight: 22, marginTop: -14 },

  // Options — clean, no background fill, just a subtle border
  optionList: { gap: 12 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 17, paddingHorizontal: 20, borderRadius: 14,
    backgroundColor: 'transparent',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  optionIcon: { width: 24, alignItems: 'center' },
  optionSel: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(124,92,252,0.08)',
  },
  optionText: { fontFamily: Fonts.regular, fontSize: 16, color: 'rgba(255,255,255,0.55)' },
  optionTextSel: { color: '#FFF', fontFamily: Fonts.medium },

  // Chips — lighter, more breathing room
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    paddingVertical: 11, paddingHorizontal: 18, borderRadius: 22,
    backgroundColor: 'transparent',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  chipSel: { borderColor: Colors.primary, backgroundColor: 'rgba(124,92,252,0.08)' },
  chipText: { fontFamily: Fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.45)' },
  chipTextSel: { color: '#FFF', fontFamily: Fonts.medium },
  countLabel: { fontFamily: Fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: 8 },

  // Affirmations — lots of space, calm
  affirmCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 60, minHeight: 420 },
  affirmBig: { fontFamily: Fonts.bold, fontSize: 32, color: '#FFF', textAlign: 'center', letterSpacing: -0.5, lineHeight: 40 },
  affirmHuge: { fontFamily: Fonts.bold, fontSize: 72, color: Colors.primary, letterSpacing: -3 },
  affirmBody: { fontFamily: Fonts.regular, fontSize: 16, color: 'rgba(255,255,255,0.38)', textAlign: 'center', lineHeight: 25, marginTop: 20 },

  // Bottom — clean black button
  bottomBar: { paddingHorizontal: 28, paddingTop: 10 },
  nextBtn: { height: 54, borderRadius: 14, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  nextBtnOff: { opacity: 0.2 },
  nextBtnText: { fontFamily: Fonts.semibold, fontSize: 16, color: '#000' },
});
