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

export default function RegisterScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!fullName || !email || !password) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Password mismatch', 'Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Weak password', 'Password must be at least 8 characters.');
      return;
    }

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
      Alert.alert('Registration failed', error.message);
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
          colors={['#FFF0F5', '#FFE0ED']}
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
              <Text style={styles.logoEmoji}>🌸</Text>
            </LinearGradient>
            <Text style={styles.headerTitle}>Join Glow</Text>
            <Text style={styles.headerSubtitle}>Start your skin transformation today</Text>
          </View>
        </LinearGradient>

        {/* Form */}
        <View style={styles.formSection}>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={[styles.input, focusedField === 'name' && styles.inputFocused]}
              placeholder="Your name"
              placeholderTextColor={Colors.textMuted}
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              autoComplete="name"
              onFocus={() => setFocusedField('name')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

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
              placeholder="Min. 8 characters"
              placeholderTextColor={Colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Confirm Password</Text>
            <TextInput
              style={[
                styles.input,
                focusedField === 'confirm' && styles.inputFocused,
                confirmPassword && confirmPassword !== password && styles.inputError,
              ]}
              placeholder="Re-enter password"
              placeholderTextColor={Colors.textMuted}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              onFocus={() => setFocusedField('confirm')}
              onBlur={() => setFocusedField(null)}
            />
            {confirmPassword && confirmPassword !== password && (
              <Text style={styles.errorText}>Passwords do not match</Text>
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
    backgroundColor: Colors.white,
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
    backgroundColor: Colors.cardSubtle,
  },
  inputFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
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
