import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '@/lib/theme';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [email, setEmailState] = useState('');
  const [fullName, setFullName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loadingUser, setLoadingUser] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [showPasswordSection, setShowPasswordSection] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setEmailState(user.email ?? '');
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
        if (profile?.full_name) setFullName(profile.full_name);
      }
      setLoadingUser(false);
    })();
  }, []);

  const handleSaveName = async () => {
    if (!fullName.trim()) {
      Alert.alert('Required', 'Please enter a name.');
      return;
    }
    setSavingName(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').update({ full_name: fullName.trim() }).eq('id', user.id);
    }
    setSavingName(false);
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Missing fields', 'Please fill in all password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Too short', 'Password must be at least 8 characters.');
      return;
    }

    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);

    if (error) {
      Alert.alert('Failed', error.message);
    } else {
      Alert.alert('Done', 'Your password has been updated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordSection(false);
    }
  };

  const handleLogOut = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            await supabase.auth.signOut();
            setLoggingOut(false);
          },
        },
      ]
    );
  };

  const initials = fullName
    ? fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : email[0]?.toUpperCase() ?? '?';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={{ width: 60 }} />
        </View>

        {loadingUser ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <>
            {/* Avatar + name */}
            <View style={styles.avatarSection}>
              <LinearGradient
                colors={[Colors.secondary, Colors.primary]}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>{initials}</Text>
              </LinearGradient>
              <Text style={styles.fullName}>{fullName || 'Glow User'}</Text>
              <Text style={styles.emailDisplay}>{email}</Text>
            </View>

            {/* Account info card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Account</Text>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue} numberOfLines={1}>{email}</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.nameRow}>
                <Text style={styles.infoLabel}>Name</Text>
                <TextInput
                  style={[styles.nameInput, focusedField === 'name' && styles.inputFocused]}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Your name"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="words"
                  returnKeyType="done"
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                  onSubmitEditing={handleSaveName}
                />
                <TouchableOpacity
                  style={[styles.saveNameBtn, savingName && { opacity: 0.6 }]}
                  onPress={handleSaveName}
                  disabled={savingName}
                  activeOpacity={0.8}
                >
                  {savingName
                    ? <ActivityIndicator size="small" color={Colors.white} />
                    : <Text style={styles.saveNameText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </View>

            {/* Password section */}
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.sectionToggleRow}
                onPress={() => setShowPasswordSection((v) => !v)}
                activeOpacity={0.7}
              >
                <Text style={styles.cardTitle}>Change Password</Text>
                <Text style={styles.toggleChevron}>
                  {showPasswordSection ? '▲' : '▼'}
                </Text>
              </TouchableOpacity>

              {showPasswordSection && (
                <View style={styles.passwordFields}>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>New Password</Text>
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
                    <Text style={styles.fieldLabel}>Confirm New Password</Text>
                    <TextInput
                      style={[
                        styles.input,
                        focusedField === 'confirm' && styles.inputFocused,
                        confirmPassword && confirmPassword !== newPassword && styles.inputError,
                      ]}
                      placeholder="Re-enter new password"
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
                    style={[styles.savePasswordBtn, savingPassword && { opacity: 0.7 }]}
                    onPress={handleChangePassword}
                    disabled={savingPassword}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={[Colors.primary, Colors.primaryDark]}
                      style={styles.savePasswordGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Text style={styles.savePasswordText}>
                        {savingPassword ? 'Saving...' : 'Update Password'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Log out */}
            <TouchableOpacity
              style={[styles.logOutBtn, loggingOut && { opacity: 0.7 }]}
              onPress={handleLogOut}
              disabled={loggingOut}
              activeOpacity={0.85}
            >
              {loggingOut
                ? <ActivityIndicator size="small" color={Colors.error} />
                : <Text style={styles.logOutText}>Log Out</Text>}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 60,
    paddingVertical: Spacing.xs,
  },
  backText: {
    ...Typography.labelLarge,
    color: Colors.primary,
  },
  headerTitle: {
    ...Typography.headlineMedium,
    color: Colors.text,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.lg,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.white,
  },
  fullName: {
    ...Typography.headlineMedium,
    color: Colors.text,
    marginTop: Spacing.xs,
  },
  emailDisplay: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTitle: {
    ...Typography.headlineSmall,
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  infoLabel: {
    ...Typography.labelMedium,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    ...Typography.bodyMedium,
    color: Colors.text,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.xs,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  nameInput: {
    flex: 1,
    height: 40,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    ...Typography.bodyMedium,
    color: Colors.text,
    backgroundColor: Colors.cardSubtle,
  },
  saveNameBtn: {
    height: 40,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveNameText: {
    ...Typography.labelMedium,
    color: Colors.white,
    fontWeight: '600',
  },
  sectionToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  toggleChevron: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  passwordFields: {
    marginTop: Spacing.lg,
    gap: Spacing.lg,
  },
  fieldGroup: {
    gap: Spacing.xs,
  },
  fieldLabel: {
    ...Typography.labelMedium,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    height: 50,
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
    backgroundColor: Colors.backgroundAlt,
  },
  inputError: {
    borderColor: Colors.error,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.error,
  },
  savePasswordBtn: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    ...Shadows.sm,
    marginTop: Spacing.xs,
  },
  savePasswordGradient: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  savePasswordText: {
    ...Typography.labelLarge,
    color: Colors.white,
  },
  logOutBtn: {
    marginHorizontal: Spacing.xl,
    height: 52,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  logOutText: {
    ...Typography.labelLarge,
    color: Colors.error,
    fontWeight: '600',
  },
});
