import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  TextInput,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '@/lib/theme';
import { ProgressChart } from '@/components/ProgressChart';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, addMonths, subMonths, differenceInWeeks } from 'date-fns';

type ProgressPhoto = {
  id: string;
  user_id: string;
  photo_url: string;
  week_number: number;
  severity_score: number;
  improvement_percentage: number | null;
  analysis_notes: string;
  notes: string;
  annotations: Record<string, string>;
  created_at: string;
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DAY_CELL = (SCREEN_WIDTH - Spacing.xxl * 2 - 2) / 7;

const ZONE_LABELS: Record<string, string> = {
  forehead: 'Forehead',
  nose: 'T-Zone',
  left_cheek: 'Left Cheek',
  right_cheek: 'Right Cheek',
  chin: 'Chin & Jaw',
};

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Calendar state
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Detail modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalIndex, setModalIndex] = useState(0);
  const [editingNote, setEditingNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const fetchPhotos = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from('progress_photos')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    const fetched = (data as ProgressPhoto[]) || [];
    setPhotos(fetched);

    setLoading(false);
  }, []);

  useEffect(() => { fetchPhotos(); }, [fetchPhotos]);

  // ─── Upload + Claude analysis ─────────────────────────────────────────────
  const logProgressPhoto = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.4,
      base64: true,
    });

    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const uri = result.assets[0].uri;
      const base64 = result.assets[0].base64 ?? await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64' as any,
      });

      const weekNumber = photos.length > 0
        ? differenceInWeeks(new Date(), new Date(photos[photos.length - 1].created_at)) + photos[photos.length - 1].week_number
        : 1;

      // Upload to storage (best-effort) — do this first so the Edge Function URL is usable
      let photoUrl = uri;
      try {
        const fileName = `${user.id}/progress-${Date.now()}.jpg`;
        const { data: uploadData } = await supabase.storage
          .from('progress-photos')
          .upload(fileName, decode(base64), { contentType: 'image/jpeg' });
        if (uploadData) {
          const { data: { publicUrl } } = supabase.storage.from('progress-photos').getPublicUrl(fileName);
          photoUrl = publicUrl;
        }
      } catch { /* keep local URI */ }

      const { data: trackData, error: fnError } = await supabase.functions.invoke('track-progress', {
        body: { user_id: user.id, image_base64: base64, week_number: weekNumber },
      });

      if (fnError) throw fnError;

      const { error: insertError } = await supabase.from('progress_photos').insert({
        user_id: user.id,
        photo_url: photoUrl,
        week_number: weekNumber,
        severity_score: trackData.severity_score ?? 5.0,
        improvement_percentage: trackData.improvement_percentage ?? null,
        analysis_notes: trackData.analysis_notes ?? '',
        notes: '',
        annotations: trackData.zones ?? { forehead: '', nose: '', left_cheek: '', right_cheek: '', chin: '', overall: '' },
      });

      if (insertError) throw insertError;

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await fetchPhotos();
    } catch (err) {
      console.error('Progress tracking error:', err);
      Alert.alert('Error', 'Could not save your progress photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // ─── Note saving ─────────────────────────────────────────────────────────
  const saveNote = async () => {
    const photo = photos[modalIndex];
    if (!photo) return;
    setSavingNote(true);
    await supabase.from('progress_photos').update({ notes: editingNote }).eq('id', photo.id);
    setSavingNote(false);
    setPhotos(prev => prev.map((p, i) => i === modalIndex ? { ...p, notes: editingNote } : p));
  };

  // ─── Open modal ───────────────────────────────────────────────────────────
  const openModal = (index: number) => {
    setModalIndex(index);
    setEditingNote(photos[index]?.notes ?? '');
    setModalVisible(true);
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index, animated: false });
    }, 50);
  };

  // ─── Calendar helpers ─────────────────────────────────────────────────────
  const calendarDays = eachDayOfInterval({
    start: startOfMonth(calendarMonth),
    end: endOfMonth(calendarMonth),
  });
  const firstWeekday = getDay(startOfMonth(calendarMonth));
  const paddingCells = Array(firstWeekday).fill(null);

  // Group photos by date – photos are already sorted newest first, so first in each group is latest
  const photosByDate = photos.reduce<Record<string, ProgressPhoto[]>>((acc, p) => {
    const key = format(new Date(p.created_at), 'yyyy-MM-dd');
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  // ─── Chart + before/after data ────────────────────────────────────────────
  const chartData = [...photos].reverse().map(p => ({
    x: p.week_number, y: p.severity_score, label: `W${p.week_number}`,
  }));
  const latestPhoto = photos[0];
  const firstPhoto = photos[photos.length - 1];

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Fixed header */}
      <LinearGradient colors={['#FFF0F5', '#FFE0ED']} style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Progress Tracker</Text>
            <Text style={styles.headerSubtitle}>{photos.length} check-in{photos.length !== 1 ? 's' : ''} logged</Text>
          </View>
          <TouchableOpacity
            style={[styles.logButton, uploading && styles.buttonDisabled]}
            onPress={logProgressPhoto}
            disabled={uploading}
            activeOpacity={0.85}
          >
            <LinearGradient colors={[Colors.primary, Colors.primaryDark]} style={styles.logButtonGradient}>
              {uploading
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Text style={styles.logButtonText}>+ Log</Text>}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : photos.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>📸</Text>
          <Text style={styles.emptyTitle}>Start Your Progress Journey</Text>
          <Text style={styles.emptySubtitle}>Log your first photo to begin tracking your skin transformation</Text>
          <TouchableOpacity style={[styles.startButton, uploading && styles.buttonDisabled]} onPress={logProgressPhoto} disabled={uploading}>
            <LinearGradient colors={[Colors.secondary, Colors.primary]} style={styles.startButtonGradient}>
              <Text style={styles.startButtonText}>{uploading ? 'Processing...' : 'Log First Photo'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* ── 1. CALENDAR ──────────────────────────────────────────────── */}
          <View style={styles.card}>
            <View style={styles.monthNav}>
              <TouchableOpacity onPress={() => setCalendarMonth(m => subMonths(m, 1))} style={styles.monthNavBtn}>
                <Text style={styles.monthNavArrow}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.monthTitle}>{format(calendarMonth, 'MMMM yyyy')}</Text>
              <TouchableOpacity onPress={() => setCalendarMonth(m => addMonths(m, 1))} style={styles.monthNavBtn}>
                <Text style={styles.monthNavArrow}>›</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.calendarGrid}>
              {WEEKDAYS.map(d => (
                <View key={d} style={styles.dayHeader}>
                  <Text style={styles.dayHeaderText}>{d}</Text>
                </View>
              ))}

              {paddingCells.map((_, i) => <View key={`pad-${i}`} style={styles.dayCell} />)}

              {calendarDays.map(day => {
                const key = format(day, 'yyyy-MM-dd');
                const dayPhotos = photosByDate[key] ?? [];
                const latestDayPhoto = dayPhotos[0] ?? null;
                const extraCount = dayPhotos.length > 1 ? dayPhotos.length - 1 : 0;
                const isToday = isSameDay(day, new Date());
                const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;

                return (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.dayCell,
                      isToday && styles.dayCellToday,
                      isSelected && styles.dayCellSelected,
                    ]}
                    onPress={() => {
                      if (dayPhotos.length === 0) return;
                      setSelectedDay(day);
                      const idx = photos.findIndex(p => p.id === dayPhotos[0].id);
                      if (idx >= 0) openModal(idx);
                    }}
                    activeOpacity={dayPhotos.length > 0 ? 0.8 : 1}
                  >
                    {latestDayPhoto ? (
                      <>
                        <Image
                          source={{ uri: latestDayPhoto.photo_url }}
                          style={styles.dayCellImage}
                          onError={() => {}}
                        />
                        <View style={styles.dayCellOverlay}>
                          <Text style={styles.dayCellNumber}>{format(day, 'd')}</Text>
                        </View>
                        {extraCount > 0 && (
                          <View style={styles.dayCellBadge}>
                            <Text style={styles.dayCellBadgeText}>+{extraCount}</Text>
                          </View>
                        )}
                      </>
                    ) : (
                      <Text style={[styles.dayCellNumber, isToday && styles.dayCellNumberToday]}>
                        {format(day, 'd')}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── 2. BEFORE & AFTER ────────────────────────────────────────── */}
          {photos.length >= 2 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Before & After</Text>
              <Text style={styles.cardSubtitle}>Earliest vs. most recent</Text>
              <View style={styles.comparisonRow}>
                <TouchableOpacity style={styles.comparisonPhoto} onPress={() => openModal(photos.length - 1)}>
                  <Image source={{ uri: firstPhoto.photo_url }} style={styles.compareImage} />
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={styles.photoLabel}>
                    <Text style={styles.photoLabelText}>{format(new Date(firstPhoto.created_at), 'MMM d')}</Text>
                    <Text style={styles.photoLabelSub}>Score: {firstPhoto.severity_score.toFixed(1)}</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <View style={styles.comparisonMiddle}>
                  <Text style={styles.comparisonArrow}>→</Text>
                  {latestPhoto?.improvement_percentage != null && (
                    <View style={[styles.improvementPill, { backgroundColor: latestPhoto.improvement_percentage >= 0 ? Colors.successLight : Colors.errorLight }]}>
                      <Text style={[styles.improvementPillText, { color: latestPhoto.improvement_percentage >= 0 ? Colors.success : Colors.error }]}>
                        {latestPhoto.improvement_percentage > 0 ? '+' : ''}{latestPhoto.improvement_percentage.toFixed(0)}%
                      </Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity style={styles.comparisonPhoto} onPress={() => openModal(0)}>
                  <Image source={{ uri: latestPhoto.photo_url }} style={styles.compareImage} />
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={styles.photoLabel}>
                    <Text style={styles.photoLabelText}>{format(new Date(latestPhoto.created_at), 'MMM d')}</Text>
                    <Text style={styles.photoLabelSub}>Score: {latestPhoto.severity_score.toFixed(1)}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={[styles.card, styles.placeholderCard]}>
              <Text style={styles.cardTitle}>Before & After</Text>
              <Text style={styles.placeholderText}>Log a second check-in to compare your progress over time.</Text>
            </View>
          )}

          {/* ── 4. SEVERITY CHART ────────────────────────────────────────── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Severity Over Time</Text>
            <Text style={styles.cardSubtitle}>Lower score = clearer skin</Text>
            <ProgressChart data={chartData} />
          </View>

        </ScrollView>
      )}

      {/* ── DETAIL MODAL ──────────────────────────────────────────────────── */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {/* Modal header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>
              {photos[modalIndex] ? format(new Date(photos[modalIndex].created_at), 'MMMM d, yyyy') : ''}
            </Text>
            <View style={styles.modalNav}>
              <TouchableOpacity
                onPress={() => {
                  const next = Math.min(modalIndex + 1, photos.length - 1);
                  setModalIndex(next);
                  setEditingNote(photos[next]?.notes ?? '');
                  flatListRef.current?.scrollToIndex({ index: next, animated: true });
                }}
                disabled={modalIndex >= photos.length - 1}
                style={[styles.modalNavBtn, modalIndex >= photos.length - 1 && styles.modalNavBtnDisabled]}
              >
                <Text style={styles.modalNavArrow}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.modalNavCount}>{modalIndex + 1}/{photos.length}</Text>
              <TouchableOpacity
                onPress={() => {
                  const prev = Math.max(modalIndex - 1, 0);
                  setModalIndex(prev);
                  setEditingNote(photos[prev]?.notes ?? '');
                  flatListRef.current?.scrollToIndex({ index: prev, animated: true });
                }}
                disabled={modalIndex <= 0}
                style={[styles.modalNavBtn, modalIndex <= 0 && styles.modalNavBtnDisabled]}
              >
                <Text style={styles.modalNavArrow}>›</Text>
              </TouchableOpacity>
            </View>
          </View>

          <FlatList
            ref={flatListRef}
            data={photos}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={p => p.id}
            initialScrollIndex={modalIndex}
            getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
            onMomentumScrollEnd={e => {
              const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setModalIndex(index);
              setEditingNote(photos[index]?.notes ?? '');
            }}
            renderItem={({ item: photo }) => (
              <ScrollView style={{ width: SCREEN_WIDTH }} contentContainerStyle={styles.modalItemContent}>
                <Image source={{ uri: photo.photo_url }} style={styles.modalImage} resizeMode="cover" />

                <View style={styles.modalBadgeRow}>
                  <View style={styles.modalBadge}>
                    <Text style={styles.modalBadgeLabel}>Week</Text>
                    <Text style={styles.modalBadgeValue}>{photo.week_number}</Text>
                  </View>
                  <View style={[styles.modalBadge, { backgroundColor: Colors.primary + '15', borderColor: Colors.primary }]}>
                    <Text style={[styles.modalBadgeLabel, { color: Colors.primary }]}>Score</Text>
                    <Text style={[styles.modalBadgeValue, { color: Colors.primary }]}>{photo.severity_score.toFixed(1)}</Text>
                  </View>
                  {photo.improvement_percentage != null && (
                    <View style={[styles.modalBadge, {
                      backgroundColor: photo.improvement_percentage >= 0 ? Colors.successLight : Colors.errorLight,
                      borderColor: photo.improvement_percentage >= 0 ? Colors.success : Colors.error,
                    }]}>
                      <Text style={[styles.modalBadgeLabel, { color: photo.improvement_percentage >= 0 ? Colors.success : Colors.error }]}>Change</Text>
                      <Text style={[styles.modalBadgeValue, { color: photo.improvement_percentage >= 0 ? Colors.success : Colors.error }]}>
                        {photo.improvement_percentage > 0 ? '+' : ''}{photo.improvement_percentage.toFixed(0)}%
                      </Text>
                    </View>
                  )}
                </View>

                {/* AI notes */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>AI Analysis</Text>
                  <LinearGradient colors={['#FFF0F5', '#FFF8FB']} style={styles.modalInsightBox}>
                    <Text style={styles.modalInsightText}>{photo.analysis_notes}</Text>
                  </LinearGradient>
                </View>

                {/* Zone breakdown */}
                {photo.annotations && Object.values(photo.annotations).some(Boolean) && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Zone Breakdown</Text>
                    {Object.entries(ZONE_LABELS).map(([key, label]) => {
                      const val = photo.annotations[key];
                      if (!val) return null;
                      return (
                        <View key={key} style={styles.zoneRow}>
                          <Text style={styles.zoneLabel}>{label}</Text>
                          <Text style={styles.zoneValue}>{val}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* User notes */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>My Notes</Text>
                  <TextInput
                    style={styles.notesInput}
                    multiline
                    placeholder="Add a personal note for this check-in..."
                    placeholderTextColor={Colors.textMuted}
                    value={editingNote}
                    onChangeText={setEditingNote}
                  />
                  <TouchableOpacity
                    style={[styles.saveNoteBtn, savingNote && styles.buttonDisabled]}
                    onPress={saveNote}
                    disabled={savingNote}
                  >
                    <LinearGradient colors={[Colors.secondary, Colors.primary]} style={styles.saveNoteBtnGradient}>
                      <Text style={styles.saveNoteBtnText}>{savingNote ? 'Saving...' : 'Save Note'}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          />
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function decode(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.xxl, paddingTop: Spacing.md, paddingBottom: Spacing.md },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { ...Typography.displaySmall, color: Colors.text },
  headerSubtitle: { ...Typography.bodySmall, color: Colors.textMuted },
  logButton: { borderRadius: BorderRadius.md, overflow: 'hidden', ...Shadows.md },
  logButtonGradient: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, justifyContent: 'center', alignItems: 'center', minWidth: 80, minHeight: 36 },
  logButtonText: { ...Typography.labelLarge, color: Colors.white },
  buttonDisabled: { opacity: 0.6 },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xxl, gap: Spacing.lg },
  emptyEmoji: { fontSize: 64 },
  emptyTitle: { ...Typography.displaySmall, color: Colors.text, textAlign: 'center' },
  emptySubtitle: { ...Typography.bodyMedium, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
  startButton: { width: '80%', borderRadius: BorderRadius.md, overflow: 'hidden', ...Shadows.md },
  startButtonGradient: { height: 54, justifyContent: 'center', alignItems: 'center' },
  startButtonText: { ...Typography.headlineSmall, color: Colors.white },

  scrollContent: { padding: Spacing.xxl, gap: Spacing.lg, paddingBottom: 100 },
  card: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.xl, ...Shadows.md, gap: Spacing.md },
  cardTitle: { ...Typography.headlineSmall, color: Colors.text },
  cardSubtitle: { ...Typography.caption, color: Colors.textMuted, marginTop: -Spacing.sm },

  // Calendar
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  monthNavBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  monthNavArrow: { fontSize: 28, color: Colors.primary, fontWeight: '300' },
  monthTitle: { ...Typography.headlineMedium, color: Colors.text },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayHeader: { width: DAY_CELL, alignItems: 'center', paddingBottom: Spacing.sm },
  dayHeaderText: { ...Typography.caption, color: Colors.textMuted, fontWeight: '700' },
  dayCell: {
    width: DAY_CELL,
    height: DAY_CELL,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  dayCellToday: { borderWidth: 2, borderColor: Colors.primary },
  dayCellSelected: { borderWidth: 2, borderColor: Colors.secondary },
  dayCellImage: { position: 'absolute', width: '100%', height: '100%' },
  dayCellOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 2,
    paddingVertical: 1,
    alignItems: 'center',
  },
  dayCellNumber: { ...Typography.caption, color: Colors.textSecondary, fontSize: 10, fontWeight: '600' },
  dayCellNumberToday: { color: Colors.primary, fontWeight: '800' },
  dayCellBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: Colors.primary,
    borderRadius: 6,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  dayCellBadgeText: { color: Colors.white, fontSize: 7, fontWeight: '700' },

  // Before / After
  comparisonRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  comparisonPhoto: { flex: 1, borderRadius: BorderRadius.md, overflow: 'hidden' },
  compareImage: { width: '100%', aspectRatio: 1 },
  photoLabel: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.sm },
  photoLabelText: { ...Typography.labelSmall, color: Colors.white },
  photoLabelSub: { ...Typography.caption, color: 'rgba(255,255,255,0.8)' },
  comparisonMiddle: { alignItems: 'center', gap: Spacing.xs },
  comparisonArrow: { fontSize: 20, color: Colors.textMuted },
  improvementPill: { paddingHorizontal: Spacing.xs, paddingVertical: 2, borderRadius: BorderRadius.pill },
  improvementPillText: { ...Typography.caption, fontWeight: '700' },
  placeholderCard: { alignItems: 'flex-start' },
  placeholderText: { ...Typography.bodySmall, color: Colors.textMuted },

  zoneRow: { flexDirection: 'row', gap: Spacing.md, paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  zoneLabel: { ...Typography.labelSmall, color: Colors.primary, width: 90 },
  zoneValue: { ...Typography.bodySmall, color: Colors.textSecondary, flex: 1 },

  // Modal
  modalRoot: { flex: 1, backgroundColor: Colors.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, backgroundColor: Colors.white },
  modalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.subtleDeep, justifyContent: 'center', alignItems: 'center' },
  modalCloseText: { color: Colors.textSecondary, fontWeight: '600' },
  modalHeaderTitle: { ...Typography.labelLarge, color: Colors.text, flex: 1, textAlign: 'center' },
  modalNav: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  modalNavBtn: { padding: 4 },
  modalNavBtnDisabled: { opacity: 0.3 },
  modalNavArrow: { fontSize: 24, color: Colors.primary },
  modalNavCount: { ...Typography.caption, color: Colors.textMuted, minWidth: 36, textAlign: 'center' },

  modalItemContent: { padding: Spacing.xl, gap: Spacing.lg, paddingBottom: 100 },
  modalImage: { width: '100%', aspectRatio: 1, borderRadius: BorderRadius.xl },
  modalBadgeRow: { flexDirection: 'row', gap: Spacing.sm },
  modalBadge: { flex: 1, alignItems: 'center', padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.cardSubtle, gap: 2 },
  modalBadgeLabel: { ...Typography.caption, color: Colors.textMuted },
  modalBadgeValue: { ...Typography.headlineSmall, color: Colors.text },
  modalSection: { gap: Spacing.sm },
  modalSectionTitle: { ...Typography.headlineSmall, color: Colors.text },
  modalInsightBox: { borderRadius: BorderRadius.md, padding: Spacing.lg },
  modalInsightText: { ...Typography.bodySmall, color: Colors.textSecondary, lineHeight: 20 },

  notesInput: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: BorderRadius.md, padding: Spacing.lg, minHeight: 100, ...Typography.bodyMedium, color: Colors.text, textAlignVertical: 'top', backgroundColor: Colors.white },
  saveNoteBtn: { borderRadius: BorderRadius.md, overflow: 'hidden', ...Shadows.sm },
  saveNoteBtnGradient: { height: 44, justifyContent: 'center', alignItems: 'center' },
  saveNoteBtnText: { ...Typography.labelLarge, color: Colors.white },
});
