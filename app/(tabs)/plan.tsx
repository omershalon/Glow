import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '@/lib/theme';
import type {
  Database,
  ProductsPillar,
  DietPillar,
  HerbalPillar,
  LifestylePillar,
} from '@/lib/database.types';
import { PillarCard } from '@/components/PillarCard';

type PersonalizedPlan = Database['public']['Tables']['personalized_plans']['Row'];

type PillarTab = 'products' | 'diet' | 'herbal' | 'lifestyle';

const PILLAR_TABS: { key: PillarTab; label: string; icon: string; color: string }[] = [
  { key: 'products', label: 'Products', icon: '🧴', color: Colors.primary },
  { key: 'diet', label: 'Diet', icon: '🥗', color: Colors.success },
  { key: 'herbal', label: 'Herbal', icon: '🌿', color: '#34A870' },
  { key: 'lifestyle', label: 'Lifestyle', icon: '🧘', color: Colors.secondary },
];

export default function PlanScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [plan, setPlan] = useState<PersonalizedPlan | null>(null);
  const [activeTab, setActiveTab] = useState<PillarTab>('products');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('personalized_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    setPlan(data || null);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  const generatePlan = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch skin profile
    const { data: skinProfile } = await supabase
      .from('skin_profiles')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!skinProfile) {
      Alert.alert(
        'Skin scan required',
        'Please complete your skin scan first to generate a personalized plan.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Scan Now', onPress: () => router.push('/(tabs)/scan') },
        ]
      );
      return;
    }

    // Fetch onboarding data
    const { data: onboarding } = await supabase
      .from('onboarding_data')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    setGenerating(true);
    try {
      console.log('Plan gen: starting Claude call');
      const controller = new AbortController();
      const timeout = setTimeout(() => { controller.abort(); console.error('Plan gen: TIMED OUT after 30s'); }, 30000);
      const contextInfo = `Skin Profile:
- Skin Type: ${skinProfile.skin_type}
- Acne Type: ${skinProfile.acne_type}
- Severity: ${skinProfile.severity}
- Analysis Notes: ${skinProfile.analysis_notes}
${onboarding ? `\nUser Background:
- Age Range: ${onboarding.age_range}
- Acne Duration: ${onboarding.acne_duration}
- Previously tried: ${(onboarding.tried_products ?? []).join(', ') || 'None'}
- Known Allergies: ${(onboarding.known_allergies ?? []).join(', ') || 'None'}
- Main Concerns: ${(onboarding.skin_concerns ?? []).join(', ') || 'Not specified'}` : ''}`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4000,
          messages: [{
            role: 'user',
            content: `Dermatologist AI. Create a skincare plan for: ${skinProfile.skin_type} skin, ${skinProfile.acne_type} acne, ${skinProfile.severity} severity.${onboarding?.known_allergies?.length ? ` Avoid: ${onboarding.known_allergies.join(', ')}.` : ''}

Return ONLY valid JSON, no markdown:
{"products_pillar":{"morning_routine":[{"step":1,"name":"","product_type":"","key_ingredients":[],"instructions":""},{"step":2,"name":"","product_type":"","key_ingredients":[],"instructions":""},{"step":3,"name":"","product_type":"","key_ingredients":[],"instructions":""}],"evening_routine":[{"step":1,"name":"","product_type":"","key_ingredients":[],"instructions":""},{"step":2,"name":"","product_type":"","key_ingredients":[],"instructions":""},{"step":3,"name":"","product_type":"","key_ingredients":[],"instructions":""},{"step":4,"name":"","product_type":"","key_ingredients":[],"instructions":""}],"ingredients_to_use":["","","","","",""],"ingredients_to_avoid":["","","","","",""],"top_product_recommendations":["","","","",""]},"diet_pillar":{"foods_to_eat":[{"food":"","reason":"","frequency":""},{"food":"","reason":"","frequency":""},{"food":"","reason":"","frequency":""},{"food":"","reason":"","frequency":""}],"foods_to_reduce":[{"food":"","reason":"","frequency":""},{"food":"","reason":"","frequency":""},{"food":"","reason":"","frequency":""}],"meal_swaps":[{"instead_of":"","try":"","why":""},{"instead_of":"","try":"","why":""}],"supplements":[{"name":"","dose":"","benefit":""},{"name":"","dose":"","benefit":""}],"hydration_tips":["",""]},"herbal_pillar":{"remedies":[{"name":"","form":"","dosage":"","application":"","evidence":"","caution":null},{"name":"","form":"","dosage":"","application":"","evidence":"","caution":null}],"diy_masks":[{"name":"","ingredients":[],"instructions":"","frequency":""}],"teas":[{"name":"","benefit":"","preparation":""},{"name":"","benefit":"","preparation":""}]},"lifestyle_pillar":{"daily_habits":[{"habit":"","frequency":"","why":"","how_to_start":""},{"habit":"","frequency":"","why":"","how_to_start":""},{"habit":"","frequency":"","why":"","how_to_start":""}],"sleep_tips":["","",""],"stress_management":["","",""],"exercise_guidance":"","things_to_avoid":["","",""]}}`,
          }],
        }),
      });

      console.log('Plan gen: Claude responded', response.status);
      if (!response.ok) {
        const err = await response.text();
        console.error('Claude plan error:', err);
        throw new Error(err);
      }

      const claudeData = await response.json();
      console.log('Plan gen: parsed response, saving to DB');
      const text = claudeData.content.find((b: any) => b.type === 'text')?.text ?? '';
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const plan = JSON.parse(cleaned);

      // Deactivate old plans
      await supabase
        .from('personalized_plans')
        .update({ is_active: false })
        .eq('user_id', user.id);

      // Save new plan
      await supabase.from('personalized_plans').insert({
        user_id: user.id,
        skin_profile_id: skinProfile.id,
        products_pillar: plan.products_pillar,
        diet_pillar: plan.diet_pillar,
        herbal_pillar: plan.herbal_pillar,
        lifestyle_pillar: plan.lifestyle_pillar,
        is_active: true,
      });

      console.log('Plan gen: done, fetching plan');
      await fetchPlan();
    } catch (err) {
      console.error('Plan generation error:', err);
      Alert.alert('Error', 'Could not generate your plan. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const renderProductsPillar = (products: ProductsPillar) => (
    <View style={styles.pillarContent}>
      {/* Morning Routine */}
      <View style={styles.routineSection}>
        <View style={styles.routineHeader}>
          <Text style={styles.routineHeaderEmoji}>🌅</Text>
          <Text style={styles.routineHeaderTitle}>Morning Routine</Text>
        </View>
        {products.morning_routine.map((step) => (
          <PillarCard key={step.step} style={styles.routineCard}>
            <View style={styles.routineStepRow}>
              <View style={styles.stepNumberBadge}>
                <Text style={styles.stepNumber}>{step.step}</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepName}>{step.name}</Text>
                <Text style={styles.stepType}>{step.product_type}</Text>
                <Text style={styles.stepInstructions}>{step.instructions}</Text>
                {step.key_ingredients.length > 0 && (
                  <View style={styles.ingredientsRow}>
                    {step.key_ingredients.slice(0, 3).map((ing) => (
                      <View key={ing} style={styles.ingredientTag}>
                        <Text style={styles.ingredientTagText}>{ing}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </PillarCard>
        ))}
      </View>

      {/* Evening Routine */}
      <View style={styles.routineSection}>
        <View style={styles.routineHeader}>
          <Text style={styles.routineHeaderEmoji}>🌙</Text>
          <Text style={styles.routineHeaderTitle}>Evening Routine</Text>
        </View>
        {products.evening_routine.map((step) => (
          <PillarCard key={step.step} style={styles.routineCard}>
            <View style={styles.routineStepRow}>
              <View style={[styles.stepNumberBadge, { backgroundColor: '#3D1A28' }]}>
                <Text style={styles.stepNumber}>{step.step}</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepName}>{step.name}</Text>
                <Text style={styles.stepType}>{step.product_type}</Text>
                <Text style={styles.stepInstructions}>{step.instructions}</Text>
                {step.key_ingredients.length > 0 && (
                  <View style={styles.ingredientsRow}>
                    {step.key_ingredients.slice(0, 3).map((ing) => (
                      <View key={ing} style={styles.ingredientTag}>
                        <Text style={styles.ingredientTagText}>{ing}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </PillarCard>
        ))}
      </View>

      {/* Ingredients guide */}
      <View style={styles.ingredientsSection}>
        <PillarCard>
          <Text style={styles.ingredientsSectionTitle}>Ingredients to Use</Text>
          <View style={styles.ingredientsList}>
            {products.ingredients_to_use.map((ing) => (
              <View key={ing} style={[styles.ingredientListItem, { backgroundColor: Colors.successLight }]}>
                <Text style={styles.ingredientListDot}>✓</Text>
                <Text style={[styles.ingredientListText, { color: Colors.success }]}>{ing}</Text>
              </View>
            ))}
          </View>
        </PillarCard>

        <PillarCard>
          <Text style={styles.ingredientsSectionTitle}>Ingredients to Avoid</Text>
          <View style={styles.ingredientsList}>
            {products.ingredients_to_avoid.map((ing) => (
              <View key={ing} style={[styles.ingredientListItem, { backgroundColor: Colors.errorLight }]}>
                <Text style={styles.ingredientListDot}>✗</Text>
                <Text style={[styles.ingredientListText, { color: Colors.error }]}>{ing}</Text>
              </View>
            ))}
          </View>
        </PillarCard>
      </View>
    </View>
  );

  const renderDietPillar = (diet: DietPillar) => (
    <View style={styles.pillarContent}>
      <PillarCard>
        <Text style={styles.pillarSectionTitle}>Foods to Eat More</Text>
        {diet.foods_to_eat.map((food) => (
          <View key={food.food} style={styles.foodItem}>
            <View style={styles.foodItemTop}>
              <Text style={styles.foodName}>{food.food}</Text>
              <View style={styles.frequencyBadge}>
                <Text style={styles.frequencyText}>{food.frequency}</Text>
              </View>
            </View>
            <Text style={styles.foodReason}>{food.reason}</Text>
          </View>
        ))}
      </PillarCard>

      <PillarCard>
        <Text style={styles.pillarSectionTitle}>Foods to Reduce</Text>
        {diet.foods_to_reduce.map((food) => (
          <View key={food.food} style={[styles.foodItem, styles.reduceItem]}>
            <View style={styles.foodItemTop}>
              <Text style={[styles.foodName, { color: Colors.error }]}>{food.food}</Text>
            </View>
            <Text style={styles.foodReason}>{food.reason}</Text>
          </View>
        ))}
      </PillarCard>

      <PillarCard>
        <Text style={styles.pillarSectionTitle}>Smart Swaps</Text>
        {diet.meal_swaps.map((swap, i) => (
          <View key={i} style={styles.swapItem}>
            <View style={styles.swapRow}>
              <Text style={styles.swapFrom}>{swap.instead_of}</Text>
              <Text style={styles.swapArrow}>→</Text>
              <Text style={styles.swapTo}>{swap.try}</Text>
            </View>
            <Text style={styles.swapWhy}>{swap.why}</Text>
          </View>
        ))}
      </PillarCard>

      {diet.supplements.length > 0 && (
        <PillarCard>
          <Text style={styles.pillarSectionTitle}>Recommended Supplements</Text>
          {diet.supplements.map((supp) => (
            <View key={supp.name} style={styles.supplementItem}>
              <View style={styles.supplementHeader}>
                <Text style={styles.supplementName}>{supp.name}</Text>
                <View style={styles.doseBadge}>
                  <Text style={styles.doseText}>{supp.dose}</Text>
                </View>
              </View>
              <Text style={styles.supplementBenefit}>{supp.benefit}</Text>
            </View>
          ))}
        </PillarCard>
      )}
    </View>
  );

  const renderHerbalPillar = (herbal: HerbalPillar) => (
    <View style={styles.pillarContent}>
      <PillarCard>
        <Text style={styles.pillarSectionTitle}>Evidence-Backed Remedies</Text>
        {herbal.remedies.map((remedy) => (
          <View key={remedy.name} style={styles.remedyItem}>
            <View style={styles.remedyHeader}>
              <Text style={styles.remedyName}>{remedy.name}</Text>
              <View style={styles.remedyFormBadge}>
                <Text style={styles.remedyFormText}>{remedy.form}</Text>
              </View>
            </View>
            <View style={styles.remedyDetail}>
              <Text style={styles.remedyDetailLabel}>Dosage: </Text>
              <Text style={styles.remedyDetailValue}>{remedy.dosage}</Text>
            </View>
            <View style={styles.remedyDetail}>
              <Text style={styles.remedyDetailLabel}>How to use: </Text>
              <Text style={styles.remedyDetailValue}>{remedy.application}</Text>
            </View>
            <LinearGradient colors={['#E8F7F1', '#D4F0E5']} style={styles.evidenceBox}>
              <Text style={styles.evidenceLabel}>Evidence: </Text>
              <Text style={styles.evidenceText}>{remedy.evidence}</Text>
            </LinearGradient>
            {remedy.caution && (
              <View style={styles.cautionBox}>
                <Text style={styles.cautionText}>⚠️ {remedy.caution}</Text>
              </View>
            )}
          </View>
        ))}
      </PillarCard>

      {herbal.diy_masks.length > 0 && (
        <PillarCard>
          <Text style={styles.pillarSectionTitle}>DIY Face Masks</Text>
          {herbal.diy_masks.map((mask) => (
            <View key={mask.name} style={styles.maskItem}>
              <Text style={styles.maskName}>{mask.name}</Text>
              <Text style={styles.maskFrequency}>{mask.frequency}</Text>
              <Text style={styles.maskInstructions}>{mask.instructions}</Text>
              <View style={styles.maskIngredients}>
                {mask.ingredients.map((ing) => (
                  <View key={ing} style={styles.maskIngredientChip}>
                    <Text style={styles.maskIngredientText}>{ing}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </PillarCard>
      )}

      {herbal.teas.length > 0 && (
        <PillarCard>
          <Text style={styles.pillarSectionTitle}>Beneficial Teas</Text>
          {herbal.teas.map((tea) => (
            <View key={tea.name} style={styles.teaItem}>
              <Text style={styles.teaName}>{tea.name}</Text>
              <Text style={styles.teaBenefit}>{tea.benefit}</Text>
              <Text style={styles.teaPrep}>{tea.preparation}</Text>
            </View>
          ))}
        </PillarCard>
      )}
    </View>
  );

  const renderLifestylePillar = (lifestyle: LifestylePillar) => (
    <View style={styles.pillarContent}>
      <PillarCard>
        <Text style={styles.pillarSectionTitle}>Daily Habits Checklist</Text>
        {lifestyle.daily_habits.map((habit) => (
          <View key={habit.habit} style={styles.habitItem}>
            <View style={styles.habitCheckbox} />
            <View style={styles.habitContent}>
              <View style={styles.habitHeader}>
                <Text style={styles.habitName}>{habit.habit}</Text>
                <View style={styles.habitFrequencyBadge}>
                  <Text style={styles.habitFrequencyText}>{habit.frequency}</Text>
                </View>
              </View>
              <Text style={styles.habitWhy}>{habit.why}</Text>
              <Text style={styles.habitHow}>How to start: {habit.how_to_start}</Text>
            </View>
          </View>
        ))}
      </PillarCard>

      <PillarCard>
        <Text style={styles.pillarSectionTitle}>Sleep Tips</Text>
        {lifestyle.sleep_tips.map((tip, i) => (
          <View key={i} style={styles.tipItem}>
            <Text style={styles.tipBullet}>🌙</Text>
            <Text style={styles.tipText}>{tip}</Text>
          </View>
        ))}
      </PillarCard>

      <PillarCard>
        <Text style={styles.pillarSectionTitle}>Stress Management</Text>
        {lifestyle.stress_management.map((tip, i) => (
          <View key={i} style={styles.tipItem}>
            <Text style={styles.tipBullet}>🧘</Text>
            <Text style={styles.tipText}>{tip}</Text>
          </View>
        ))}
      </PillarCard>

      <PillarCard>
        <Text style={styles.pillarSectionTitle}>Exercise Guidance</Text>
        <Text style={styles.exerciseText}>{lifestyle.exercise_guidance}</Text>
      </PillarCard>

      {lifestyle.things_to_avoid.length > 0 && (
        <PillarCard>
          <Text style={styles.pillarSectionTitle}>Things to Avoid</Text>
          {lifestyle.things_to_avoid.map((thing, i) => (
            <View key={i} style={[styles.tipItem, styles.avoidItem]}>
              <Text style={styles.tipBullet}>⛔</Text>
              <Text style={[styles.tipText, { color: Colors.error }]}>{thing}</Text>
            </View>
          ))}
        </PillarCard>
      )}
    </View>
  );

  const renderContent = () => {
    if (!plan) return null;
    switch (activeTab) {
      case 'products': return renderProductsPillar(plan.products_pillar as unknown as ProductsPillar);
      case 'diet': return renderDietPillar(plan.diet_pillar as unknown as DietPillar);
      case 'herbal': return renderHerbalPillar(plan.herbal_pillar as unknown as HerbalPillar);
      case 'lifestyle': return renderLifestylePillar(plan.lifestyle_pillar as unknown as LifestylePillar);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <LinearGradient
        colors={['#FFF0F5', '#FFE0ED']}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Your Skincare Plan</Text>
        <Text style={styles.headerSubtitle}>
          Personalized 4-pillar approach for your skin
        </Text>

        {/* Pillar tabs */}
        {plan && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabsScroll}
            contentContainerStyle={styles.tabsContainer}
          >
            {PILLAR_TABS.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tab,
                  activeTab === tab.key && [styles.tabActive, { borderColor: tab.color }],
                ]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text style={styles.tabIcon}>{tab.icon}</Text>
                <Text
                  style={[
                    styles.tabLabel,
                    activeTab === tab.key && [styles.tabLabelActive, { color: tab.color }],
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </LinearGradient>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading your plan...</Text>
        </View>
      ) : !plan ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>📋</Text>
          <Text style={styles.emptyTitle}>No Plan Yet</Text>
          <Text style={styles.emptySubtitle}>
            Complete your skin scan to generate your personalized 4-pillar plan
          </Text>
          <TouchableOpacity
            style={[styles.generateButton, generating && styles.buttonDisabled]}
            onPress={generatePlan}
            disabled={generating}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[Colors.secondary, Colors.primary]}
              style={styles.generateGradient}
            >
              <Text style={styles.generateButtonText}>
                {generating ? 'Generating...' : 'Generate My Plan'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {renderContent()}
        </ScrollView>
      )}

      {/* Ask AI floating button */}
      {plan && (
        <TouchableOpacity style={styles.askAiButton} activeOpacity={0.9}>
          <LinearGradient
            colors={[Colors.secondary, Colors.primary]}
            style={styles.askAiGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.askAiText}>Ask AI 💬</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.lg,
    paddingBottom: 0,
  },
  headerTitle: {
    ...Typography.displaySmall,
    color: Colors.text,
  },
  headerSubtitle: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  tabsScroll: {
    marginHorizontal: -Spacing.xxl,
  },
  tabsContainer: {
    paddingHorizontal: Spacing.xxl,
    gap: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.pill,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  tabActive: {
    backgroundColor: Colors.white,
  },
  tabIcon: {
    fontSize: 16,
  },
  tabLabel: {
    ...Typography.labelMedium,
    color: Colors.textMuted,
  },
  tabLabelActive: {
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  loadingText: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    gap: Spacing.lg,
  },
  emptyEmoji: {
    fontSize: 64,
  },
  emptyTitle: {
    ...Typography.displaySmall,
    color: Colors.text,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  generateButton: {
    width: '100%',
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    ...Shadows.md,
    marginTop: Spacing.md,
  },
  buttonDisabled: { opacity: 0.7 },
  generateGradient: {
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  generateButtonText: {
    ...Typography.headlineSmall,
    color: Colors.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  pillarContent: {
    padding: Spacing.xxl,
    gap: Spacing.lg,
  },
  pillarSectionTitle: {
    ...Typography.headlineSmall,
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  routineSection: {
    gap: Spacing.md,
  },
  routineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  routineHeaderEmoji: {
    fontSize: 20,
  },
  routineHeaderTitle: {
    ...Typography.headlineMedium,
    color: Colors.text,
  },
  routineCard: {
    marginBottom: 0,
  },
  routineStepRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  stepNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  stepNumber: {
    ...Typography.labelSmall,
    color: Colors.white,
    fontWeight: '700',
  },
  stepContent: {
    flex: 1,
    gap: Spacing.xs,
  },
  stepName: {
    ...Typography.labelLarge,
    color: Colors.text,
  },
  stepType: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '600',
  },
  stepInstructions: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  ingredientsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  ingredientTag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    backgroundColor: Colors.subtle,
    borderRadius: BorderRadius.pill,
  },
  ingredientTagText: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '500',
  },
  ingredientsSection: {
    gap: Spacing.md,
  },
  ingredientsSectionTitle: {
    ...Typography.headlineSmall,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  ingredientsList: {
    gap: Spacing.xs,
  },
  ingredientListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  ingredientListDot: {
    fontWeight: '700',
    fontSize: 14,
  },
  ingredientListText: {
    ...Typography.bodySmall,
    fontWeight: '500',
  },
  foodItem: {
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  reduceItem: {},
  foodItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  foodName: {
    ...Typography.labelLarge,
    color: Colors.text,
  },
  frequencyBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    backgroundColor: Colors.subtle,
    borderRadius: BorderRadius.pill,
  },
  frequencyText: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '600',
  },
  foodReason: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  swapItem: {
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  swapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
    flexWrap: 'wrap',
  },
  swapFrom: {
    ...Typography.labelMedium,
    color: Colors.error,
    textDecorationLine: 'line-through',
  },
  swapArrow: {
    ...Typography.headlineMedium,
    color: Colors.textMuted,
  },
  swapTo: {
    ...Typography.labelMedium,
    color: Colors.success,
    fontWeight: '700',
  },
  swapWhy: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  supplementItem: {
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  supplementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  supplementName: {
    ...Typography.labelLarge,
    color: Colors.text,
  },
  doseBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    backgroundColor: Colors.warningLight,
    borderRadius: BorderRadius.pill,
  },
  doseText: {
    ...Typography.caption,
    color: Colors.warning,
    fontWeight: '600',
  },
  supplementBenefit: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  remedyItem: {
    marginBottom: Spacing.xl,
    paddingBottom: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: Spacing.sm,
  },
  remedyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  remedyName: {
    ...Typography.headlineSmall,
    color: Colors.text,
  },
  remedyFormBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    backgroundColor: Colors.subtle,
    borderRadius: BorderRadius.pill,
  },
  remedyFormText: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '600',
  },
  remedyDetail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  remedyDetailLabel: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  remedyDetailValue: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    flex: 1,
  },
  evidenceBox: {
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  evidenceLabel: {
    ...Typography.labelSmall,
    color: Colors.success,
    fontWeight: '700',
  },
  evidenceText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    flex: 1,
  },
  cautionBox: {
    backgroundColor: Colors.warningLight,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
  },
  cautionText: {
    ...Typography.bodySmall,
    color: Colors.warning,
  },
  maskItem: {
    marginBottom: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: Spacing.xs,
  },
  maskName: {
    ...Typography.headlineSmall,
    color: Colors.text,
  },
  maskFrequency: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '600',
  },
  maskInstructions: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  maskIngredients: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  maskIngredientChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    backgroundColor: '#E8F7F1',
    borderRadius: BorderRadius.pill,
  },
  maskIngredientText: {
    ...Typography.caption,
    color: Colors.success,
    fontWeight: '500',
  },
  teaItem: {
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: Spacing.xs,
  },
  teaName: {
    ...Typography.labelLarge,
    color: Colors.text,
  },
  teaBenefit: {
    ...Typography.bodySmall,
    color: Colors.success,
    fontWeight: '500',
  },
  teaPrep: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  habitItem: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  habitCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    flexShrink: 0,
    marginTop: 2,
  },
  habitContent: {
    flex: 1,
    gap: Spacing.xs,
  },
  habitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  habitName: {
    ...Typography.labelLarge,
    color: Colors.text,
    flex: 1,
  },
  habitFrequencyBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    backgroundColor: Colors.subtle,
    borderRadius: BorderRadius.pill,
  },
  habitFrequencyText: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '600',
  },
  habitWhy: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  habitHow: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  tipItem: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
    alignItems: 'flex-start',
  },
  tipBullet: {
    fontSize: 16,
    width: 24,
    textAlign: 'center',
  },
  tipText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  avoidItem: {},
  exerciseText: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  askAiButton: {
    position: 'absolute',
    bottom: 90,
    right: Spacing.xxl,
    borderRadius: BorderRadius.pill,
    overflow: 'hidden',
    ...Shadows.xl,
  },
  askAiGradient: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  askAiText: {
    ...Typography.labelLarge,
    color: Colors.white,
  },
});
