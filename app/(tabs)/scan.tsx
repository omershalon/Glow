import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '@/lib/theme';
import type { SkinType, AcneType, Severity } from '@/lib/database.types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Finding {
  title: string;
  description: string;
}

interface AnalysisResult {
  skin_type: SkinType;
  acne_type: AcneType;
  severity: Severity;
  severity_score?: number;
  analysis_notes: string;
  findings?: Finding[];
  confidence: number;
}

const SEVERITY_LABEL: Record<Severity, string> = {
  mild: 'MILD',
  moderate: 'MODERATE',
  severe: 'SEVERE',
};

const SEVERITY_RANGE_LABEL: Record<Severity, string> = {
  mild: 'mild finding range',
  moderate: 'moderate finding range',
  severe: 'severe finding range',
};


const SKIN_TYPE_CHIP_LABELS: Record<SkinType, string> = {
  oily: 'Oily/T-Zone combination',
  dry: 'Dry & dehydrated',
  combination: 'Oily/T-Zone combination',
  sensitive: 'Sensitive & reactive',
  normal: 'Balanced/Normal',
};

export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);

  const capturePhoto = async () => {
    if (!cameraRef.current) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: true,
      });

      if (photo) {
        setPhotoUri(photo.uri);
        setResult(null);
        await analyzePhoto(photo.uri, photo.base64 ?? undefined);
      }
    } catch (err) {
      console.error('Capture error:', err);
      Alert.alert('Capture failed', 'Could not take photo. Please try again.');
    }
  };

  const pickPhoto = async () => {
    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (!pickerResult.canceled && pickerResult.assets[0]) {
      setPhotoUri(pickerResult.assets[0].uri);
      setResult(null);
      await analyzePhoto(pickerResult.assets[0].uri, pickerResult.assets[0].base64 ?? undefined);
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

  const severityScore = result ? (result.severity_score ?? Math.round(result.confidence * 100)) : 0;

  // Use AI-returned findings if available, otherwise build from analysis data
  const findings = (() => {
    if (!result) return [];
    // If the edge function returned findings, use them
    if (result.findings && result.findings.length > 0) return result.findings;

    // Otherwise build findings from analysis_notes + detected type
    const acneLabel = result.acne_type.charAt(0).toUpperCase() + result.acne_type.slice(1);
    const skinLabel = result.skin_type.charAt(0).toUpperCase() + result.skin_type.slice(1);
    const sevLabel = result.severity.charAt(0).toUpperCase() + result.severity.slice(1);

    // Split notes into sentences for descriptions
    const sentences = (result.analysis_notes || '').split(/[.!]\s+/).filter(s => s.trim().length > 8);

    return [
      {
        title: `${acneLabel} acne detected`,
        description: sentences[0]
          ? (sentences[0].trim().endsWith('.') ? sentences[0].trim() : sentences[0].trim() + '.')
          : `Your scan indicates ${acneLabel.toLowerCase()} acne patterns based on the location and type of breakouts observed.`,
      },
      {
        title: `${skinLabel} skin type`,
        description: sentences[1]
          ? (sentences[1].trim().endsWith('.') ? sentences[1].trim() : sentences[1].trim() + '.')
          : `Your skin presents as ${skinLabel.toLowerCase()}, which influences product selection and treatment approach.`,
      },
      {
        title: `${sevLabel} severity level`,
        description: sentences[2]
          ? (sentences[2].trim().endsWith('.') ? sentences[2].trim() : sentences[2].trim() + '.')
          : `The overall severity is classified as ${sevLabel.toLowerCase()}, with a score of ${severityScore} out of 100.`,
      },
    ];
  })();

  // ─── Camera / Live View ───
  if (!photoUri) {
    // Request permission if not yet granted
    if (!permission) {
      return (
        <View style={[styles.darkContainer, { paddingTop: insets.top }]}>
          <ActivityIndicator size="large" color={Colors.white} />
        </View>
      );
    }

    if (!permission.granted) {
      return (
        <View style={[styles.darkContainer, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center', gap: Spacing.lg, paddingHorizontal: Spacing.xxl }]}>
          <Text style={{ fontSize: 48 }}>📸</Text>
          <Text style={{ ...Typography.headlineMedium, color: Colors.white, textAlign: 'center' }}>
            Camera Access Needed
          </Text>
          <Text style={{ ...Typography.bodyMedium, color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>
            We need camera access to scan and analyze your skin
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
            activeOpacity={0.85}
          >
            <Text style={styles.permissionButtonText}>Enable Camera</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={[styles.darkContainer, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.darkHeader}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backArrow}>{'\u2190'}</Text>
          </TouchableOpacity>
          <Text style={styles.darkHeaderTitle}>Skin Scan</Text>
          <View style={styles.backButton} />
        </View>

        {/* Live Camera with overlay */}
        <View style={styles.cameraWrapper}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="front"
          />

          {/* Overlay on top of camera */}
          <View style={styles.cameraOverlay}>
            {/* Corner brackets */}
            <View style={[styles.cornerBracket, styles.cTL]} />
            <View style={[styles.cornerBracket, styles.cTR]} />
            <View style={[styles.cornerBracket, styles.cBL]} />
            <View style={[styles.cornerBracket, styles.cBR]} />

            {/* Face oval guide */}
            <View style={styles.faceOval}>
              <View style={[styles.ovalDot, { top: 0, left: '50%', marginLeft: -3 }]} />
              <View style={[styles.ovalDot, { top: '15%', right: 2 }]} />
              <View style={[styles.ovalDot, { top: '40%', right: -2 }]} />
              <View style={[styles.ovalDot, { bottom: '25%', left: 4 }]} />
              <View style={[styles.ovalDot, { bottom: '10%', right: 10 }]} />
              <View style={[styles.ovalDot, { top: '20%', left: 0 }]} />
            </View>
          </View>
        </View>

        {/* Helper text */}
        <Text style={styles.helperText}>
          Find good lighting {'\u2014'} face a window or bright light
        </Text>

        {/* Status indicators */}
        <View style={styles.statusRow}>
          <View style={styles.statusItem}>
            <View style={styles.statusDotGreen} />
            <Text style={styles.statusText}>Good lighting</Text>
          </View>
          <View style={styles.statusItem}>
            <View style={styles.statusDotGreen} />
            <Text style={styles.statusText}>Hair back</Text>
          </View>
          <View style={styles.statusItem}>
            <View style={styles.statusDotGreen} />
            <Text style={styles.statusText}>Neutral face</Text>
          </View>
        </View>

        {/* Camera controls */}
        <View style={styles.cameraControls}>
          {/* Redo/reset button */}
          <TouchableOpacity style={styles.sideButton} onPress={resetScan} activeOpacity={0.7}>
            <Text style={styles.sideButtonIcon}>{'\u21BB'}</Text>
          </TouchableOpacity>

          {/* Shutter button — captures from live camera */}
          <TouchableOpacity style={styles.shutterOuter} onPress={capturePhoto} activeOpacity={0.85}>
            <View style={styles.shutterInner} />
          </TouchableOpacity>

          {/* Gallery button — opens camera roll */}
          <TouchableOpacity style={styles.galleryButton} onPress={pickPhoto} activeOpacity={0.7}>
            <View style={styles.gallerySquare} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Analysis Results View ───
  return (
    <ScrollView
      style={styles.resultsScrollContainer}
      contentContainerStyle={[styles.resultsContent, { paddingTop: insets.top }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.resultsHeader}>
        <TouchableOpacity onPress={resetScan} style={styles.backButton}>
          <Text style={styles.resultsBackArrow}>{'\u2190'}</Text>
        </TouchableOpacity>
        <Text style={styles.resultsHeaderTitle}>Your skin analysis</Text>
        <View style={styles.backButton} />
      </View>

      {/* Analyzing overlay state */}
      {analyzing && (
        <View style={styles.analyzingCard}>
          <ActivityIndicator size="large" color={Colors.secondary} />
          <Text style={styles.analyzingTitle}>Analyzing your skin...</Text>
          <Text style={styles.analyzingSubtext}>
            Our AI is examining your skin type, acne patterns, and severity
          </Text>
        </View>
      )}

      {result && !analyzing && (
        <>
          {/* Severity badge */}
          <View style={styles.badgeRow}>
            <View style={styles.severityBadge}>
              <Text style={styles.severityBadgeText}>{SEVERITY_LABEL[result.severity]}</Text>
            </View>
          </View>

          {/* Photo preview */}
          <View style={styles.photoCard}>
            <Image source={{ uri: photoUri }} style={styles.resultPhoto} />
            <Text style={styles.photoHint}>Tap to toggle zones</Text>
          </View>

          {/* Type chips */}
          <View style={styles.chipsRow}>
            <View style={styles.typeChip}>
              <Text style={styles.typeChipText}>
                {SKIN_TYPE_CHIP_LABELS[result.skin_type] || result.skin_type}
              </Text>
            </View>
            <View style={styles.typeChip}>
              <Text style={styles.typeChipText}>
                {result.acne_type.charAt(0).toUpperCase() + result.acne_type.slice(1)}
              </Text>
            </View>
          </View>

          {/* Severity score section */}
          <View style={styles.scoreSection}>
            <Text style={styles.scoreNumber}>{severityScore}</Text>
            <Text style={styles.scoreSubtitle}>
              Out of 100 {'\u00B7'} {SEVERITY_RANGE_LABEL[result.severity]}
            </Text>
            <View style={styles.scoreBarTrack}>
              <View style={[styles.scoreBarFill, { width: `${severityScore}%` }]} />
              <View style={[styles.scoreBarIndicator, { left: `${severityScore}%` }]} />
            </View>
          </View>

          {/* Key findings */}
          <View style={styles.findingsSection}>
            <Text style={styles.findingsSectionTitle}>
              {findings.length} KEY FINDINGS FROM YOUR SCAN
            </Text>
            {findings.map((finding, index) => (
              <View key={index} style={styles.findingItem}>
                <View style={styles.findingHeader}>
                  <View style={styles.findingBullet} />
                  <Text style={styles.findingTitle}>{finding.title}</Text>
                </View>
                <Text style={styles.findingDescription}>{finding.description}</Text>
              </View>
            ))}
          </View>

          {/* Motivational text */}
          <Text style={styles.motivationalText}>
            Beauty is medicine. This journey is yours {'\u2014'} and every step forward is a step toward the skin you deserve.
          </Text>

          {/* CTA button */}
          <TouchableOpacity
            style={[styles.ctaButton, (saving || generatingPlan) && styles.ctaDisabled]}
            onPress={saveSkinProfile}
            disabled={saving || generatingPlan}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaButtonText}>
              {saving ? 'Saving...' : generatingPlan ? 'Generating Plan...' : 'View your personalized plan'}
            </Text>
            {!saving && !generatingPlan && (
              <Text style={styles.ctaPillars}>Products {'\u00B7'} Diet {'\u00B7'} Herbal {'\u00B7'} Lifestyle</Text>
            )}
          </TouchableOpacity>

          {/* Re-scan link */}
          <TouchableOpacity style={styles.rescanLink} onPress={resetScan}>
            <Text style={styles.rescanLinkText}>Re-scan</Text>
          </TouchableOpacity>
        </>
      )}

      {/* If photo is set but no result yet and not analyzing */}
      {!result && !analyzing && (
        <View style={styles.analyzingCard}>
          <Image source={{ uri: photoUri }} style={styles.resultPhoto} />
        </View>
      )}
    </ScrollView>
  );
}

function decode(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

const VIEWFINDER_SIZE = SCREEN_WIDTH - 48;

const styles = StyleSheet.create({
  // ── Dark Camera View ──
  darkContainer: {
    flex: 1,
    backgroundColor: '#1C1C1A',
  },
  darkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    fontSize: 24,
    color: Colors.white,
  },
  darkHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.white,
    textAlign: 'center',
  },

  // Live camera
  cameraWrapper: {
    marginHorizontal: Spacing.xxl,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    height: VIEWFINDER_SIZE,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Corner brackets
  cornerBracket: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderColor: Colors.white,
  },
  cTL: {
    top: 16,
    left: 16,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 4,
  },
  cTR: {
    top: 16,
    right: 16,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 4,
  },
  cBL: {
    bottom: 16,
    left: 16,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 4,
  },
  cBR: {
    bottom: 16,
    right: 16,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 4,
  },

  // Face oval
  faceOval: {
    width: 180,
    height: 240,
    borderRadius: 90,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    position: 'relative',
  },
  ovalDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },

  // Helper text
  helperText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.xxl,
  },

  // Status indicators
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xl,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xxl,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDotGreen: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF87',
  },
  statusText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },

  // Camera controls
  cameraControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xxxl,
    paddingVertical: Spacing.xxxl,
    paddingBottom: Spacing.massive,
  },
  sideButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sideButtonIcon: {
    fontSize: 22,
    color: Colors.white,
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: Colors.white,
  },
  galleryButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gallerySquare: {
    width: 26,
    height: 26,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },

  // Permission screen
  permissionButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  permissionButtonText: {
    ...Typography.labelLarge,
    color: Colors.white,
  },

  // ── Results View ──
  resultsScrollContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  resultsContent: {
    paddingBottom: 120,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  resultsBackArrow: {
    fontSize: 24,
    color: Colors.text,
  },
  resultsHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },

  // Analyzing state
  analyzingCard: {
    marginHorizontal: Spacing.xxl,
    marginTop: Spacing.xl,
    padding: Spacing.xxxl,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    gap: Spacing.lg,
    ...Shadows.sm,
  },
  analyzingTitle: {
    ...Typography.headlineMedium,
    color: Colors.text,
    textAlign: 'center',
  },
  analyzingSubtext: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Severity badge
  badgeRow: {
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.xxl,
    marginTop: Spacing.lg,
  },
  severityBadge: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.pill,
  },
  severityBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: 1,
  },

  // Photo card
  photoCard: {
    marginHorizontal: Spacing.xxl,
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    backgroundColor: Colors.white,
    ...Shadows.sm,
  },
  resultPhoto: {
    width: '100%',
    aspectRatio: 1,
  },
  photoHint: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
  },

  // Type chips
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xxl,
    marginTop: Spacing.lg,
  },
  typeChip: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.pill,
  },
  typeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
  },

  // Score section
  scoreSection: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    marginTop: Spacing.xxxl,
  },
  scoreNumber: {
    fontSize: 64,
    fontWeight: '700',
    color: Colors.text,
    lineHeight: 72,
  },
  scoreSubtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  scoreBarTrack: {
    width: '100%',
    height: 6,
    backgroundColor: Colors.borderLight,
    borderRadius: 3,
    marginTop: Spacing.lg,
    position: 'relative',
  },
  scoreBarFill: {
    height: 6,
    backgroundColor: Colors.secondary,
    borderRadius: 3,
  },
  scoreBarIndicator: {
    position: 'absolute',
    top: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.secondary,
    marginLeft: -8,
    borderWidth: 2,
    borderColor: Colors.white,
    ...Shadows.xs,
  },

  // Findings
  findingsSection: {
    paddingHorizontal: Spacing.xxl,
    marginTop: Spacing.xxxl,
    gap: Spacing.xl,
  },
  findingsSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  findingItem: {
    gap: Spacing.sm,
  },
  findingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  findingBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.secondary,
  },
  findingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  findingDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 21,
    paddingLeft: Spacing.xl,
  },

  // Motivational
  motivationalText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.xxxl,
    marginTop: Spacing.xxxl,
  },

  // CTA
  ctaButton: {
    marginHorizontal: Spacing.xxl,
    marginTop: Spacing.xxl,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.xs,
    ...Shadows.md,
  },
  ctaDisabled: {
    opacity: 0.7,
  },
  ctaButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  ctaPillars: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5,
  },

  // Re-scan
  rescanLink: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    marginTop: Spacing.sm,
  },
  rescanLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
