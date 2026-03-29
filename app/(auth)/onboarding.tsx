import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Alert,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '@/lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const AGE_RANGES = ['Under 18', '18-24', '25-34', '35-44', '45+'];
const ACNE_DURATIONS = ['Less than 1 year', '1-3 years', '3-5 years', 'More than 5 years'];
const TRIED_PRODUCTS = [
  'Benzoyl Peroxide',
  'Salicylic Acid',
  'Retinoids',
  'Antibiotics',
  'Birth Control',
  'Accutane',
  'Natural/Herbal',
  'Nothing yet',
];
const KNOWN_ALLERGIES = [
  'Fragrance',
  'Parabens',
  'Sulfates',
  'Lanolin',
  'Latex',
  'Nickel',
  'Essential Oils',
  'None known',
];
const SKIN_CONCERNS = [
  'Active breakouts',
  'Acne scars',
  'Hyperpigmentation',
  'Large pores',
  'Oily skin',
  'Dryness/Flakiness',
  'Redness/Inflammation',
  'Blackheads/Whiteheads',
  'Cystic nodules',
  'Uneven skin tone',
];

const TOTAL_STEPS = 4;

export default function OnboardingScreen() {
  const router = useRouter();
  const progressAnim = useRef(new Animated.Value(1)).current;

  const [currentStep, setCurrentStep] = useState(1);
  const [ageRange, setAgeRange] = useState('');
  const [acneDuration, setAcneDuration] = useState('');
  const [triedProducts, setTriedProducts] = useState<string[]>([]);
  const [knownAllergies, setKnownAllergies] = useState<string[]>([]);
  const [skinConcerns, setSkinConcerns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const animateProgress = (step: number) => {
    Animated.spring(progressAnim, {
      toValue: step,
      useNativeDriver: false,
      tension: 40,
      friction: 8,
    }).start();
  };

  const goToStep = (step: number) => {
    setCurrentStep(step);
    animateProgress(step);
  };

  const toggleItem = (
    item: string,
    list: string[],
    setList: (l: string[]) => void
  ) => {
    if (list.includes(item)) {
      setList(list.filter((i) => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('onboarding_data').insert({
          user_id: user.id,
          age_range: ageRange || 'Not specified',
          acne_duration: acneDuration || 'Not specified',
          tried_products: triedProducts,
          known_allergies: knownAllergies,
          skin_concerns: skinConcerns,
        });
      }
    } catch (_) {
      // non-fatal — navigate anyway
    } finally {
      setLoading(false);
      router.replace('/(tabs)');
    }
  };

  const canProceed = () => {
    if (currentStep === 1) return !!ageRange;
    if (currentStep === 2) return !!acneDuration;
    if (currentStep === 3) return knownAllergies.length > 0;
    if (currentStep === 4) return skinConcerns.length > 0;
    return false;
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [1, TOTAL_STEPS],
    outputRange: ['25%', '100%'],
  });

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Let's get to know you</Text>
      <Text style={styles.stepSubtitle}>
        This helps us personalize your skincare plan to your unique needs.
      </Text>

      <Text style={styles.questionLabel}>What's your age range?</Text>
      <View style={styles.optionsGrid}>
        {AGE_RANGES.map((range) => (
          <TouchableOpacity
            key={range}
            style={[styles.optionChip, ageRange === range && styles.optionChipSelected]}
            onPress={() => setAgeRange(range)}
          >
            <Text style={[styles.optionChipText, ageRange === range && styles.optionChipTextSelected]}>
              {range}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Your skin history</Text>
      <Text style={styles.stepSubtitle}>
        Understanding your journey helps us provide more targeted solutions.
      </Text>

      <Text style={styles.questionLabel}>How long have you struggled with acne?</Text>
      <View style={styles.optionsList}>
        {ACNE_DURATIONS.map((duration) => (
          <TouchableOpacity
            key={duration}
            style={[styles.listOption, acneDuration === duration && styles.listOptionSelected]}
            onPress={() => setAcneDuration(duration)}
          >
            <View style={[styles.radioCircle, acneDuration === duration && styles.radioCircleSelected]}>
              {acneDuration === duration && <View style={styles.radioInner} />}
            </View>
            <Text style={[styles.listOptionText, acneDuration === duration && styles.listOptionTextSelected]}>
              {duration}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.questionLabel, { marginTop: Spacing.xl }]}>
        What have you tried before? (select all that apply)
      </Text>
      <View style={styles.optionsGrid}>
        {TRIED_PRODUCTS.map((product) => (
          <TouchableOpacity
            key={product}
            style={[
              styles.optionChip,
              triedProducts.includes(product) && styles.optionChipSelected,
            ]}
            onPress={() => toggleItem(product, triedProducts, setTriedProducts)}
          >
            <Text
              style={[
                styles.optionChipText,
                triedProducts.includes(product) && styles.optionChipTextSelected,
              ]}
            >
              {product}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Allergies & sensitivities</Text>
      <Text style={styles.stepSubtitle}>
        We'll make sure to exclude any ingredients that could trigger reactions for you.
      </Text>

      <Text style={styles.questionLabel}>Do you have any known allergies? (select all that apply)</Text>
      <View style={styles.optionsGrid}>
        {KNOWN_ALLERGIES.map((allergy) => (
          <TouchableOpacity
            key={allergy}
            style={[
              styles.optionChip,
              knownAllergies.includes(allergy) && styles.optionChipSelected,
              allergy === 'None known' && knownAllergies.includes(allergy) && styles.optionChipNone,
            ]}
            onPress={() => {
              if (allergy === 'None known') {
                setKnownAllergies(['None known']);
              } else {
                const filtered = knownAllergies.filter((a) => a !== 'None known');
                toggleItem(allergy, filtered, setKnownAllergies);
              }
            }}
          >
            <Text
              style={[
                styles.optionChipText,
                knownAllergies.includes(allergy) && styles.optionChipTextSelected,
              ]}
            >
              {allergy}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Your skin concerns</Text>
      <Text style={styles.stepSubtitle}>
        Select all that apply — your plan will specifically target these areas.
      </Text>

      <Text style={styles.questionLabel}>What are your main skin concerns?</Text>
      <View style={styles.optionsGrid}>
        {SKIN_CONCERNS.map((concern) => (
          <TouchableOpacity
            key={concern}
            style={[
              styles.optionChip,
              skinConcerns.includes(concern) && styles.optionChipSelected,
            ]}
            onPress={() => toggleItem(concern, skinConcerns, setSkinConcerns)}
          >
            <Text
              style={[
                styles.optionChipText,
                skinConcerns.includes(concern) && styles.optionChipTextSelected,
              ]}
            >
              {concern}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Progress header */}
      <LinearGradient colors={['#FFF0F5', '#FFE8F0']} style={styles.progressHeader}>
        <View style={styles.stepIndicator}>
          <Text style={styles.stepCount}>Step {currentStep} of {TOTAL_STEPS}</Text>
        </View>
        <View style={styles.progressBarBg}>
          <Animated.View style={[styles.progressBarFill, { width: progressWidth }]}>
            <LinearGradient
              colors={[Colors.secondary, Colors.primary]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </Animated.View>
        </View>
        <View style={styles.stepDots}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.stepDot,
                i + 1 <= currentStep && styles.stepDotActive,
                i + 1 === currentStep && styles.stepDotCurrent,
              ]}
            />
          ))}
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
      </ScrollView>

      {/* Bottom navigation */}
      <View style={styles.bottomNav}>
        {currentStep > 1 && (
          <TouchableOpacity
            style={styles.backNavButton}
            onPress={() => goToStep(currentStep - 1)}
          >
            <Text style={styles.backNavText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            styles.nextButton,
            !canProceed() && styles.nextButtonDisabled,
            currentStep === 1 && styles.nextButtonFull,
          ]}
          onPress={() => {
            if (currentStep < TOTAL_STEPS) {
              goToStep(currentStep + 1);
            } else {
              handleFinish();
            }
          }}
          disabled={!canProceed() || loading}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={canProceed() ? [Colors.primary, Colors.primaryDark] : ['#D0D0D0', '#B0B0B0']}
            style={styles.nextGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.nextText}>
              {loading
                ? 'Saving...'
                : currentStep === TOTAL_STEPS
                ? 'Start My Journey'
                : 'Continue'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  progressHeader: {
    paddingTop: 60,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.xxl,
  },
  stepIndicator: {
    marginBottom: Spacing.md,
  },
  stepCount: {
    ...Typography.labelMedium,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: Colors.subtleDeep,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  stepDots: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.subtleDeep,
  },
  stepDotActive: {
    backgroundColor: Colors.primaryLight,
  },
  stepDotCurrent: {
    backgroundColor: Colors.primary,
    width: 24,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xxl,
    paddingBottom: 120,
  },
  stepContent: {
    paddingTop: Spacing.xxl,
  },
  stepTitle: {
    ...Typography.displaySmall,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  stepSubtitle: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.xxl,
  },
  questionLabel: {
    ...Typography.headlineSmall,
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  optionChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.pill,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  optionChipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.subtle,
  },
  optionChipNone: {
    borderColor: Colors.success,
    backgroundColor: Colors.successLight,
  },
  optionChipText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  optionChipTextSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  optionsList: {
    gap: Spacing.sm,
  },
  listOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    gap: Spacing.md,
  },
  listOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.subtle,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleSelected: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  listOptionText: {
    ...Typography.bodyMedium,
    color: Colors.text,
  },
  listOptionTextSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  bottomNav: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xxl,
    paddingBottom: 40,
    paddingTop: Spacing.lg,
    gap: Spacing.md,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  backNavButton: {
    height: 54,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backNavText: {
    ...Typography.labelLarge,
    color: Colors.textSecondary,
  },
  nextButton: {
    flex: 1,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    ...Shadows.md,
  },
  nextButtonFull: {
    flex: 1,
  },
  nextButtonDisabled: {
    opacity: 0.6,
  },
  nextGradient: {
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextText: {
    ...Typography.headlineSmall,
    color: Colors.white,
  },
});
