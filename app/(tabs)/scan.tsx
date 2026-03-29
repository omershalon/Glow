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

const ACNE_TYPE_DESCRIPTIONS: Record<AcneType, string> = {
  hormonal: 'Often appears on chin and jaw, linked to hormone fluctuations',
  cystic: 'Deep, painful nodules that develop under the skin',
  comedonal: 'Blackheads and whiteheads caused by clogged pores',
  fungal: 'Caused by yeast overgrowth, often uniform in appearance',
  inflammatory: 'Red, swollen pustules and papules',
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

      // Detect image format
      let mediaType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg';
      if (base64.startsWith('iVBORw0KGgo')) mediaType = 'image/png';
      else if (base64.startsWith('UklGR')) mediaType = 'image/webp';

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-opus-4-6',
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: base64 },
              },
              {
                type: 'text',
                text: `You are an expert dermatologist AI. Analyze this face photo and return ONLY valid JSON with this exact structure, no markdown:
{"skin_type":"oily"|"dry"|"combination"|"sensitive"|"normal","acne_type":"hormonal"|"cystic"|"comedonal"|"fungal"|"inflammatory","severity":"mild"|"moderate"|"severe","analysis_notes":"2-3 sentence description of findings","confidence":0.0-1.0}`,
              },
            ],
          }],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Claude API error:', errText);
        throw new Error(errText);
      }

      const claudeData = await response.json();
      const text = claudeData.content.find((b: any) => b.type === 'text')?.text ?? '';
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const analysisResult: AnalysisResult = JSON.parse(cleaned);

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

              {/* Confidence */}
              <View style={styles.confidenceRow}>
                <Text style={styles.confidenceLabel}>AI Confidence: </Text>
                <Text style={styles.confidenceValue}>{(result.confidence * 100).toFixed(0)}%</Text>
              </View>

              {/* Acne type description */}
              <View style={styles.acneDescription}>
                <Text style={styles.acneDescriptionTitle}>
                  About {result.acne_type.charAt(0).toUpperCase() + result.acne_type.slice(1)} Acne
                </Text>
                <Text style={styles.acneDescriptionText}>
                  {ACNE_TYPE_DESCRIPTIONS[result.acne_type]}
                </Text>
              </View>

              {/* Analysis notes */}
              <View style={styles.notesCard}>
                <Text style={styles.notesTitle}>AI Analysis Notes</Text>
                <Text style={styles.notesText}>{result.analysis_notes}</Text>
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
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  confidenceLabel: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  confidenceValue: {
    ...Typography.bodySmall,
    color: Colors.success,
    fontWeight: '700',
  },
  acneDescription: {
    backgroundColor: Colors.subtle,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
  },
  acneDescriptionTitle: {
    ...Typography.labelLarge,
    color: Colors.primaryDark,
    marginBottom: Spacing.xs,
  },
  acneDescriptionText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  notesCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  notesTitle: {
    ...Typography.labelLarge,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  notesText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
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
