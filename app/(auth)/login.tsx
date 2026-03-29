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
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '@/lib/theme';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      Alert.alert('Sign in failed', error.message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero gradient header */}
        <LinearGradient
          colors={['#FFF0F5', '#FFE0ED', '#F8C8DC']}
          style={styles.heroSection}
        >
          <View style={styles.logoContainer}>
            <LinearGradient
              colors={[Colors.primary, Colors.primaryDark]}
              style={styles.logoCircle}
            >
              <Text style={styles.logoEmoji}>✨</Text>
            </LinearGradient>
            <Text style={styles.brandName}>glow</Text>
            <Text style={styles.brandTagline}>Your AI Skincare Companion</Text>
          </View>
        </LinearGradient>

        {/* Form section */}
        <View style={styles.formSection}>
          <Text style={styles.welcomeTitle}>Welcome back</Text>
          <Text style={styles.welcomeSubtitle}>Sign in to continue your skin journey</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={[styles.input, focusedField === 'email' && styles.inputFocused]}
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

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Password</Text>
            <TextInput
              style={[styles.input, focusedField === 'password' && styles.inputFocused]}
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

          <TouchableOpacity style={styles.forgotPassword}>
            <Text style={styles.forgotPasswordText}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.signInButton, loading && styles.signInButtonDisabled]}
            onPress={handleSignIn}
            disabled={loading}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[Colors.primary, Colors.primaryDark]}
              style={styles.signInGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.signInText}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social buttons */}
          <View style={styles.socialRow}>
            <TouchableOpacity style={styles.socialButton} activeOpacity={0.8}>
              <Text style={styles.socialButtonText}>Apple</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialButton} activeOpacity={0.8}>
              <Text style={styles.socialButtonText}>Google</Text>
            </TouchableOpacity>
          </View>

          {/* Sign up link */}
          <View style={styles.signUpRow}>
            <Text style={styles.signUpPrompt}>New to Glow? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.signUpLink}>Create Account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  heroSection: {
    paddingTop: 80,
    paddingBottom: 40,
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    ...Shadows.xl,
  },
  logoEmoji: {
    fontSize: 36,
  },
  brandName: {
    ...Typography.displayLarge,
    color: Colors.primary,
    fontWeight: '800',
    letterSpacing: 2,
  },
  brandTagline: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  formSection: {
    flex: 1,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xxl,
    paddingBottom: 40,
    marginTop: -20,
  },
  welcomeTitle: {
    ...Typography.displaySmall,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  welcomeSubtitle: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
    marginBottom: Spacing.xxl,
  },
  inputContainer: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    ...Typography.labelMedium,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    height: 52,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    ...Typography.bodyLarge,
    color: Colors.text,
    backgroundColor: Colors.cardSubtle,
  },
  inputFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: Spacing.xl,
    marginTop: -Spacing.sm,
  },
  forgotPasswordText: {
    ...Typography.labelMedium,
    color: Colors.primary,
  },
  signInButton: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginBottom: Spacing.xxl,
    ...Shadows.md,
  },
  signInButtonDisabled: {
    opacity: 0.7,
  },
  signInGradient: {
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signInText: {
    ...Typography.headlineSmall,
    color: Colors.white,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginHorizontal: Spacing.md,
  },
  socialRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  socialButton: {
    flex: 1,
    height: 52,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  socialButtonText: {
    ...Typography.labelLarge,
    color: Colors.text,
  },
  signUpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signUpPrompt: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
  },
  signUpLink: {
    ...Typography.bodyMedium,
    color: Colors.primary,
    fontWeight: '600',
  },
});
