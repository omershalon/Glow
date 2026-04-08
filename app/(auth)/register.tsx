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
import * as Haptics from 'expo-haptics';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '@/lib/theme';
import Svg, { Path, Circle } from 'react-native-svg';

export default function RegisterScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [formError, setFormError] = useState('');

  const clearErrors = () => { setNameError(''); setEmailError(''); setPasswordError(''); setConfirmError(''); setFormError(''); };

  const handleRegister = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clearErrors();
    let hasError = false;
    if (!fullName) { setNameError('Name is required'); hasError = true; }
    if (!email) { setEmailError('Email is required'); hasError = true; }
    if (!password) { setPasswordError('Password is required'); hasError = true; }
    else if (password.length < 8) { setPasswordError('Must be at least 8 characters'); hasError = true; }
    if (password && confirmPassword && password !== confirmPassword) { setConfirmError('Passwords do not match'); hasError = true; }
    else if (!confirmPassword) { setConfirmError('Please confirm your password'); hasError = true; }
    if (hasError) return;

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });

    if (error) {
      setLoading(false);
      setFormError(error.message);
      return;
    }

    if (data.user) {
      // Create profile record
      await supabase.from('profiles').insert({
        id: data.user.id,
        email,
        full_name: fullName,
        subscription_tier: 'free',
        product_scans_used: 0,
      });
    }

    setLoading(false);
    router.replace('/(auth)/onboarding');
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
        {/* Header */}
        <LinearGradient
          colors={[Colors.backgroundAlt, Colors.background]}
          style={styles.header}
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <LinearGradient
              colors={[Colors.secondary, Colors.primary]}
              style={styles.logoCircle}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Svg width={34} height={34} viewBox="0 0 24 24" fill="none">
                <Circle cx={12} cy={8} r={4} stroke="#FFFFFF" strokeWidth={2} />
                <Path d="M4 21c0-4 4-7 8-7s8 3 8 7" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
              </Svg>
            </LinearGradient>
            <Text style={styles.headerTitle}>Join SkinX</Text>
            <Text style={styles.headerSubtitle}>Start your skin transformation today</Text>
          </View>
        </LinearGradient>

        {/* Form */}
        <View style={styles.formSection}>
          {formError ? <Text style={styles.formError}>{formError}</Text> : null}

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={[styles.input, focusedField === 'name' && styles.inputFocused, nameError ? styles.inputError : null]}
              placeholder="Your name"
              placeholderTextColor={Colors.textMuted}
              value={fullName}
              onChangeText={(t) => { setFullName(t); setNameError(''); }}
              autoCapitalize="words"
              autoComplete="name"
              onFocus={() => setFocusedField('name')}
              onBlur={() => setFocusedField(null)}
            />
            {nameError ? <Text style={styles.fieldError}>{nameError}</Text> : null}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={[styles.input, focusedField === 'email' && styles.inputFocused, emailError ? styles.inputError : null]}
              placeholder="your@email.com"
              placeholderTextColor={Colors.textMuted}
              value={email}
              onChangeText={(t) => { setEmail(t); setEmailError(''); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
            />
            {emailError ? <Text style={styles.fieldError}>{emailError}</Text> : null}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput, focusedField === 'password' && styles.inputFocused, passwordError ? styles.inputError : null]}
                placeholder="Min. 8 characters"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={(t) => { setPassword(t); setPasswordError(''); }}
                secureTextEntry={!showPassword}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
            {passwordError ? <Text style={styles.fieldError}>{passwordError}</Text> : null}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Confirm Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[
                  styles.input, styles.passwordInput,
                  focusedField === 'confirm' && styles.inputFocused,
                  (confirmError || (confirmPassword && confirmPassword !== password)) ? styles.inputError : null,
                ]}
                placeholder="Re-enter password"
                placeholderTextColor={Colors.textMuted}
                value={confirmPassword}
                onChangeText={(t) => { setConfirmPassword(t); setConfirmError(''); }}
                secureTextEntry={!showConfirm}
                onFocus={() => setFocusedField('confirm')}
                onBlur={() => setFocusedField(null)}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirm(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.eyeText}>{showConfirm ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
            {(confirmError || (confirmPassword && confirmPassword !== password)) && (
              <Text style={styles.fieldError}>{confirmError || 'Passwords do not match'}</Text>
            )}
          </View>

          <Text style={styles.termsText}>
            By creating an account, you agree to our{' '}
            <Text style={styles.termsLink}>Terms of Service</Text>
            {' '}and{' '}
            <Text style={styles.termsLink}>Privacy Policy</Text>
          </Text>

          <TouchableOpacity
            style={[styles.registerButton, loading && styles.registerButtonDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[Colors.secondary, Colors.primary]}
              style={styles.registerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.registerText}>
                {loading ? 'Creating Account...' : 'Create Account'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.signInRow}>
            <Text style={styles.signInPrompt}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.signInLink}>Sign In</Text>
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
  header: {
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: Spacing.xxl,
  },
  backButton: {
    marginBottom: Spacing.xl,
  },
  backText: {
    ...Typography.labelLarge,
    color: Colors.primary,
  },
  headerContent: {
    alignItems: 'center',
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    ...Shadows.lg,
  },
  logoEmoji: {
    fontSize: 32,
  },
  headerTitle: {
    ...Typography.displaySmall,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
  },
  formSection: {
    flex: 1,
    backgroundColor: Colors.card,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xxl,
    paddingBottom: 40,
    marginTop: -20,
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
    backgroundColor: Colors.backgroundAlt,
  },
  inputFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.background,
  },
  inputError: {
    borderColor: Colors.error,
  },
  fieldError: {
    ...Typography.caption,
    color: Colors.error,
    marginTop: Spacing.xs,
  },
  formError: {
    ...Typography.labelMedium,
    color: Colors.error,
    textAlign: 'center',
    backgroundColor: Colors.errorLight,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  passwordRow: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 60,
  },
  eyeBtn: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  eyeText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  inputError: {
    borderColor: Colors.error,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.error,
    marginTop: Spacing.xs,
  },
  termsText: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 20,
  },
  termsLink: {
    color: Colors.primary,
    fontWeight: '500',
  },
  registerButton: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginBottom: Spacing.xl,
    ...Shadows.md,
  },
  registerButtonDisabled: {
    opacity: 0.7,
  },
  registerGradient: {
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerText: {
    ...Typography.headlineSmall,
    color: Colors.white,
  },
  signInRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signInPrompt: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
  },
  signInLink: {
    ...Typography.bodyMedium,
    color: Colors.primary,
    fontWeight: '600',
  },
});
