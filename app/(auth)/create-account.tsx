import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import Svg, { Path, Rect, Circle, G } from 'react-native-svg';
import { supabase } from '@/lib/supabase';
import { Colors, Fonts } from '@/lib/theme';

WebBrowser.maybeCompleteAuthSession();

// ── SVG Icons ──

function AppleIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="#000">
      <Path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </Svg>
  );
}

function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.44 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </Svg>
  );
}

function MailIcon({ size = 20, color = 'rgba(255,255,255,0.6)' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={2} y={4} width={20} height={16} rx={3} stroke={color} strokeWidth={1.8} />
      <Path d="M2 7l10 6 10-6" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

// ── Helpers ──

async function saveOnboardingData(userId: string, onboardingData: string) {
  try {
    const ob = JSON.parse(onboardingData);
    await (supabase.from('onboarding_data') as any).insert({
      user_id: userId,
      age_range: ob.age || '',
      acne_duration: ob.duration || '',
      tried_products: ob.tried || [],
      known_allergies: [],
      skin_concerns: ob.concerns || [],
    });
  } catch {}
}

async function createProfile(userId: string, email: string, name: string) {
  try {
    await (supabase.from('profiles') as any).insert({
      id: userId,
      email,
      full_name: name,
      subscription_tier: 'free',
      product_scans_used: 0,
    });
  } catch {}
}

// ── Screen ──

export default function CreateAccountScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ onboardingData?: string; analysisResult?: string; photoFront?: string }>();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'choose' | 'email'>('choose');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const goToPaywall = () => {
    router.push({
      pathname: '/(auth)/paywall',
      params: { onboardingData: params.onboardingData, analysisResult: params.analysisResult, photoFront: params.photoFront },
    });
  };

  // ── Apple Sign In ──
  const signInWithApple = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        Alert.alert('Error', 'Could not sign in with Apple.');
        return;
      }

      setLoading(true);
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });

      if (error) throw error;

      if (data.user) {
        const fullName = credential.fullName
          ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim()
          : '';
        await createProfile(data.user.id, data.user.email || '', fullName);
        if (params.onboardingData) await saveOnboardingData(data.user.id, params.onboardingData);
      }

      goToPaywall();
    } catch (err: any) {
      if (err.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Apple Sign In failed', err?.message || 'Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Google Sign In (via Supabase OAuth) ──
  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      const redirectUrl = Linking.createURL('/');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `https://wvejvinngszpsaqqzjqw.supabase.co/auth/v1/callback`,
          queryParams: { prompt: 'select_account' },
        },
      });

      if (error) throw error;

      if (data.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        if (result.type === 'success' && result.url) {
          // Extract tokens from URL
          const params_url = new URL(result.url);
          const accessToken = params_url.searchParams.get('access_token') || params_url.hash?.match(/access_token=([^&]+)/)?.[1];
          const refreshToken = params_url.searchParams.get('refresh_token') || params_url.hash?.match(/refresh_token=([^&]+)/)?.[1];

          if (accessToken && refreshToken) {
            await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
            const { data: userData } = await supabase.auth.getUser();
            if (userData.user) {
              await createProfile(userData.user.id, userData.user.email || '', userData.user.user_metadata?.full_name || '');
              if (params.onboardingData) await saveOnboardingData(userData.user.id, params.onboardingData);
            }
          }

          goToPaywall();
        }
      }
    } catch (err: any) {
      Alert.alert('Google Sign In failed', err?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Email Sign Up ──
  const signUpWithEmail = async () => {
    if (!email.trim() || !password.trim() || password.length < 8) {
      Alert.alert('Error', 'Enter a valid email and password (8+ characters).');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: name.trim() } },
      });
      if (error) throw error;

      if (data.user) {
        await createProfile(data.user.id, email.trim(), name.trim());
        if (params.onboardingData) await saveOnboardingData(data.user.id, params.onboardingData);
      }
      goToPaywall();
    } catch (err: any) {
      Alert.alert('Sign up failed', err?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Email form ──
  if (mode === 'email') {
    return (
      <View style={[s.root, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        <LinearGradient colors={['#08080F', '#100830', '#1A0845']} style={StyleSheet.absoluteFill} />

        <TouchableOpacity onPress={() => setMode('choose')} style={s.backBtn}>
          <Text style={s.backArrow}>{'‹'}</Text>
        </TouchableOpacity>

        <View style={s.formArea}>
          <Text style={s.heading}>Create your account</Text>

          <TextInput style={s.input} placeholder="Full name" placeholderTextColor="rgba(255,255,255,0.25)"
            value={name} onChangeText={setName} autoCapitalize="words" />
          <TextInput style={s.input} placeholder="Email" placeholderTextColor="rgba(255,255,255,0.25)"
            value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <TextInput style={s.input} placeholder="Password (8+ characters)" placeholderTextColor="rgba(255,255,255,0.25)"
            value={password} onChangeText={setPassword} secureTextEntry />

          <TouchableOpacity style={s.submitBtn} onPress={signUpWithEmail} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color="#000" /> : <Text style={s.submitText}>Create Account</Text>}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Choose auth method ──
  return (
    <View style={[s.root, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]}>
      <LinearGradient colors={['#08080F', '#100830', '#1A0845']} style={StyleSheet.absoluteFill} />

      <View style={s.center}>
        <Text style={s.heading}>Save your progress</Text>
        <Text style={s.sub}>Create a free account to access your skin analysis</Text>

        <View style={s.authBtns}>
          {/* Apple */}
          <TouchableOpacity style={s.appleBtn} activeOpacity={0.85}
            onPress={Platform.OS === 'ios' ? signInWithApple : signInWithGoogle}>
            <AppleIcon size={18} />
            <Text style={s.appleTxt}>Sign in with Apple</Text>
          </TouchableOpacity>

          {/* Google */}
          <TouchableOpacity style={s.googleBtn} activeOpacity={0.85} onPress={signInWithGoogle}>
            <GoogleIcon size={18} />
            <Text style={s.googleTxt}>Sign in with Google</Text>
          </TouchableOpacity>

          {/* Email */}
          <TouchableOpacity style={s.emailBtn} activeOpacity={0.85} onPress={() => setMode('email')}>
            <MailIcon size={18} />
            <Text style={s.emailTxt}>Continue with email</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.saved}>Your analysis is saved to your account</Text>
      </View>

      {loading && (
        <View style={s.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, gap: 14 },

  heading: { fontFamily: Fonts.bold, fontSize: 28, color: '#FFF', textAlign: 'center', letterSpacing: -0.5 },
  sub: { fontFamily: Fonts.regular, fontSize: 15, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 22 },

  authBtns: { gap: 12, marginTop: 24 },

  appleBtn: {
    height: 54, borderRadius: 14, backgroundColor: '#FFFFFF',
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
  },
  appleTxt: { fontFamily: Fonts.semibold, fontSize: 16, color: '#000' },

  googleBtn: {
    height: 54, borderRadius: 14, backgroundColor: 'transparent',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
  },
  googleTxt: { fontFamily: Fonts.semibold, fontSize: 16, color: '#FFF' },

  emailBtn: {
    height: 54, borderRadius: 14, backgroundColor: 'transparent',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
  },
  emailTxt: { fontFamily: Fonts.medium, fontSize: 16, color: 'rgba(255,255,255,0.6)' },

  saved: { fontFamily: Fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.25)', textAlign: 'center', marginTop: 16 },

  // Email form
  backBtn: { paddingHorizontal: 24 },
  backArrow: { fontSize: 30, color: 'rgba(255,255,255,0.4)', fontWeight: '300' },
  formArea: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, gap: 14 },
  input: {
    height: 52, borderRadius: 14, backgroundColor: 'transparent',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 18, fontFamily: Fonts.regular, fontSize: 16, color: '#FFF',
  },
  submitBtn: { height: 54, borderRadius: 14, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  submitText: { fontFamily: Fonts.bold, fontSize: 16, color: '#000' },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
  },
});
