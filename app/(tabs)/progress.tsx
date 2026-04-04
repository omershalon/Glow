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
  Animated,
} from 'react-native';
import Svg, { Path, Circle, Line, Polyline } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '@/lib/theme';

// ─── SVG Icon Components ────────────────────────────────────────────────────

/** Camera icon for empty state */
const CameraIcon = ({ size = 64, color = Colors.primary }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2v11z"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Circle cx={12} cy={13} r={4} stroke={color} strokeWidth={1.5} fill="none" />
    {/* Flash burst */}
    <Line x1={19} y1={2} x2={19} y2={4} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    <Line x1={17.5} y1={2.5} x2={18.5} y2={3.5} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    <Line x1={20.5} y1={2.5} x2={19.5} y2={3.5} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
  </Svg>
);

/** Close (X) icon for modal */
const CloseIcon = ({ size = 14, color = Colors.textSecondary }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Line x1={18} y1={6} x2={6} y2={18} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
    <Line x1={6} y1={6} x2={18} y2={18} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
  </Svg>
);

/** Chevron left icon */
const ChevronLeftIcon = ({ size = 28, color = Colors.primary }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Polyline points="15,18 9,12 15,6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </Svg>
);

/** Chevron right icon */
const ChevronRightIcon = ({ size = 28, color = Colors.primary }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Polyline points="9,6 15,12 9,18" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </Svg>
);

/** Chevron down icon */
const ChevronDownIcon = ({ size = 28, color = Colors.text }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Polyline points="6,9 12,15 18,9" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </Svg>
);

/** Down arrow icon for metrics */
const ArrowDownIcon = ({ size = 14, color = Colors.success }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Line x1={12} y1={5} x2={12} y2={19} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
    <Polyline points="19,12 12,19 5,12" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </Svg>
);
import { ProgressChart } from '@/components/ProgressChart';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, addMonths, subMonths, differenceInWeeks } from 'date-fns';

type ProgressPhoto = {
  id: string;
  user_id: string;
  image_url: string;
  week_number: number;
  severity_score: number;
  improvement_percentage: number | null;
  analysis_notes: string;
  notes: string;
  annotations?: Record<string, string>;
  created_at: string;
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Card inner width = screen - scrollContent padding (xxl*2) - card padding (xl*2)
const DAY_CELL = Math.floor((SCREEN_WIDTH - Spacing.xxl * 2 - Spacing.xl * 2) / 7);

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

  // Fullscreen calendar state
  const [calendarFullscreen, setCalendarFullscreen] = useState(false);

  // Expand animation state
  const expandAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(1)).current;
  const [expandPhoto, setExpandPhoto] = useState<ProgressPhoto | null>(null);
  const [expandOrigin, setExpandOrigin] = useState({ x: 0, y: 0, size: 0 });
  const cellRefs = useRef<Record<string, View | null>>({});

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
      quality: 0.85,
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

      // Upload to storage (best-effort)
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
        image_url: photoUrl,
        week_number: weekNumber,
        severity_score: Math.round(trackData.severity_score ?? 5),
        improvement_percentage: trackData.improvement_percentage ?? null,
        analysis_notes: trackData.analysis_notes ?? '',
        notes: '',
        annotations: trackData.zones ?? {},
      } as any);

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

  // ─── Open modal (from comparison cards etc) ────────────────────────────────
  const openModal = (index: number) => {
    setModalIndex(index);
    setEditingNote(photos[index]?.notes ?? '');
    setModalVisible(true);
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index, animated: false });
    }, 50);
  };

  // ─── Expand from calendar cell ────────────────────────────────────────────
  const expandFromCell = (dateKey: string, photo: ProgressPhoto) => {
    const cellView = cellRefs.current[dateKey];
    if (!cellView) {
      // fallback to modal
      const idx = photos.findIndex(p => p.id === photo.id);
      if (idx >= 0) openModal(idx);
      return;
    }

    cellView.measureInWindow((x, y, width, height) => {
      setExpandOrigin({ x: x + width / 2, y: y + height / 2, size: width });
      setExpandPhoto(photo);
      expandAnim.setValue(0);
      Animated.timing(expandAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });
  };

  const closeExpand = () => {
    Animated.timing(expandAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setExpandPhoto(null);
    });
  };

  // ─── Calendar helpers ─────────────────────────────────────────────────────
  const calendarDays = eachDayOfInterval({
    start: startOfMonth(calendarMonth),
    end: endOfMonth(calendarMonth),
  });
  const firstWeekday = getDay(startOfMonth(calendarMonth));
  const paddingCells = Array(firstWeekday).fill(null);

  // Group photos by date
  const photosByDate = photos.reduce<Record<string, ProgressPhoto[]>>((acc, p) => {
    const key = format(new Date(p.created_at), 'yyyy-MM-dd');
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  // ─── Render a month grid ─────────────────────────────────────────────────
  const renderMonthGrid = (month: Date, cellWidth: number) => {
    const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
    const pad = Array(getDay(startOfMonth(month))).fill(null);

    return (
      <View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {WEEKDAYS.map(d => (
            <View key={d} style={{ width: cellWidth, alignItems: 'center', paddingBottom: Spacing.sm }}>
              <Text style={styles.dayHeaderText}>{d}</Text>
            </View>
          ))}
          {pad.map((_, i) => <View key={`p-${i}`} style={{ width: cellWidth, height: cellWidth }} />)}
          {days.map(day => {
            const key = format(day, 'yyyy-MM-dd');
            const dayPhotos = photosByDate[key] ?? [];
            const latestDayPhoto = dayPhotos[0] ?? null;
            const hasPhotos = dayPhotos.length > 0;
            const isToday = isSameDay(day, new Date());
            const circleSize = cellWidth * 0.78;

            return (
              <TouchableOpacity
                key={key}
                style={{ width: cellWidth, height: cellWidth, justifyContent: 'center', alignItems: 'center', marginBottom: 2 }}
                onPress={() => {
                  if (!latestDayPhoto) return;
                  setCalendarFullscreen(false);
                  setSelectedDay(day);
                  expandFromCell(key, latestDayPhoto);
                }}
                activeOpacity={hasPhotos ? 0.7 : 1}
              >
                <View
                  ref={(ref) => { if (hasPhotos) cellRefs.current[key] = ref; }}
                  style={[
                    { width: circleSize, height: circleSize, borderRadius: circleSize / 2, justifyContent: 'center', alignItems: 'center' },
                    hasPhotos && styles.dayCellLogged,
                    isToday && !hasPhotos && styles.dayCellToday,
                    isToday && hasPhotos && styles.dayCellTodayLogged,
                  ]}
                >
                  {hasPhotos && latestDayPhoto?.image_url ? (
                    <Image source={{ uri: latestDayPhoto.image_url }} style={{ position: 'absolute', width: '100%', height: '100%', borderRadius: circleSize / 2 }} />
                  ) : null}
                  <Text style={[
                    styles.dayCellNumber,
                    hasPhotos && styles.dayCellNumberLogged,
                    isToday && !hasPhotos && styles.dayCellNumberToday,
                  ]}>
                    {format(day, 'd')}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  // ─── Chart + before/after data ────────────────────────────────────────────
  const chartData = [...photos].reverse().map(p => ({
    x: p.week_number, y: p.severity_score, label: `W${p.week_number}`,
  }));
  const latestPhoto = photos[0];
  const firstPhoto = photos[photos.length - 1];

  // Determine current week for comparison header
  const currentWeek = latestPhoto?.week_number ?? 1;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Progress log</Text>
            <Text style={styles.headerSubtitle}>Monitor your skin journey week by week</Text>
          </View>
          <TouchableOpacity
            style={[styles.logButton, uploading && styles.buttonDisabled]}
            onPress={logProgressPhoto}
            disabled={uploading}
            activeOpacity={0.85}
          >
            {uploading
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <Text style={styles.logButtonText}>+ Log</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : photos.length === 0 ? (
        <View style={styles.centered}>
          <CameraIcon size={64} color={Colors.primary} />
          <Text style={styles.emptyTitle}>Start Your Progress Journey</Text>
          <Text style={styles.emptySubtitle}>Log your first photo to begin tracking your skin transformation</Text>
          <TouchableOpacity
            style={[styles.startButton, uploading && styles.buttonDisabled]}
            onPress={logProgressPhoto}
            disabled={uploading}
          >
            <Text style={styles.startButtonText}>{uploading ? 'Processing...' : 'Log First Photo'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* ── 1. CALENDAR ──────────────────────────────────────────────── */}
          <View style={styles.card}>
            <View style={styles.monthNav}>
              <TouchableOpacity onPress={() => setCalendarMonth(m => subMonths(m, 1))} style={styles.monthNavBtn}>
                <ChevronLeftIcon size={28} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setCalendarFullscreen(true)} activeOpacity={0.7}>
                <Text style={styles.monthTitle}>{format(calendarMonth, 'MMMM yyyy')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setCalendarMonth(m => addMonths(m, 1))} style={styles.monthNavBtn}>
                <ChevronRightIcon size={28} color={Colors.primary} />
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
                const hasPhotos = dayPhotos.length > 0;
                const isToday = isSameDay(day, new Date());

                return (
                  <TouchableOpacity
                    key={key}
                    style={styles.dayCell}
                    onPress={() => {
                      if (!latestDayPhoto) return;
                      setSelectedDay(day);
                      expandFromCell(key, latestDayPhoto);
                    }}
                    activeOpacity={hasPhotos ? 0.7 : 1}
                  >
                    <View
                      ref={(ref) => { if (hasPhotos) cellRefs.current[key] = ref; }}
                      style={[
                        styles.dayCellCircle,
                        hasPhotos && styles.dayCellLogged,
                        isToday && !hasPhotos && styles.dayCellToday,
                        isToday && hasPhotos && styles.dayCellTodayLogged,
                      ]}
                    >
                      {hasPhotos && latestDayPhoto?.image_url ? (
                        <Image
                          source={{ uri: latestDayPhoto.image_url }}
                          style={styles.dayCellThumb}
                        />
                      ) : null}
                      <Text
                        style={[
                          styles.dayCellNumber,
                          hasPhotos && styles.dayCellNumberLogged,
                          isToday && !hasPhotos && styles.dayCellNumberToday,
                        ]}
                      >
                        {format(day, 'd')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── 2. WEEK COMPARISON ───────────────────────────────────────── */}
          {photos.length >= 2 ? (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>WEEK {currentWeek} COMPARISON</Text>
              <View style={styles.comparisonRow}>
                <TouchableOpacity style={styles.comparisonCard} onPress={() => openModal(0)}>
                  <Image source={{ uri: latestPhoto.image_url }} style={styles.compareImage} />
                  <View style={styles.compareInfo}>
                    <Text style={styles.compareDateText}>{format(new Date(latestPhoto.created_at), 'MMM d')}</Text>
                    <Text style={styles.compareWeekText}>Week {currentWeek} · Today</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.comparisonCard} onPress={() => openModal(photos.length - 1)}>
                  <Image source={{ uri: firstPhoto.image_url }} style={styles.compareImage} />
                  <View style={styles.compareInfo}>
                    <Text style={styles.compareDateText}>{format(new Date(firstPhoto.created_at), 'MMM d')}</Text>
                    <Text style={styles.compareWeekText}>Week {firstPhoto.week_number}</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Metric cards */}
              <View style={styles.metricsRow}>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Inflammatory lesions</Text>
                  {latestPhoto.improvement_percentage != null ? (
                    <View style={styles.metricValueRow}>
                      <ArrowDownIcon size={14} color={Colors.success} />
                      <Text style={styles.metricValue}>
                        {` ${Math.abs(latestPhoto.improvement_percentage).toFixed(0)}%`}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.metricValue}>--</Text>
                  )}
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Redness score</Text>
                  {latestPhoto.severity_score != null ? (
                    <View style={styles.metricValueRow}>
                      <ArrowDownIcon size={14} color={Colors.success} />
                      <Text style={styles.metricValue}>
                        {` ${Math.max(0, Math.round((1 - latestPhoto.severity_score / (firstPhoto?.severity_score || 10)) * 100))}%`}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.metricValue}>--</Text>
                  )}
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Week Comparison</Text>
              <Text style={styles.placeholderText}>Log a second check-in to compare your progress over time.</Text>
            </View>
          )}

          {/* ── 3. SEVERITY CHART ────────────────────────────────────────── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Severity Over Time</Text>
            <Text style={styles.cardSubtitle}>Lower score = clearer skin</Text>
            <ProgressChart data={chartData} />
          </View>

        </ScrollView>
      )}

      {/* ── FULLSCREEN CALENDAR ─────────────────────────────────────────── */}
      <Modal visible={calendarFullscreen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setCalendarFullscreen(false)}>
        <View style={[styles.fullCalRoot, { paddingTop: insets.top }]}>
          <View style={styles.fullCalHeader}>
            <TouchableOpacity onPress={() => setCalendarFullscreen(false)} style={styles.fullCalBackBtn}>
              <ChevronLeftIcon size={28} color={Colors.primary} />
            </TouchableOpacity>
            <Text style={styles.fullCalTitle}>Progress</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.fullCalScroll}
            ref={(ref) => {
              if (ref) setTimeout(() => ref.scrollToEnd({ animated: false }), 50);
            }}
          >
            {(() => {
              const months: Date[] = [];
              for (let i = -11; i <= 0; i++) {
                months.push(addMonths(new Date(), i));
              }
              const tileSize = Math.floor((SCREEN_WIDTH - 6) / 7); // minimal gap
              return months.map(month => {
                const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
                const pad = Array(getDay(startOfMonth(month))).fill(null);
                return (
                  <View key={format(month, 'yyyy-MM')} style={styles.fullCalMonth}>
                    <Text style={styles.fullCalMonthTitle}>{format(month, 'MMMM yyyy')}</Text>
                    {/* Weekday headers */}
                    <View style={{ flexDirection: 'row' }}>
                      {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => (
                        <View key={d} style={{ width: tileSize, alignItems: 'center', paddingBottom: 6 }}>
                          <Text style={styles.fullCalDayHeader}>{d}</Text>
                        </View>
                      ))}
                    </View>
                    {/* Day grid */}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                      {pad.map((_, i) => <View key={`p-${i}`} style={{ width: tileSize, height: tileSize }} />)}
                      {days.map(day => {
                        const key = format(day, 'yyyy-MM-dd');
                        const dayPhotos = photosByDate[key] ?? [];
                        const photo = dayPhotos[0] ?? null;
                        const hasPhoto = !!photo;
                        const isToday = isSameDay(day, new Date());

                        return (
                          <TouchableOpacity
                            key={key}
                            style={{ width: tileSize, height: tileSize, padding: 1 }}
                            activeOpacity={hasPhoto ? 0.7 : 1}
                            onPress={() => {
                              if (!photo) return;
                              slideAnim.setValue(1);
                              setExpandPhoto(photo);
                              Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
                            }}
                          >
                            {hasPhoto ? (
                              <View style={styles.fullCalTile}>
                                <Image source={{ uri: photo.image_url }} style={styles.fullCalTileImage} />
                                <Text style={styles.fullCalTileDay}>{format(day, 'd')}</Text>
                              </View>
                            ) : (
                              <View style={[styles.fullCalEmptyTile, isToday && styles.fullCalTodayTile]}>
                                <Text style={[styles.fullCalEmptyDay, isToday && styles.fullCalTodayDay]}>
                                  {format(day, 'd')}
                                </Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              });
            })()}
          </ScrollView>

          {/* Photo detail slides up from bottom in fullscreen calendar */}
          <Modal
            visible={!!expandPhoto}
            animationType="none"
            transparent
            onRequestClose={() => {
              Animated.timing(slideAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start(() => setExpandPhoto(null));
            }}
          >
            {expandPhoto && (
              <Animated.View style={[styles.slideUpRoot, {
                transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 600] }) }],
              }]}>
                {/* Close button */}
                <TouchableOpacity style={styles.slideUpCloseBtn} onPress={() => {
                  Animated.timing(slideAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start(() => setExpandPhoto(null));
                }} activeOpacity={0.7}>
                  <ChevronDownIcon size={28} color={Colors.text} />
                </TouchableOpacity>

                {/* Swipeable photos */}
                {/* Swipeable — chronological (oldest first, swipe right = forward) */}
                <FlatList
                  data={[...photos].reverse()}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={p => p.id}
                  initialScrollIndex={Math.max(0, photos.length - 1 - photos.findIndex(p => p.id === expandPhoto.id))}
                  getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
                  onMomentumScrollEnd={e => {
                    const reversed = [...photos].reverse();
                    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                    if (reversed[idx]) setExpandPhoto(reversed[idx]);
                  }}
                  renderItem={({ item: photo }) => (
                    <ScrollView style={{ width: SCREEN_WIDTH }} showsVerticalScrollIndicator={false} bounces={false}>
                      <Image
                        source={{ uri: photo.image_url, width: SCREEN_WIDTH, height: SCREEN_WIDTH }}
                        style={{ width: SCREEN_WIDTH, aspectRatio: 1 }}
                        resizeMode="cover"
                      />
                      <View style={styles.expandInfo}>
                        <Text style={styles.expandDate}>
                          {format(new Date(photo.created_at), 'MMMM d, yyyy')}
                        </Text>
                        <Text style={styles.expandWeekLabel}>Week {photo.week_number}</Text>
                        {photo.analysis_notes ? (
                          <View style={styles.expandSection}>
                            <Text style={styles.expandSectionTitle}>AI Analysis</Text>
                            <View style={styles.expandAnalysisBox}>
                              <Text style={styles.expandAnalysisText}>{photo.analysis_notes}</Text>
                            </View>
                          </View>
                        ) : null}
                      </View>
                    </ScrollView>
                  )}
                />
              </Animated.View>
            )}
          </Modal>
        </View>
      </Modal>

      {/* ── DETAIL MODAL ──────────────────────────────────────────────────── */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {/* Modal header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalClose}>
              <CloseIcon size={14} color={Colors.textSecondary} />
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
                <ChevronLeftIcon size={24} color={Colors.primary} />
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
                <ChevronRightIcon size={24} color={Colors.primary} />
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
                <Image source={{ uri: photo.image_url }} style={styles.modalImage} resizeMode="cover" />

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
                  <View style={styles.modalInsightBox}>
                    <Text style={styles.modalInsightText}>{photo.analysis_notes}</Text>
                  </View>
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
                    <Text style={styles.saveNoteBtnText}>{savingNote ? 'Saving...' : 'Save Note'}</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          />
        </KeyboardAvoidingView>
      </Modal>

      {/* ── SWIPEABLE PHOTO DETAIL OVERLAY ──────────────────────────────── */}
      {expandPhoto && (
        <View style={styles.expandOverlay}>
          <Animated.View style={[styles.expandBackdrop, { opacity: expandAnim }]}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeExpand} />
          </Animated.View>
          <Animated.View
            style={[
              styles.expandCard,
              {
                opacity: expandAnim,
                transform: [
                  { translateY: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) },
                ],
              },
            ]}
          >
            {/* Close button */}
            <View style={styles.expandHeader}>
              <Text style={styles.expandCounter}>
                {photos.findIndex(p => p.id === expandPhoto.id) + 1} / {photos.length}
              </Text>
              <TouchableOpacity onPress={closeExpand} style={styles.expandCloseBtn}>
                <CloseIcon size={16} color={Colors.white} />
              </TouchableOpacity>
            </View>

            {/* Swipeable photos — chronological order (oldest first, swipe right = forward) */}
            <FlatList
              data={[...photos].reverse()}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={p => p.id}
              initialScrollIndex={Math.max(0, photos.length - 1 - photos.findIndex(p => p.id === expandPhoto.id))}
              getItemLayout={(_, index) => ({ length: SCREEN_WIDTH - Spacing.lg * 2, offset: (SCREEN_WIDTH - Spacing.lg * 2) * index, index })}
              onMomentumScrollEnd={e => {
                const reversed = [...photos].reverse();
                const idx = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_WIDTH - Spacing.lg * 2));
                if (reversed[idx]) setExpandPhoto(reversed[idx]);
              }}
              renderItem={({ item: photo }) => (
                <ScrollView
                  style={{ width: SCREEN_WIDTH - Spacing.lg * 2 }}
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                >
                  <Image
                    source={{ uri: photo.image_url, width: SCREEN_WIDTH, height: SCREEN_WIDTH }}
                    style={styles.expandImage}
                    resizeMode="cover"
                  />
                  <View style={styles.expandInfo}>
                    <Text style={styles.expandDate}>
                      {format(new Date(photo.created_at), 'MMMM d, yyyy')}
                    </Text>
                    <Text style={styles.expandWeekLabel}>Week {photo.week_number}</Text>
                    {photo.analysis_notes ? (
                      <View style={styles.expandSection}>
                        <Text style={styles.expandSectionTitle}>AI Analysis</Text>
                        <View style={styles.expandAnalysisBox}>
                          <Text style={styles.expandAnalysisText}>{photo.analysis_notes}</Text>
                        </View>
                      </View>
                    ) : null}
                    {photo.annotations && Object.values(photo.annotations).some(Boolean) && (
                      <View style={styles.expandSection}>
                        <Text style={styles.expandSectionTitle}>Zone Breakdown</Text>
                        {Object.entries(ZONE_LABELS).map(([zoneKey, label]) => {
                          const val = photo.annotations?.[zoneKey];
                          if (!val) return null;
                          return (
                            <View key={zoneKey} style={styles.zoneRow}>
                              <Text style={styles.zoneLabel}>{label}</Text>
                              <Text style={styles.zoneValue}>{val}</Text>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                </ScrollView>
              )}
            />
          </Animated.View>
        </View>
      )}
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

  // Header
  header: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.background,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { ...Typography.displayMedium, color: Colors.text },
  headerSubtitle: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: Spacing.xxs },
  logButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
    minHeight: 36,
    ...Shadows.sm,
  },
  logButtonText: { ...Typography.labelLarge, color: Colors.white },
  buttonDisabled: { opacity: 0.6 },

  // Empty / Loading
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xxl, gap: Spacing.lg },
  emptyIcon: { marginBottom: Spacing.xs },
  emptyTitle: { ...Typography.displaySmall, color: Colors.text, textAlign: 'center' },
  emptySubtitle: { ...Typography.bodyMedium, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
  startButton: {
    width: '80%',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.md,
  },
  startButtonText: { ...Typography.headlineSmall, color: Colors.white },

  // Scroll
  scrollContent: { padding: Spacing.xxl, gap: Spacing.lg, paddingBottom: 100 },

  // Cards
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    ...Shadows.sm,
    gap: Spacing.md,
  },
  cardTitle: { ...Typography.headlineSmall, color: Colors.text },
  cardSubtitle: { ...Typography.caption, color: Colors.textMuted, marginTop: -Spacing.sm },

  // Calendar
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  monthNavBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
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
  },
  dayCellCircle: {
    width: DAY_CELL * 0.78,
    height: DAY_CELL * 0.78,
    borderRadius: DAY_CELL * 0.39,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayCellLogged: {
    backgroundColor: Colors.primary,
  },
  dayCellToday: {
    backgroundColor: Colors.secondary,
  },
  dayCellTodayLogged: {
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.secondary,
  },
  dayCellNumber: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  dayCellThumb: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: DAY_CELL * 0.39,
  },
  dayCellNumberLogged: {
    color: Colors.white,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  dayCellNumberToday: {
    color: Colors.white,
    fontWeight: '700',
  },

  // Week Comparison Section
  sectionBlock: { gap: Spacing.md },
  sectionLabel: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  comparisonRow: { flexDirection: 'row', gap: Spacing.md },
  comparisonCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  compareImage: { width: '100%', aspectRatio: 1 },
  compareInfo: { padding: Spacing.md },
  compareDateText: { ...Typography.labelMedium, color: Colors.text },
  compareWeekText: { ...Typography.caption, color: Colors.textMuted, marginTop: Spacing.xxs },

  // Metric cards
  metricsRow: { flexDirection: 'row', gap: Spacing.md },
  metricCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  metricLabel: { ...Typography.caption, color: Colors.textSecondary, marginBottom: Spacing.xs },
  metricValueRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  metricValue: { ...Typography.headlineSmall, color: Colors.success, fontWeight: '700' },

  placeholderText: { ...Typography.bodySmall, color: Colors.textMuted },

  // Zone rows
  zoneRow: { flexDirection: 'row', gap: Spacing.md, paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  zoneLabel: { ...Typography.labelSmall, color: Colors.primary, width: 90 },
  zoneValue: { ...Typography.bodySmall, color: Colors.textSecondary, flex: 1 },

  // Modal
  modalRoot: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.white,
  },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.cardSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeaderTitle: { ...Typography.labelLarge, color: Colors.text, flex: 1, textAlign: 'center' },
  modalNav: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  modalNavBtn: { padding: 4 },
  modalNavBtnDisabled: { opacity: 0.3 },
  modalNavCount: { ...Typography.caption, color: Colors.textMuted, minWidth: 36, textAlign: 'center' },

  modalItemContent: { padding: Spacing.xl, gap: Spacing.lg, paddingBottom: 100 },
  modalImage: { width: '100%', aspectRatio: 1, borderRadius: BorderRadius.xl },
  modalBadgeRow: { flexDirection: 'row', gap: Spacing.sm },
  modalBadge: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.cardSubtle,
    gap: 2,
  },
  modalBadgeLabel: { ...Typography.caption, color: Colors.textMuted },
  modalBadgeValue: { ...Typography.headlineSmall, color: Colors.text },
  modalSection: { gap: Spacing.sm },
  modalSectionTitle: { ...Typography.headlineSmall, color: Colors.text },
  modalInsightBox: {
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    backgroundColor: Colors.cardSubtle,
  },
  modalInsightText: { ...Typography.bodySmall, color: Colors.textSecondary, lineHeight: 20 },

  notesInput: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    minHeight: 100,
    ...Typography.bodyMedium,
    color: Colors.text,
    textAlignVertical: 'top',
    backgroundColor: Colors.white,
  },
  saveNoteBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  saveNoteBtnText: { ...Typography.labelLarge, color: Colors.white },

  // Slide-up photo detail (fullscreen calendar)
  slideUpRoot: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '75%',
    backgroundColor: Colors.background,
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    overflow: 'hidden',
    ...Shadows.xl,
  },
  slideUpCloseBtn: {
    alignSelf: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.xl,
  },

  // Fullscreen calendar
  fullCalRoot: { flex: 1, backgroundColor: Colors.background },
  fullCalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  fullCalBackBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  fullCalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  fullCalScroll: { paddingBottom: 60 },
  fullCalMonth: { marginTop: Spacing.xl, paddingHorizontal: 3 },
  fullCalMonthTitle: { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: Spacing.sm, paddingHorizontal: Spacing.sm },
  fullCalDayHeader: { fontSize: 10, fontWeight: '600', color: Colors.textMuted, letterSpacing: 0.5 },
  fullCalTile: {
    flex: 1,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  fullCalTileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
  },
  fullCalTileDay: {
    position: 'absolute',
    bottom: 3,
    left: 5,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  fullCalEmptyTile: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 3,
    paddingLeft: 5,
  },
  fullCalTodayTile: {},
  fullCalEmptyDay: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textMuted,
  },
  fullCalTodayDay: {
    color: Colors.secondary,
    fontWeight: '800',
  },

  // Expand overlay
  expandOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  expandCard: {
    width: SCREEN_WIDTH - Spacing.lg * 2,
    maxHeight: '90%',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xxl,
    overflow: 'hidden',
    ...Shadows.xl,
  },
  expandImage: {
    width: '100%',
    aspectRatio: 1,
  },
  expandHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 10,
  },
  expandCounter: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.pill,
  },
  expandCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandInfo: {
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  expandDate: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  expandWeekLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  expandBadgeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  expandBadge: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    gap: 2,
  },
  expandBadgeLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  expandBadgeValue: {
    ...Typography.headlineSmall,
    color: Colors.text,
  },
  expandSection: {
    gap: Spacing.sm,
  },
  expandSectionTitle: {
    ...Typography.headlineSmall,
    color: Colors.text,
  },
  expandAnalysisBox: {
    backgroundColor: Colors.cardSubtle,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
  },
  expandAnalysisText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  expandNotesText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});
