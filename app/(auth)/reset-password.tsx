import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '@/lib/theme';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleReset = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Missing fields', 'Please fill in both password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Too short', 'Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (error) {
      Alert.alert('Failed', error.message);
    } else {
      Alert.alert('Password updated', 'Your password has been reset. You can now sign in.', [
        { text: 'Sign In', onPress: () => router.replace('/(auth)/login') },
      ]);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient colors={['#FFF0F5', '#FFE0ED']} style={styles.hero}>
        <LinearGradient colors={[Colors.primary, Colors.primaryDark]} style={styles.logoCircle}>
          <Text style={styles.logoEmoji}>🔑</Text>
        </LinearGradient>
        <Text style={styles.heroTitle}>Set New Password</Text>
        <Text style={styles.heroSubtitle}>Choose a strong password for your account</Text>
      </LinearGradient>

      <View style={styles.form}>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>New Password</Text>
          <TextInput
            style={[styles.input, focusedField === 'new' && styles.inputFocused]}
            placeholder="Min. 8 characters"
            placeholderTextColor={Colors.textMuted}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            onFocus={() => setFocusedField('new')}
            onBlur={() => setFocusedField(null)}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Confirm Password</Text>
          <TextInput
            style={[
              styles.input,
              focusedField === 'confirm' && styles.inputFocused,
              confirmPassword && confirmPassword !== newPassword && styles.inputError,
            ]}
            placeholder="Re-enter password"
            placeholderTextColor={Colors.textMuted}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            onFocus={() => setFocusedField('confirm')}
            onBlur={() => setFocusedField(null)}
          />
          {confirmPassword && confirmPassword !== newPassword && (
            <Text style={styles.errorText}>Passwords do not match</Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.button, loading && { opacity: 0.7 }]}
          onPress={handleReset}
          disabled={loading}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[Colors.primary, Colors.primaryDark]}
            style={styles.buttonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Updating...' : 'Update Password'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  hero: {
    paddingTop: 80,
    paddingBottom: 40,
    alignItems: 'center',
    gap: Spacing.md,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.lg,
  },
  logoEmoji: { fontSize: 30 },
  heroTitle: { ...Typography.displaySmall, color: Colors.text },
  heroSubtitle: { ...Typography.bodyMedium, color: Colors.textSecondary },
  form: {
    flex: 1,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xxl,
    marginTop: -20,
    gap: Spacing.lg,
  },
  fieldGroup: { gap: Spacing.xs },
  label: {
    ...Typography.labelMedium,
    color: Colors.textSecondary,
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
    backgroundColor: Colors.card,
  },
  inputFocused: { borderColor: Colors.primary, backgroundColor: Colors.white },
  inputError: { borderColor: Colors.error },
  errorText: { ...Typography.caption, color: Colors.error },
  button: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginTop: Spacing.sm,
    ...Shadows.md,
  },
  buttonGradient: {
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: { ...Typography.headlineSmall, color: Colors.white },
});
