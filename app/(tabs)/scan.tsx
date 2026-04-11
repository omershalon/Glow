import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Animated,
  Alert,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, Typography, BorderRadius, Spacing } from '@/lib/theme';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import type { ViewAngle, CapturedImage } from '@/lib/scan-types';
import { runDetectionOnAll, countDetections } from '@/lib/yolo';
import { runScanPipeline } from '@/lib/scan-api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const STEPS: { angle: ViewAngle; label: string; instruction: string }[] = [
  { angle: 'front', label: 'Front', instruction: 'Look straight at the camera' },
  { angle: 'left', label: 'Left Side', instruction: 'Turn your head to the right' },
  { angle: 'right', label: 'Right Side', instruction: 'Turn your head to the left' },
];

// ─── SVG Icons ───

function CameraIcon({ size = 48, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2v11z"
        stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
      />
      <Circle cx={12} cy={13} r={4} stroke={color} strokeWidth={1.5} />
    </Svg>
  );
}

function CheckIcon({ size = 20, color = '#34D399' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 6L9 17l-5-5" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ArrowIcon({ direction, size = 24, color = '#FFFFFF' }: { direction: 'left' | 'right'; size?: number; color?: string }) {
  const d = direction === 'left'
    ? 'M19 12H5M5 12l7-7M5 12l7 7'
    : 'M5 12h14M19 12l-7-7M19 12l-7 7';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={d} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  // Capture state
  const [currentStep, setCurrentStep] = useState(0);
  const [captures, setCaptures] = useState<(CapturedImage | null)[]>([null, null, null]);
  const [previewing, setPreviewing] = useState(false);

  // Processing state
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');

  // Shutter animation
  const shutterScale = useRef(new Animated.Value(1)).current;
  const shutterFill = useRef(new Animated.Value(0)).current;

  const onShutterPressIn = useCallback(() => {
    Animated.parallel([
      Animated.spring(shutterScale, { toValue: 0.82, useNativeDriver: true, speed: 50, bounciness: 4 }),
      Animated.timing(shutterFill, { toValue: 1, duration: 200, useNativeDriver: false }),
    ]).start();
  }, []);

  const onShutterPressOut = useCallback(() => {
    Animated.parallel([
      Animated.spring(shutterScale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 10 }),
      Animated.timing(shutterFill, { toValue: 0, duration: 300, useNativeDriver: false }),
    ]).start();
  }, []);

  const shutterBg = shutterFill.interpolate({ inputRange: [0, 1], outputRange: ['#FFFFFF', '#7C5CFC'] });

  const capturePhoto = async () => {
    if (!cameraRef.current || processing) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        base64: true,
      });

      if (photo && photo.base64) {
        const captured: CapturedImage = {
          uri: photo.uri,
          base64: photo.base64,
          width: photo.width,
          height: photo.height,
        };

        const newCaptures = [...captures];
        newCaptures[currentStep] = captured;
        setCaptures(newCaptures);
        setPreviewing(true);
      }
    } catch (err) {
      console.error('Capture error:', err);
      Alert.alert('Capture failed', 'Could not take photo. Please try again.');
    }
  };

  const retakePhoto = () => {
    const newCaptures = [...captures];
    newCaptures[currentStep] = null;
    setCaptures(newCaptures);
    setPreviewing(false);
  };

  const confirmPhoto = () => {
    setPreviewing(false);
    if (currentStep < 2) {
      setCurrentStep(currentStep + 1);
    }
  };

  const allCaptured = captures.every((c) => c !== null);

  const startAnalysis = async () => {
    if (!allCaptured || processing) return;

    setProcessing(true);
    setProcessingStep('Running skin detection...');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      const images = {
        front: captures[0]!,
        left: captures[1]!,
        right: captures[2]!,
      };

      // Step 1: Run YOLO on-device
      setProcessingStep('Detecting acne spots...');
      const detections = await runDetectionOnAll(images);
      const totalDetected = countDetections(detections);
      console.log(`[Scan] YOLO detected ${totalDetected} spots across 3 images`);

      // Step 2: Run full pipeline (upload + Gemini review)
      const { sessionId, response } = await runScanPipeline(
        user.id,
        images,
        detections,
        setProcessingStep
      );

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Navigate to results
      router.push({
        pathname: '/scan-results',
        params: { sessionId },
      });
    } catch (err: any) {
      console.error('Analysis error:', err);
      const message = err?.message || String(err);
      Alert.alert(
        'Analysis Failed',
        message.length > 300 ? message.substring(0, 300) + '…' : message
      );
    } finally {
      setProcessing(false);
      setProcessingStep('');
    }
  };

  const resetScan = () => {
    setCaptures([null, null, null]);
    setCurrentStep(0);
    setPreviewing(false);
    setProcessing(false);
  };

  // ─── Permission screens ───
  if (!permission) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.white} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center', gap: Spacing.lg, paddingHorizontal: Spacing.xxl }]}>
        <CameraIcon size={48} color={Colors.white} />
        <Text style={{ ...Typography.headlineMedium, color: Colors.white, textAlign: 'center' }}>
          Camera Access Needed
        </Text>
        <Text style={{ ...Typography.bodyMedium, color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>
          We need camera access to scan and analyze your skin
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission} activeOpacity={0.85}>
          <Text style={styles.permissionButtonText}>Enable Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Preview of captured photo ───
  if (previewing && captures[currentStep]) {
    return (
      <View style={[styles.container]}>
        <Image source={{ uri: captures[currentStep]!.uri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        <View style={[styles.previewOverlay, { paddingTop: insets.top + 10 }]}>
          <Text style={styles.previewLabel}>{STEPS[currentStep].label}</Text>

          <View style={styles.previewActions}>
            <TouchableOpacity style={styles.previewBtn} onPress={retakePhoto} activeOpacity={0.8}>
              <Text style={styles.previewBtnText}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.previewBtn, styles.previewBtnPrimary]} onPress={confirmPhoto} activeOpacity={0.8}>
              <Text style={[styles.previewBtnText, { color: '#FFFFFF' }]}>
                {currentStep < 2 ? 'Next' : 'Done'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ─── All 3 captured — review & analyze ───
  if (allCaptured && !previewing) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LoadingOverlay
          visible={processing}
          title="Analyzing your skin..."
          subtitle={processingStep || 'This may take a moment'}
          steps={['Detecting acne spots', 'Uploading images', 'AI reviewing scan', 'Generating results']}
        />

        <Text style={styles.reviewTitle}>Review Your Photos</Text>
        <Text style={styles.reviewSubtitle}>Tap any photo to retake it</Text>

        <View style={styles.reviewGrid}>
          {STEPS.map((step, i) => (
            <TouchableOpacity
              key={step.angle}
              style={styles.reviewCard}
              onPress={() => {
                setCurrentStep(i);
                retakePhoto();
              }}
              activeOpacity={0.8}
            >
              <Image source={{ uri: captures[i]!.uri }} style={styles.reviewImage} resizeMode="cover" />
              <View style={styles.reviewCardLabel}>
                <CheckIcon size={16} />
                <Text style={styles.reviewCardText}>{step.label}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.analyzeButton, processing && { opacity: 0.6 }]}
          onPress={startAnalysis}
          disabled={processing}
          activeOpacity={0.85}
        >
          <Text style={styles.analyzeButtonText}>
            {processing ? 'Analyzing...' : 'Analyze My Skin'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.resetButton} onPress={resetScan} disabled={processing}>
          <Text style={styles.resetButtonText}>Start Over</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Camera capture view ───
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} facing="front" />

      {/* Step indicators */}
      <View style={[styles.stepBar, { top: insets.top + 10 }]}>
        {STEPS.map((step, i) => (
          <View key={step.angle} style={[styles.stepPill, i === currentStep && styles.stepPillActive, captures[i] && styles.stepPillDone]}>
            {captures[i] ? (
              <CheckIcon size={14} color="#FFFFFF" />
            ) : (
              <Text style={[styles.stepPillText, i === currentStep && styles.stepPillTextActive]}>{step.label}</Text>
            )}
          </View>
        ))}
      </View>

      {/* Center instruction */}
      <View style={styles.instructionOverlay}>
        {currentStep === 1 && <ArrowIcon direction="right" size={40} color="rgba(255,255,255,0.5)" />}
        <View style={styles.instructionBadge}>
          <Text style={styles.instructionText}>{STEPS[currentStep].instruction}</Text>
        </View>
        {currentStep === 2 && <ArrowIcon direction="left" size={40} color="rgba(255,255,255,0.5)" />}
      </View>

      {/* Corner brackets */}
      <View style={[StyleSheet.absoluteFillObject, { justifyContent: 'center', alignItems: 'center' }]}>
        <View style={[styles.cornerBracket, styles.cTL]} />
        <View style={[styles.cornerBracket, styles.cTR]} />
        <View style={[styles.cornerBracket, styles.cBL]} />
        <View style={[styles.cornerBracket, styles.cBR]} />
      </View>

      {/* Shutter button */}
      <View style={[styles.shutterArea, { paddingBottom: insets.bottom + 30 }]}>
        {/* Thumbnail strip of captured photos */}
        <View style={styles.thumbnailStrip}>
          {STEPS.map((step, i) => (
            <View key={step.angle} style={[styles.thumbnail, i === currentStep && styles.thumbnailActive]}>
              {captures[i] ? (
                <Image source={{ uri: captures[i]!.uri }} style={styles.thumbnailImage} />
              ) : (
                <Text style={styles.thumbnailPlaceholder}>{i + 1}</Text>
              )}
            </View>
          ))}
        </View>

        <Pressable onPress={capturePhoto} onPressIn={onShutterPressIn} onPressOut={onShutterPressOut}>
          <Animated.View style={[styles.shutterOuter, { transform: [{ scale: shutterScale }] }]}>
            <Animated.View style={[styles.shutterInner, { backgroundColor: shutterBg }]} />
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.xl,
  },

  // Permission
  permissionButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.pill,
  },
  permissionButtonText: {
    ...Typography.labelLarge,
    color: Colors.white,
  },

  // Step bar
  stepBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    zIndex: 10,
  },
  stepPill: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.pill,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  stepPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  stepPillDone: {
    backgroundColor: 'rgba(52,211,153,0.3)',
    borderColor: Colors.success,
  },
  stepPillText: {
    ...Typography.labelSmall,
    color: 'rgba(255,255,255,0.6)',
  },
  stepPillTextActive: {
    color: '#FFFFFF',
  },

  // Instruction
  instructionOverlay: {
    position: 'absolute',
    top: '45%',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.lg,
    zIndex: 10,
  },
  instructionBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.pill,
  },
  instructionText: {
    ...Typography.bodyMedium,
    color: '#FFFFFF',
  },

  // Corner brackets
  cornerBracket: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderColor: Colors.white,
  },
  cTL: { top: 155, left: 55, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 4 },
  cTR: { top: 155, right: 55, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 4 },
  cBL: { bottom: 200, left: 55, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 4 },
  cBR: { bottom: 200, right: 55, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 4 },

  // Shutter
  shutterArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: Spacing.xl,
    zIndex: 10,
  },
  thumbnailStrip: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailActive: {
    borderColor: Colors.primary,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    ...Typography.labelSmall,
    color: 'rgba(255,255,255,0.4)',
  },
  shutterOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
  },

  // Preview
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingBottom: 60,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  previewLabel: {
    ...Typography.headlineLarge,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  previewActions: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  previewBtn: {
    flex: 1,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.pill,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  previewBtnPrimary: {
    backgroundColor: Colors.primary,
  },
  previewBtnText: {
    ...Typography.labelLarge,
    color: '#FFFFFF',
  },

  // Review screen
  reviewTitle: {
    ...Typography.headlineLarge,
    color: Colors.text,
    textAlign: 'center',
    marginTop: Spacing.xxl,
  },
  reviewSubtitle: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.xxl,
  },
  reviewGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  reviewCard: {
    flex: 1,
    aspectRatio: 0.75,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reviewImage: {
    width: '100%',
    height: '100%',
  },
  reviewCardLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  reviewCardText: {
    ...Typography.labelSmall,
    color: '#FFFFFF',
  },

  // Analyze button
  analyzeButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.pill,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  analyzeButtonText: {
    ...Typography.headlineSmall,
    color: '#FFFFFF',
  },
  resetButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  resetButtonText: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
  },
});
