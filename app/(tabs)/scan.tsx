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
  Linking,
  FlatList,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Svg, { Path, Circle, Rect, Line, Polyline } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '@/lib/theme';
import type { SkinType, AcneType, Severity } from '@/lib/database.types';
import { PRODUCTS } from '@/lib/products';
import { cleanProductName } from '@/lib/clean-product-name';


const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Finding {
  title: string;
  description: string;
}

interface ZoneData {
  severity: 'clear' | 'mild' | 'moderate' | 'severe';
  note: string;
}

interface AnalysisResult {
  skin_type: SkinType;
  acne_type: AcneType;
  severity: Severity;
  severity_score?: number;
  analysis_notes: string;
  findings?: Finding[];
  zones?: Record<string, ZoneData>;
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

// Zone positions on a centered selfie (percentage of photo dimensions)
const ZONE_POSITIONS: Record<string, { label: string; top: number; left: number }> = {
  forehead:    { label: 'Forehead', top: 0.22, left: 0.50 },
  left_cheek:  { label: 'L Cheek',  top: 0.50, left: 0.24 },
  right_cheek: { label: 'R Cheek',  top: 0.50, left: 0.76 },
  nose:        { label: 'Nose',     top: 0.45, left: 0.50 },
  chin:        { label: 'Chin',     top: 0.73, left: 0.50 },
  jawline:     { label: 'Jawline',  top: 0.65, left: 0.30 },
};

const ZONE_SEVERITY_COLORS: Record<string, string> = {
  clear: '#4CAF87',
  mild: '#C8A050',
  moderate: '#C8573E',
  severe: '#C84040',
};

// ─── SVG Icon Components ───

function CameraIcon({ size = 48, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2v11z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={13} r={4} stroke={color} strokeWidth={1.5} />
    </Svg>
  );
}

function BackArrowIcon({ size = 24, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 12H5M5 12l7-7M5 12l7 7"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function RedoIcon({ size = 22, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M1 4v6h6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [showZones, setShowZones] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [loggingProgress, setLoggingProgress] = useState(false);

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

  const [profileSaved, setProfileSaved] = useState(false);

  const saveSkinProfile = async () => {
    if (!result || !photoUri) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Only save the skin profile once per scan — don't duplicate on re-taps
    if (!profileSaved) {
      setSaving(true);
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
        setProfileSaved(true);
        setSaving(false);
      } catch (err) {
        setSaving(false);
        console.error('Save error:', err);
        Alert.alert('Save failed', 'Could not save your skin profile. Please try again.');
        return;
      }
    }

    // Always generate a fresh plan (even on re-taps)
    await generatePlan(user.id);
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
      router.push('/(tabs)/plan?tab=picks');
    } catch (err) {
      setGeneratingPlan(false);
      console.error('Plan generation error:', err);
    }
  };

  const logToProgress = async () => {
    if (!photoUri || loggingProgress) return;
    setLoggingProgress(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      const base64 = await FileSystem.readAsStringAsync(photoUri, { encoding: 'base64' as any });

      // Upload photo
      let imageUrl = photoUri;
      try {
        const fileName = `${user.id}/progress-${Date.now()}.jpg`;
        const { data: uploadData } = await supabase.storage
          .from('progress-photos')
          .upload(fileName, decode(base64), { contentType: 'image/jpeg' });
        if (uploadData) {
          const { data: { publicUrl } } = supabase.storage.from('progress-photos').getPublicUrl(fileName);
          imageUrl = publicUrl;
        }
      } catch {}

      // Get severity score from result
      const score = result?.severity_score ?? (result?.severity === 'mild' ? 3 : result?.severity === 'moderate' ? 6 : 8);

      await supabase.from('progress_photos').insert({
        user_id: user.id,
        image_url: imageUrl,
        week_number: 1,
        severity_score: Math.round(score),
        analysis_notes: result?.analysis_notes ?? '',
        notes: '',
      } as any);

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Saved!', 'Photo logged to your progress timeline.', [
        { text: 'View Progress', onPress: () => router.push('/(tabs)/progress') },
        { text: 'OK' },
      ]);
    } catch (err) {
      console.error('Log progress error:', err);
      Alert.alert('Error', 'Could not save to progress. Please try again.');
    } finally {
      setLoggingProgress(false);
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
          <CameraIcon size={48} color={Colors.white} />
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
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {/* Fullscreen camera */}
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFillObject}
          facing="front"
        />

        {/* Overlay on top of fullscreen camera */}
        <View style={[StyleSheet.absoluteFillObject, { justifyContent: 'center', alignItems: 'center' }]}>
          {/* Corner brackets */}
          <View style={[styles.cornerBracket, styles.cTL]} />
          <View style={[styles.cornerBracket, styles.cTR]} />
          <View style={[styles.cornerBracket, styles.cBL]} />
          <View style={[styles.cornerBracket, styles.cBR]} />
        </View>

        {/* Header — on top of camera */}
        <View style={[styles.darkHeader, { position: 'absolute', top: insets.top, left: 0, right: 0, zIndex: 10 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <BackArrowIcon size={24} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.darkHeaderTitle}>Skin Scan</Text>
          <View style={styles.backButton} />
        </View>

        {/* Bottom controls — on top of camera */}
        <View style={{ position: 'absolute', bottom: -40, left: 0, right: 0, paddingBottom: insets.bottom + 10, zIndex: 10 }}>
          {/* Camera controls */}
          <View style={styles.cameraControls}>
            <TouchableOpacity style={styles.sideButton} onPress={resetScan} activeOpacity={0.7}>
              <RedoIcon size={22} color={Colors.white} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.shutterOuter} onPress={capturePhoto} activeOpacity={0.85}>
              <View style={styles.shutterInner} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.galleryButton} onPress={pickPhoto} activeOpacity={0.7}>
              <View style={styles.gallerySquare} />
            </TouchableOpacity>
          </View>
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
          <BackArrowIcon size={24} color={Colors.text} />
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
          {/* Severity at top */}
          <View style={styles.badgeRow}>
            <View style={styles.severityBadge}>
              <Text style={styles.severityBadgeText}>{SEVERITY_LABEL[result.severity]}</Text>
            </View>
          </View>

          {/* ═══ Photo Card ═══ */}
          <View style={styles.photoCardWrapper}>
            <Image source={{ uri: photoUri }} style={styles.scanPhoto} />
          </View>

          {/* ═══ Chips row ═══ */}
          <View style={styles.chipsRow}>
            <View style={styles.typeChip}>
              <Text style={styles.typeChipText}>
                {SKIN_TYPE_CHIP_LABELS[result.skin_type] || result.skin_type}
              </Text>
            </View>
            <View style={styles.typeChip}>
              <Text style={styles.typeChipText}>
                {result.acne_type.charAt(0).toUpperCase() + result.acne_type.slice(1)} Acne
              </Text>
            </View>
            <View style={styles.issuesBadge}>
              <Text style={styles.issuesBadgeText}>{findings.length} issues found</Text>
            </View>
          </View>

          <Text style={styles.profileSummary}>
            Identified {findings.length} key skin issues needing care.
          </Text>

          {/* ═══ Issue Cards ═══ */}
          <View style={styles.findingsSection}>
            <Text style={styles.findingsSectionTitle}>
              {findings.length} KEY FINDINGS
            </Text>
            {findings.map((finding, index) => (
              <View key={index} style={styles.issueCardFull}>
                <View style={styles.issueCardHeader}>
                  <Text style={styles.issueCardTitle}>{finding.title}</Text>
                  <View style={styles.fixableBadge}>
                    <Text style={styles.fixableText}>Fixable</Text>
                  </View>
                </View>
                <Text style={styles.issueCardDesc}>{finding.description}</Text>
              </View>
            ))}
          </View>

          {/* ═══ Recommended Products ═══ */}
          <View style={styles.recsSection}>
            <Text style={styles.recsTitle}>Recommended Products</Text>
            <FlatList
              data={PRODUCTS.filter(p => p.category === 'Skincare').slice(0, 8)}
              keyExtractor={item => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recsScroll}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.recCard}
                  activeOpacity={0.88}
                  onPress={() => {
                    const url = item.asin
                      ? `https://www.amazon.com/dp/${item.asin}`
                      : `https://www.amazon.com/s?k=${encodeURIComponent(item.brand + ' ' + item.name)}`;
                    Linking.openURL(url);
                  }}
                >
                  {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={styles.recImage} resizeMode="contain" />
                  ) : (
                    <View style={[styles.recImage, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F0E8' }]}>
                      <Text style={{ fontSize: 24 }}>{'\u2728'}</Text>
                    </View>
                  )}
                  <Text style={styles.recCategory}>{item.category}</Text>
                  <Text style={styles.recName} numberOfLines={2}>{cleanProductName(item.name, item.brand)}</Text>
                  {item.price ? <Text style={styles.recPrice}>{item.price}</Text> : null}
                </TouchableOpacity>
              )}
            />
          </View>

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

          {/* Bottom actions */}
          <View style={styles.bottomActions}>
            <TouchableOpacity style={styles.bottomActionBtn} onPress={resetScan}>
              <Text style={styles.bottomActionText}>Re-scan</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bottomActionBtn, styles.bottomActionPrimary, loggingProgress && { opacity: 0.6 }]}
              onPress={logToProgress}
              disabled={loggingProgress}
            >
              <Text style={[styles.bottomActionText, styles.bottomActionPrimaryText]}>
                {loggingProgress ? 'Saving...' : 'Log to Progress'}
              </Text>
            </TouchableOpacity>
          </View>
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

const VIEWFINDER_WIDTH = SCREEN_WIDTH - 48;
const VIEWFINDER_HEIGHT = VIEWFINDER_WIDTH * 1.35;

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
  // backArrow style removed — now using BackArrowIcon SVG
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
    height: VIEWFINDER_HEIGHT,
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
    top: 140,
    left: 40,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 4,
  },
  cTR: {
    top: 140,
    right: 40,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 4,
  },
  cBL: {
    bottom: 190,
    left: 40,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 4,
  },
  cBR: {
    bottom: 190,
    right: 40,
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
  // sideButtonIcon style removed — now using RedoIcon SVG
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#2D4A3E',
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
  // resultsBackArrow style removed — now using BackArrowIcon SVG
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
  photoCardWrapper: {
    marginHorizontal: Spacing.xxl,
    marginTop: Spacing.lg,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: Colors.white,
    ...Shadows.sm,
  },
  scanPhoto: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 20,
  },
  issuesBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF0EE',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  issuesBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#C8573E',
  },
  profileSummary: {
    fontSize: 13,
    color: '#8A8A7A',
    lineHeight: 18,
    marginHorizontal: Spacing.xxl,
    marginTop: 8,
  },

  // Score row — arc + issue cards
  scoreRow: {
    flexDirection: 'row',
    marginHorizontal: Spacing.xxl,
    marginTop: 16,
    gap: 12,
    alignItems: 'center',
  },
  scoreCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
    position: 'relative',
  },
  scoreArcBg: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 8,
    borderColor: '#E8E2D8',
  },
  scoreArcFill: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 8,
    borderColor: '#2D4A3E',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  scoreValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1C1A',
  },
  scoreLabel: {
    fontSize: 11,
    color: '#8A8A7A',
    marginTop: -2,
  },
  issueCardsRow: {
    flexDirection: 'row',
    marginHorizontal: Spacing.xxl,
    marginTop: 16,
    gap: 10,
  },
  issueCards: {
    flex: 1,
    gap: 10,
  },
  issueCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    ...Shadows.xs,
  },
  issueCardFull: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    ...Shadows.xs,
  },
  issueCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  issueCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1A',
    flex: 1,
  },
  fixableBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 8,
  },
  fixableText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D4A3E',
  },
  issueCardDesc: {
    fontSize: 13,
    color: '#8A8A7A',
    lineHeight: 19,
  },
  issueCardStatus: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2D4A3E',
  },

  // Recommended products
  recsSection: {
    marginTop: 20,
    marginBottom: 8,
  },
  recsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1A',
    marginBottom: 14,
    marginHorizontal: Spacing.xxl,
  },
  recsScroll: {
    paddingHorizontal: Spacing.xxl,
    gap: 12,
  },
  recCard: {
    width: 140,
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 10,
    ...Shadows.xs,
  },
  recImage: {
    width: 120,
    height: 100,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  recCategory: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9B9488',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  recName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1C1C1A',
    lineHeight: 16,
    marginBottom: 4,
  },
  recPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D4A3E',
  },

  // Legacy — keep for compatibility
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
  zoneOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  zoneMarker: {
    position: 'absolute',
    alignItems: 'center',
    transform: [{ translateX: -30 }, { translateY: -10 }],
  },
  zoneMarkerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.secondary,
    borderWidth: 2,
    borderColor: Colors.white,
    marginBottom: 4,
  },
  zoneMarkerLabel: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  zoneMarkerText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.white,
  },
  zoneMarkerSeverity: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
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
    gap: 8,
    marginHorizontal: Spacing.xxl,
    marginTop: 14,
  },
  typeChip: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
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

  // Bottom actions
  bottomActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginHorizontal: Spacing.xxl,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  bottomActionBtn: {
    flex: 1,
    paddingVertical: Spacing.md + 2,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  bottomActionPrimary: {},
  bottomActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  bottomActionPrimaryText: {},
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
