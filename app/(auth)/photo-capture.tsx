import { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts } from '@/lib/theme';

const PHASES = [
  { instruction: 'Look straight ahead', arrow: null },
  { instruction: 'Turn your head to the left', arrow: '←' },
  { instruction: 'Turn your head to the right', arrow: '→' },
];

export default function PhotoCaptureScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ onboardingData?: string }>();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState(0); // 0, 1, 2
  const [photos, setPhotos] = useState<string[]>([]);
  const [transitioning, setTransitioning] = useState(false);
  const [showCheck, setShowCheck] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const flashAnim = useRef(new Animated.Value(0)).current;

  const capture = async () => {
    if (!cameraRef.current || transitioning) return;
    setTransitioning(true);

    // Flash + haptic
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8, base64: false });
      const newPhotos = [...photos, photo?.uri || ''];
      setPhotos(newPhotos);

      // Show checkmark
      setShowCheck(true);
      await new Promise(r => setTimeout(r, 600));
      setShowCheck(false);

      if (phase < 2) {
        // Show transition instruction
        setPhase(phase + 1);
        await new Promise(r => setTimeout(r, 1200));
        setTransitioning(false);
      } else {
        // All 3 captured — go to analyzing
        await new Promise(r => setTimeout(r, 400));
        router.push({
          pathname: '/(auth)/analyzing',
          params: {
            onboardingData: params.onboardingData || '{}',
            photoFront: newPhotos[0] || '',
            photoLeft: newPhotos[1] || '',
            photoRight: newPhotos[2] || '',
          },
        });
      }
    } catch {
      setTransitioning(false);
    }
  };

  // Permission request
  if (!permission?.granted) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center', gap: 16, paddingHorizontal: 32 }]}>
        <Text style={styles.permTitle}>Camera Access Needed</Text>
        <Text style={styles.permSub}>We need your camera to analyze your skin</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission} activeOpacity={0.85}>
          <Text style={styles.permBtnText}>Enable Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { instruction, arrow } = PHASES[phase];

  return (
    <View style={styles.container}>
      {/* Fullscreen camera */}
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} facing="front" />

      {/* Flash overlay */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#FFF', opacity: flashAnim }]} pointerEvents="none" />

      {/* Progress dots */}
      <View style={[styles.dotsRow, { top: insets.top + 16 }]}>
        {[0, 1, 2].map(i => (
          <View key={i} style={[styles.dot, i <= phase && styles.dotActive, i < phase && styles.dotDone]} />
        ))}
      </View>

      {/* Checkmark overlay */}
      {showCheck && (
        <View style={styles.checkOverlay}>
          <View style={styles.checkCircle}>
            <Text style={styles.checkMark}>✓</Text>
          </View>
        </View>
      )}

      {/* Instruction + arrow */}
      {!showCheck && (
        <View style={styles.instructionArea}>
          {arrow && <Text style={styles.arrow}>{arrow}</Text>}
          <Text style={styles.instruction}>{instruction}</Text>
          <Text style={styles.photoCount}>Photo {phase + 1} of 3</Text>
        </View>
      )}

      {/* Manual capture button (always visible as fallback) */}
      <View style={[styles.bottomArea, { paddingBottom: insets.bottom + 30 }]}>
        <TouchableOpacity style={styles.captureBtn} onPress={capture} disabled={transitioning} activeOpacity={0.85}>
          <View style={styles.captureInner} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  dotsRow: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 8, zIndex: 10 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.25)' },
  dotActive: { backgroundColor: 'rgba(255,255,255,0.6)' },
  dotDone: { backgroundColor: Colors.primary },

  checkOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 20 },
  checkCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.success, justifyContent: 'center', alignItems: 'center' },
  checkMark: { fontSize: 36, color: '#FFF', fontWeight: '700' },

  instructionArea: { position: 'absolute', top: '35%', left: 0, right: 0, alignItems: 'center', gap: 8, zIndex: 10 },
  arrow: { fontSize: 48, color: '#FFF', opacity: 0.8 },
  instruction: { fontFamily: Fonts.bold, fontSize: 22, color: '#FFF', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  photoCount: { fontFamily: Fonts.medium, fontSize: 14, color: 'rgba(255,255,255,0.5)' },

  bottomArea: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', zIndex: 10 },
  captureBtn: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  captureInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#FFF' },

  permTitle: { fontFamily: Fonts.bold, fontSize: 22, color: '#FFF', textAlign: 'center' },
  permSub: { fontFamily: Fonts.regular, fontSize: 15, color: 'rgba(255,255,255,0.5)', textAlign: 'center' },
  permBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14 },
  permBtnText: { fontFamily: Fonts.bold, fontSize: 16, color: '#FFF' },
});
