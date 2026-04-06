import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, BorderRadius, Spacing, Shadows, Fonts } from '@/lib/theme';
import Svg, { Path } from 'react-native-svg';

function SparkleIcon({ size = 20, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" stroke={color} strokeWidth={1.6} fill={color} fillOpacity={0.25} />
    </Svg>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [loading,      setLoading]      = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Enter your email', 'Type your email address above, then tap Forgot Password.');
      return;
    }
    const redirectTo = 'https://wvejvinngszpsaqqzjqw.supabase.co/functions/v1/auth-redirect';
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      Alert.alert('Failed', error.message);
    } else {
      Alert.alert('Email sent', `We've sent a password reset link to ${email}. Check your inbox.`);
    }
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) Alert.alert('Sign in failed', error.message);
  };

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero */}
        <View style={s.hero}>
          {/* Glow blob */}
          <View style={s.glowBlob} pointerEvents="none" />

          <View style={s.logoRow}>
            <SparkleIcon size={22} color={Colors.primaryLight} />
            <Text style={s.brandName}>glow</Text>
          </View>
          <Text style={s.heroTitle}>{'Welcome\nback'}</Text>
          <Text style={s.heroSub}>Sign in to continue your skin journey</Text>
        </View>

        {/* Form card */}
        <View style={s.card}>
          <View style={s.fieldGroup}>
            <Text style={s.label}>Email</Text>
            <TextInput
              style={[s.input, focusedField === 'email' && s.inputFocused]}
              placeholder="your@email.com"
              placeholderTextColor={Colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          <View style={s.fieldGroup}>
            <Text style={s.label}>Password</Text>
            <TextInput
              style={[s.input, focusedField === 'password' && s.inputFocused]}
              placeholder="••••••••"
              placeholderTextColor={Colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          <TouchableOpacity style={s.forgotRow} onPress={handleForgotPassword}>
            <Text style={s.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.signInBtn, loading && s.signInBtnDisabled]}
            onPress={handleSignIn}
            disabled={loading}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[Colors.primary, Colors.primaryDark]}
              style={s.signInGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={s.signInText}>{loading ? 'Signing in…' : 'Sign In'}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={s.dividerRow}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>or</Text>
            <View style={s.dividerLine} />
          </View>

          <View style={s.signUpRow}>
            <Text style={s.signUpPrompt}>New to Glow? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={s.signUpLink}>Create Account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flexGrow: 1,
  },

  /* Hero */
  hero: {
    paddingTop: 80,
    paddingBottom: 48,
    paddingHorizontal: Spacing.xxl,
    overflow: 'hidden',
  },
  glowBlob: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(91,33,182,0.22)',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: Spacing.xxxl,
  },
  brandName: {
    fontFamily: Fonts.extrabold,
    fontSize: 20,
    color: Colors.white,
    letterSpacing: 1,
  },
  heroTitle: {
    fontFamily: Fonts.extrabold,
    fontSize: 44,
    color: Colors.white,
    lineHeight: 50,
    letterSpacing: -1.2,
    marginBottom: Spacing.md,
  },
  heroSub: {
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },

  /* Form card */
  card: {
    flex: 1,
    backgroundColor: Colors.card,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xxxl,
    paddingBottom: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomWidth: 0,
    gap: Spacing.lg,
  },
  fieldGroup: {
    gap: Spacing.xs,
  },
  label: {
    fontFamily: Fonts.semibold,
    fontSize: 12,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    height: 52,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    fontFamily: Fonts.regular,
    fontSize: 16,
    color: Colors.white,
    backgroundColor: Colors.subtle,
  },
  inputFocused: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(124,92,252,0.08)',
  },
  forgotRow: {
    alignSelf: 'flex-end',
    marginTop: -Spacing.xs,
  },
  forgotText: {
    fontFamily: Fonts.semibold,
    fontSize: 13,
    color: Colors.primaryLight,
  },
  signInBtn: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    ...Shadows.md,
  },
  signInBtnDisabled: {
    opacity: 0.65,
  },
  signInGradient: {
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signInText: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    color: Colors.white,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textMuted,
  },
  signUpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signUpPrompt: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.textMuted,
  },
  signUpLink: {
    fontFamily: Fonts.semibold,
    fontSize: 14,
    color: Colors.primaryLight,
  },
});
