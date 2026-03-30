import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '@/lib/theme';
import type { SkinType, AcneType, Severity } from '@/lib/database.types';

interface AnalysisResult {
  skin_type: SkinType;
  acne_type: AcneType;
  severity: Severity;
  analysis_notes: string;
  confidence: number;
}

const SKIN_TYPE_COLORS: Record<SkinType, string> = {
  oily: '#7CB9E8',
  dry: '#F5A623',
  combination: '#9B59B6',
  sensitive: '#E8547A',
  normal: '#4CAF87',
};

const ACNE_INFO: Record<AcneType, { emoji: string; plain: string; solutions: string[] }> = {
  hormonal: {
    emoji: '🌙',
    plain: 'Your breakouts are driven by hormone shifts — they tend to cluster around your chin and jawline and flare around your cycle. The good news: they respond really well to the right routine.',
    solutions: ['Cut back on dairy and high-sugar foods', 'Add spearmint tea daily', 'Use a gentle salicylic acid cleanser', 'Try zinc supplements', 'Manage stress — cortisol makes this worse'],
  },
  cystic: {
    emoji: '🔴',
    plain: 'Cystic acne forms deep under the skin and can be painful. It\'s one of the more stubborn types, but with a consistent routine targeting inflammation you can see real improvement.',
    solutions: ['Never squeeze — it deepens scarring', 'Use benzoyl peroxide spot treatment', 'Reduce inflammatory foods (fried, processed)', 'Ice inflamed spots to reduce swelling', 'Consider a dermatologist for persistent nodules'],
  },
  comedonal: {
    emoji: '⚫',
    plain: 'You have clogged pores — blackheads and whiteheads forming when oil and dead skin cells get trapped. This type clears up well with the right exfoliation routine.',
    solutions: ['Exfoliate with salicylic acid 2–3x per week', 'Use a non-comedogenic moisturiser', 'Add a retinol to your evening routine', 'Double-cleanse if you wear sunscreen or makeup', 'Use pore strips sparingly for blackheads'],
  },
  fungal: {
    emoji: '🍄',
    plain: 'Fungal acne is caused by yeast, not bacteria — which means most acne products won\'t help. The bumps tend to look uniform and itchy. The fix is antifungal, not antibacterial.',
    solutions: ['Switch to an antifungal cleanser (zinc pyrithione)', 'Avoid heavy oils on your face', 'Change pillowcases every 2 days', 'Let skin breathe — avoid occlusive products', 'Keep skin dry, especially after exercise'],
  },
  inflammatory: {
    emoji: '🔥',
    plain: 'Your acne is in an active inflammatory state — red, raised, and reactive. Calming the inflammation is the first priority before anything else.',
    solutions: ['Use a gentle, fragrance-free cleanser', 'Apply niacinamide serum to reduce redness', 'Cut out spicy foods and alcohol temporarily', 'Use ice wrapped in cloth on inflamed spots', 'Avoid touching your face during flare-ups'],
  },
};

export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required for skin analysis.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.4,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      setResult(null);
      await analyzePhoto(result.assets[0].uri, result.assets[0].base64 ?? undefined);
    }
  };

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.4,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      setResult(null);
      await analyzePhoto(result.assets[0].uri, result.assets[0].base64 ?? undefined);
    }
  };

  const analyzePhoto = async (uri: string, preloadedBase64?: string) => {
    setAnalyzing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const base64 = preloadedBase64 ?? await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64' as any,
      });

      const { data, error } = await supabase.functions.invoke('analyze-skin', {
        body: { image_base64: base64 },
      });

      if (error) throw error;
      const analysisResult: AnalysisResult = data;

      setResult(analysisResult);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('Analysis error:', err);
      Alert.alert(
        'Analysis failed',
        'We could not analyze your photo. Please try again with better lighting.'
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const saveSkinProfile = async () => {
    if (!result || !photoUri) return;

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      // Upload photo to Supabase Storage
      const base64 = await FileSystem.readAsStringAsync(photoUri, {
        encoding: 'base64' as any,
      });
      const fileName = `${user.id}/skin-scan-${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('skin-photos')
        .upload(fileName, decode(base64), {
          contentType: 'image/jpeg',
          upsert: false,
        });

      let photoUrl = null;
      if (!uploadError && uploadData) {
        const { data: { publicUrl } } = supabase.storage
          .from('skin-photos')
          .getPublicUrl(fileName);
        photoUrl = publicUrl;
      }

      // Save skin profile
      const { error: insertError } = await supabase.from('skin_profiles').insert({
        user_id: user.id,
        skin_type: result.skin_type,
        acne_type: result.acne_type,
        severity: result.severity,
        analysis_notes: result.analysis_notes,
        photo_url: photoUrl,
      });

      if (insertError) throw insertError;

      setSaving(false);
      Alert.alert(
        'Profile saved!',
        'Your skin profile has been saved. Would you like to generate your personalized plan now?',
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Generate Plan', onPress: () => generatePlan(user.id) },
        ]
      );
    } catch (err) {
      setSaving(false);
      console.error('Save error:', err);
      Alert.alert('Save failed', 'Could not save your skin profile. Please try again.');
    }
  };

  const generatePlan = async (userId: string) => {
    setGeneratingPlan(true);
    try {
      // Get the latest skin profile
      const { data: skinProfile } = await supabase
        .from('skin_profiles')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (skinProfile) {
        await supabase.functions.invoke('generate-plan', {
          body: { skin_profile_id: skinProfile.id },
        });
      }

      setGeneratingPlan(false);
      router.push('/(tabs)/plan');
    } catch (err) {
      setGeneratingPlan(false);
      console.error('Plan generation error:', err);
    }
  };

  const resetScan = () => {
    setPhotoUri(null);
    setResult(null);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.lg }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Skin Analysis</Text>
        <Text style={styles.headerSubtitle}>
          AI-powered skin type and acne analysis
        </Text>
      </View>

      {/* Camera area */}
      {!photoUri ? (
        <View style={styles.cameraArea}>
          {/* Face guide circle */}
          <LinearGradient
            colors={['#FFF0F5', '#FFE0ED']}
            style={styles.cameraPlaceholder}
          >
            <View style={styles.faceGuideOuter}>
              <View style={styles.faceGuideInner}>
                <Text style={styles.faceGuideEmoji}>👤</Text>
              </View>
              {/* Corner markers */}
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
            <Text style={styles.guideText}>Position your face here</Text>
          </LinearGradient>

          {/* Instructions */}
          <View style={styles.instructionsCard}>
            <Text style={styles.instructionsTitle}>Tips for best results</Text>
            <View style={styles.instructionsList}>
              {[
                { icon: '☀️', text: 'Use natural lighting or face a bright window' },
                { icon: '😐', text: 'Keep a neutral expression, no makeup' },
                { icon: '💇', text: 'Pull hair back to expose your full face' },
                { icon: '📐', text: 'Hold phone at arm\'s length, face centered' },
              ].map((tip) => (
                <View key={tip.text} style={styles.instructionItem}>
                  <Text style={styles.instructionIcon}>{tip.icon}</Text>
                  <Text style={styles.instructionText}>{tip.text}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Action buttons */}
          <TouchableOpacity
            style={styles.takeSelfieButton}
            onPress={takePhoto}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[Colors.primary, Colors.primaryDark]}
              style={styles.takeSelfieGradient}
            >
              <Text style={styles.takeSelfieIcon}>📸</Text>
              <Text style={styles.takeSelfieText}>Take Selfie</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.uploadButton}
            onPress={pickPhoto}
            activeOpacity={0.8}
          >
            <Text style={styles.uploadText}>Upload from Gallery</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.analysisArea}>
          {/* Photo preview */}
          <View style={styles.photoPreviewContainer}>
            <Image source={{ uri: photoUri }} style={styles.photoPreview} />
            {analyzing && (
              <View style={styles.analyzeOverlay}>
                <LinearGradient
                  colors={['rgba(232,84,122,0.9)', 'rgba(196,58,96,0.95)']}
                  style={styles.analyzeOverlayGradient}
                >
                  <ActivityIndicator size="large" color={Colors.white} />
                  <Text style={styles.analyzingTitle}>Analyzing your skin...</Text>
                  <Text style={styles.analyzingSubtext}>
                    Claude AI is examining your skin type, acne patterns, and severity
                  </Text>
                </LinearGradient>
              </View>
            )}
          </View>

          {/* Results */}
          {result && !analyzing && (
            <View style={styles.resultsContainer}>
              <Text style={styles.resultsTitle}>Analysis Complete</Text>

              {/* Skin profile chips */}
              <View style={styles.chipsRow}>
                <View style={[styles.resultChip, { backgroundColor: SKIN_TYPE_COLORS[result.skin_type] + '20', borderColor: SKIN_TYPE_COLORS[result.skin_type] }]}>
                  <Text style={styles.chipLabel}>Skin Type</Text>
                  <Text style={[styles.chipValue, { color: SKIN_TYPE_COLORS[result.skin_type] }]}>
                    {result.skin_type.charAt(0).toUpperCase() + result.skin_type.slice(1)}
                  </Text>
                </View>
                <View style={[styles.resultChip, { backgroundColor: Colors.primary + '15', borderColor: Colors.primary }]}>
                  <Text style={styles.chipLabel}>Acne Type</Text>
                  <Text style={[styles.chipValue, { color: Colors.primary }]}>
                    {result.acne_type.charAt(0).toUpperCase() + result.acne_type.slice(1)}
                  </Text>
                </View>
                <View style={[
                  styles.resultChip,
                  {
                    backgroundColor: (result.severity === 'mild' ? Colors.severityMild : result.severity === 'moderate' ? Colors.severityModerate : Colors.severitySevere) + '20',
                    borderColor: result.severity === 'mild' ? Colors.severityMild : result.severity === 'moderate' ? Colors.severityModerate : Colors.severitySevere,
                  }
                ]}>
                  <Text style={styles.chipLabel}>Severity</Text>
                  <Text style={[
                    styles.chipValue,
                    { color: result.severity === 'mild' ? Colors.severityMild : result.severity === 'moderate' ? Colors.severityModerate : Colors.severitySevere }
                  ]}>
                    {result.severity.charAt(0).toUpperCase() + result.severity.slice(1)}
                  </Text>
                </View>
              </View>

              {/* Acne explanation card */}
              <View style={styles.explanationCard}>
                <Text style={styles.explanationEmoji}>
                  {ACNE_INFO[result.acne_type].emoji}
                </Text>
                <View style={styles.explanationBody}>
                  <Text style={styles.explanationTitle}>
                    {result.acne_type.charAt(0).toUpperCase() + result.acne_type.slice(1)} Acne
                  </Text>
                  <Text style={styles.explanationText}>
                    {ACNE_INFO[result.acne_type].plain}
                  </Text>
                </View>
              </View>

              {/* Quick solutions */}
              <View style={styles.solutionsCard}>
                <Text style={styles.solutionsTitle}>Quick wins to start today</Text>
                {ACNE_INFO[result.acne_type].solutions.map((s, i) => (
                  <View key={i} style={styles.solutionRow}>
                    <Text style={styles.solutionBullet}>·</Text>
                    <Text style={styles.solutionText}>{s}</Text>
                  </View>
                ))}
              </View>

              {/* Action buttons */}
              <TouchableOpacity
                style={[styles.generatePlanButton, (saving || generatingPlan) && styles.buttonDisabled]}
                onPress={saveSkinProfile}
                disabled={saving || generatingPlan}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[Colors.secondary, Colors.primary]}
                  style={styles.generatePlanGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.generatePlanText}>
                    {saving ? 'Saving...' : generatingPlan ? 'Generating Plan...' : 'Generate My Plan ✨'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={styles.rescanButton} onPress={resetScan}>
                <Text style={styles.rescanText}>Re-scan</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

// Utility to decode base64 for upload
function decode(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: 120,
  },
  header: {
    paddingHorizontal: Spacing.xxl,
    marginBottom: Spacing.xl,
  },
  headerTitle: {
    ...Typography.displaySmall,
    color: Colors.text,
  },
  headerSubtitle: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  cameraArea: {
    paddingHorizontal: Spacing.xxl,
    gap: Spacing.xl,
  },
  cameraPlaceholder: {
    borderRadius: BorderRadius.xl,
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.lg,
    borderWidth: 2,
    borderColor: Colors.subtleDeep,
    borderStyle: 'dashed',
  },
  faceGuideOuter: {
    width: 180,
    height: 220,
    borderRadius: 90,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  faceGuideInner: {
    width: 160,
    height: 200,
    borderRadius: 80,
    backgroundColor: 'rgba(232,84,122,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceGuideEmoji: {
    fontSize: 80,
    opacity: 0.4,
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: Colors.primary,
  },
  cornerTL: {
    top: -1,
    left: -1,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    top: -1,
    right: -1,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 4,
  },
  cornerBL: {
    bottom: -1,
    left: -1,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    bottom: -1,
    right: -1,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 4,
  },
  guideText: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  instructionsCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    ...Shadows.sm,
  },
  instructionsTitle: {
    ...Typography.headlineSmall,
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  instructionsList: {
    gap: Spacing.md,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  instructionIcon: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  instructionText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  takeSelfieButton: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  takeSelfieGradient: {
    height: 60,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  takeSelfieIcon: {
    fontSize: 24,
  },
  takeSelfieText: {
    ...Typography.headlineSmall,
    color: Colors.white,
  },
  uploadButton: {
    height: 50,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadText: {
    ...Typography.labelLarge,
    color: Colors.primary,
  },
  analysisArea: {
    paddingHorizontal: Spacing.xxl,
    gap: Spacing.xl,
  },
  photoPreviewContainer: {
    position: 'relative',
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  photoPreview: {
    width: '100%',
    aspectRatio: 1,
  },
  analyzeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyzeOverlayGradient: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.lg,
    padding: Spacing.xxl,
  },
  analyzingTitle: {
    ...Typography.headlineMedium,
    color: Colors.white,
    textAlign: 'center',
  },
  analyzingSubtext: {
    ...Typography.bodySmall,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 20,
  },
  resultsContainer: {
    gap: Spacing.lg,
  },
  resultsTitle: {
    ...Typography.headlineLarge,
    color: Colors.text,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  resultChip: {
    flex: 1,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  chipLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  chipValue: {
    ...Typography.labelMedium,
    fontWeight: '700',
  },
  explanationCard: {
    flexDirection: 'row',
    backgroundColor: Colors.subtle,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    alignItems: 'flex-start',
  },
  explanationEmoji: {
    fontSize: 36,
    lineHeight: 44,
  },
  explanationBody: {
    flex: 1,
    gap: 6,
  },
  explanationTitle: {
    ...Typography.labelLarge,
    color: Colors.primaryDark,
  },
  explanationText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  solutionsCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  solutionsTitle: {
    ...Typography.labelLarge,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  solutionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'flex-start',
  },
  solutionBullet: {
    fontSize: 18,
    color: Colors.primary,
    lineHeight: 22,
    fontWeight: '700',
  },
  solutionText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 22,
  },
  generatePlanButton: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  generatePlanGradient: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  generatePlanText: {
    ...Typography.headlineSmall,
    color: Colors.white,
  },
  rescanButton: {
    height: 48,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rescanText: {
    ...Typography.labelLarge,
    color: Colors.textSecondary,
  },
});
