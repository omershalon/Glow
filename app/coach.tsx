import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  ActionSheetIOS,
  Alert,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Path, Line, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';

// expo-speech-recognition requires a custom dev build — not available in Expo Go.
// Fall back to no-ops so the rest of the app still works.
let ExpoSpeechRecognitionModule: any = null;
let useSpeechRecognitionEvent: (event: string, handler: (...args: any[]) => void) => void = () => {};
try {
  const mod = require('expo-speech-recognition');
  ExpoSpeechRecognitionModule = mod.ExpoSpeechRecognitionModule;
  useSpeechRecognitionEvent = mod.useSpeechRecognitionEvent;
} catch (_) {}
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '@/lib/theme';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

/* ── Icons ── */
function CloseIcon({ size = 24, color = Colors.text }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1={18} y1={6} x2={6} y2={18} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={6} y1={6} x2={18} y2={18} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function SendIcon({ size = 22, color = Colors.white }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M22 2L11 13" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M22 2L15 22L11 13L2 9L22 2Z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function MicIcon({ size = 28, color = Colors.white }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke={color} strokeWidth={2} />
      <Path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={12} y1={19} x2={12} y2={23} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={8} y1={23} x2={16} y2={23} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function CoachAvatar({ size = 36 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={8} r={4} stroke={Colors.white} strokeWidth={2} />
        <Path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke={Colors.white} strokeWidth={2} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

/* ── Pulsing ring for voice mode ── */
function PulsingRing({ active }: { active: boolean }) {
  const pulse1 = useRef(new Animated.Value(1)).current;
  const pulse2 = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (active) {
      const animate = (val: Animated.Value, delay: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(val, { toValue: 1.6, duration: 1200, useNativeDriver: true }),
            Animated.timing(val, { toValue: 1, duration: 1200, useNativeDriver: true }),
          ])
        );
      animate(pulse1, 0).start();
      animate(pulse2, 600).start();
    } else {
      pulse1.setValue(1);
      pulse2.setValue(1);
    }
  }, [active]);

  if (!active) return null;
  return (
    <>
      <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulse1 }], opacity: pulse1.interpolate({ inputRange: [1, 1.6], outputRange: [0.3, 0] }) }]} />
      <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulse2 }], opacity: pulse2.interpolate({ inputRange: [1, 1.6], outputRange: [0.2, 0] }) }]} />
    </>
  );
}

export default function CoachScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [attachments, setAttachments] = useState<{ uri: string; base64?: string }[]>([]);

  const handlePlusPress = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Upload Photos & Files'],
          cancelButtonIndex: 0,
        },
        async (buttonIndex) => {
          if (buttonIndex === 1) await pickFromCamera();
          if (buttonIndex === 2) await pickFromLibrary();
        }
      );
    } else {
      Alert.alert('Add Attachment', '', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Photo', onPress: pickFromCamera },
        { text: 'Upload Photos & Files', onPress: pickFromLibrary },
      ]);
    }
  };

  const pickFromCamera = async () => {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setAttachments(prev => [...prev, { uri: result.assets[0].uri, base64: result.assets[0].base64 ?? undefined }]);
    }
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets.length > 0) {
      setAttachments(prev => [...prev, ...result.assets.map(a => ({ uri: a.uri, base64: a.base64 ?? undefined }))]);
    }
  };

  // Speech recognition events
  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results[0]?.transcript || '';
    setTranscript(text);
  });

  useSpeechRecognitionEvent('end', () => {
    setListening(false);
    // Auto-send when speech stops
    if (transcript.trim()) {
      sendMessage(transcript.trim());
      setTranscript('');
    }
  });

  useSpeechRecognitionEvent('error', () => {
    setListening(false);
  });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    })();
    return () => { Speech.stop(); };
  }, []);

  const startListening = async () => {
    if (!ExpoSpeechRecognitionModule) {
      Alert.alert('Not available', 'Voice input requires a development build and is not supported in Expo Go.');
      return;
    }
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) return;

    stopSpeaking();
    setTranscript('');
    setListening(true);

    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
    });
  };

  const stopListening = () => {
    if (!ExpoSpeechRecognitionModule) return;
    ExpoSpeechRecognitionModule.stop();
    setListening(false);
  };

  const speakResponse = (text: string) => {
    setSpeaking(true);
    Speech.speak(text, {
      language: 'en-US',
      pitch: 1.0,
      rate: 0.95,
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  const stopSpeaking = () => {
    Speech.stop();
    setSpeaking(false);
  };

  const sendMessage = async (text?: string) => {
    const msgText = (text || input).trim();
    if (!msgText || sending || !userId) return;

    const userMsg: Message = { role: 'user', content: msgText };
    const newMessages = [...messages, userMsg];
    const currentAttachments = [...attachments];
    setMessages(newMessages);
    setInput('');
    setAttachments([]);
    setSending(true);

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
      const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

      const res = await fetch(`${supabaseUrl}/functions/v1/chat-skin-coach`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          user_id: userId,
          message: msgText,
          history: messages.slice(-10),
          images: currentAttachments.map(a => a.base64).filter(Boolean),
        }),
      });

      const rawText = await res.text();
      let reply: string;
      try {
        const parsed = JSON.parse(rawText);
        reply = parsed?.reply || 'I couldn\'t process that. Try again.';
      } catch {
        reply = 'Something went wrong. Please try again.';
      }

      const assistantMsg: Message = { role: 'assistant', content: reply };
      setMessages([...newMessages, assistantMsg]);

      // In voice mode, read the response aloud
      if (voiceMode) {
        speakResponse(reply);
      }
    } catch (err: any) {
      const errorMsg: Message = { role: 'assistant', content: 'Connection error. Please check your internet and try again.' };
      setMessages([...newMessages, errorMsg]);
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  // Voice mode view
  if (voiceMode) {
    return (
      <View style={[styles.voiceContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Header */}
        <View style={styles.voiceHeader}>
          <TouchableOpacity onPress={() => { stopSpeaking(); setVoiceMode(false); }} style={styles.closeBtn}>
            <CloseIcon size={22} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.voiceHeaderTitle}>Skin Coach</Text>
          <View style={styles.closeBtn} />
        </View>

        {/* Center — mic icon + status */}
        <View style={styles.voiceCenter}>
          <View style={styles.voiceAvatarWrap}>
            <PulsingRing active={speaking || sending || listening} />
            <TouchableOpacity
              style={[styles.micButton, listening && styles.micButtonActive, { width: 80, height: 80, borderRadius: 40 }]}
              activeOpacity={0.8}
              onPress={listening ? stopListening : startListening}
            >
              <MicIcon size={36} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.voiceStatus}>
            {sending ? 'Thinking...' : speaking ? 'Speaking...' : listening ? 'Listening...' : 'Tap to speak'}
          </Text>
          {/* Last message preview */}
          {messages.length > 0 && (
            <Text style={styles.voiceLastMsg} numberOfLines={3}>
              {messages[messages.length - 1].content}
            </Text>
          )}
        </View>

        <View style={styles.voiceBottom}>
          {speaking && (
            <TouchableOpacity style={styles.stopBtn} onPress={stopSpeaking} activeOpacity={0.8}>
              <Text style={styles.stopBtnText}>Stop</Text>
            </TouchableOpacity>
          )}
          {transcript.length > 0 && (
            <Text style={styles.transcriptPreview}>"{transcript}"</Text>
          )}
        </View>
      </View>
    );
  }

  // Text chat view
  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <CloseIcon size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <CoachAvatar size={32} />
          <View>
            <Text style={styles.headerTitle}>Skin Coach</Text>
            <Text style={styles.headerSubtitle}>AI skincare assistant</Text>
          </View>
        </View>
        <View style={styles.closeBtn} />
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {messages.length === 0 && (
          <View style={styles.welcomeContainer}>
            <CoachAvatar size={56} />
            <Text style={styles.welcomeTitle}>Hey! I'm your Skin Coach</Text>
            <Text style={styles.welcomeSubtext}>
              Ask me anything about skincare, acne, your routine, or product recommendations. I know your skin profile and can give personalized advice.
            </Text>
            <View style={styles.suggestionsContainer}>
              {[
                'What should my morning routine be?',
                'Why am I breaking out on my chin?',
                'What natural ingredients help acne?',
                'What foods should I avoid?',
              ].map((suggestion) => (
                <TouchableOpacity
                  key={suggestion}
                  style={styles.suggestionChip}
                  activeOpacity={0.7}
                  onPress={() => { setInput(suggestion); }}
                >
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>

          </View>
        )}

        {messages.map((msg, i) => (
          <View
            key={i}
            style={[
              styles.messageBubbleRow,
              msg.role === 'user' ? styles.userRow : styles.assistantRow,
            ]}
          >
            {msg.role === 'assistant' && <CoachAvatar size={28} />}
            <View style={[
              styles.messageBubble,
              msg.role === 'user' ? styles.userBubble : styles.assistantBubble,
            ]}>
              <Text style={[
                styles.messageText,
                msg.role === 'user' ? styles.userText : styles.assistantText,
              ]}>
                {msg.content}
              </Text>
            </View>
            {/* Tap to hear assistant messages */}
            {msg.role === 'assistant' && (
              <TouchableOpacity onPress={() => speakResponse(msg.content)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={{ fontSize: 16, color: Colors.textMuted }}>{'\u{1F50A}'}</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        {sending && (
          <View style={[styles.messageBubbleRow, styles.assistantRow]}>
            <CoachAvatar size={28} />
            <View style={[styles.messageBubble, styles.assistantBubble, styles.typingBubble]}>
              <ActivityIndicator size="small" color={Colors.textMuted} />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Attachment previews */}
      {attachments.length > 0 && (
        <View style={styles.attachmentRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm, paddingHorizontal: Spacing.lg }}>
            {attachments.map((att, i) => (
              <View key={i} style={styles.attachmentThumb}>
                <Image source={{ uri: att.uri }} style={styles.attachmentImage} />
                <TouchableOpacity
                  style={styles.attachmentRemove}
                  onPress={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                >
                  <Text style={styles.attachmentRemoveText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Input */}
      <View style={[styles.inputContainer, { paddingBottom: insets.bottom + Spacing.sm }]}>
        <TouchableOpacity style={styles.plusBtn} activeOpacity={0.7} onPress={handlePlusPress}>
          <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
            <Line x1={9} y1={2} x2={9} y2={16} stroke={Colors.white} strokeWidth={2} strokeLinecap="round" />
            <Line x1={2} y1={9} x2={16} y2={9} stroke={Colors.white} strokeWidth={2} strokeLinecap="round" />
          </Svg>
        </TouchableOpacity>
        <View style={styles.textInputWrapper}>
          <TextInput
            style={styles.textInput}
            placeholder="Ask about your skin"
            placeholderTextColor={Colors.textMuted}
            value={input}
            onChangeText={setInput}
            maxLength={500}
            onSubmitEditing={() => sendMessage()}
            returnKeyType="send"
          />
          {!input.trim() && (
            <TouchableOpacity
              style={styles.micBtn}
              onPress={() => setVoiceMode(true)}
              activeOpacity={0.8}
            >
              <MicIcon size={18} color={Colors.primary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
          onPress={() => sendMessage()}
          disabled={!input.trim() || sending}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[Colors.primaryLight, Colors.primary]}
            style={styles.sendBtnGradient}
          >
            <SendIcon size={18} color={Colors.white} />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  closeBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  voiceModeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Messages */
  messageList: { flex: 1 },
  messageListContent: { padding: Spacing.lg, gap: Spacing.md },

  /* Welcome */
  welcomeContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    gap: Spacing.md,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginTop: Spacing.sm,
  },
  welcomeSubtext: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.xl,
  },
  suggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  suggestionChip: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  suggestionText: {
    ...Typography.bodySmall,
    color: Colors.text,
  },
  voiceCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.pill,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: Spacing.lg,
  },
  voiceCtaText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },

  /* Message bubbles */
  messageBubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  userRow: { justifyContent: 'flex-end' },
  assistantRow: { justifyContent: 'flex-start' },
  messageBubble: {
    maxWidth: '72%',
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  userBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: Colors.card,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typingBubble: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xxl,
  },
  messageText: { fontSize: 15, lineHeight: 22 },
  userText: { color: Colors.white },
  assistantText: { color: Colors.text },

  /* Attachments */
  attachmentRow: {
    backgroundColor: Colors.card,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  attachmentThumb: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  attachmentImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  attachmentRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentRemoveText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 16,
  },

  /* Input */
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.sm,
  },
  textInput: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: 0,
    paddingBottom: 0,
    height: 40,
    ...Typography.bodyMedium,
    color: Colors.text,
    maxHeight: 100,
  },
  plusBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.cardGlass,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xl,
    height: 40,
  },
  micBtn: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 4,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 2,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnGradient: { flex: 1, width: '100%', height: '100%', borderRadius: 20, justifyContent: 'center', alignItems: 'center' },

  /* ═══ Voice Mode ═══ */
  voiceContainer: {
    flex: 1,
    backgroundColor: '#1C1C1A',
  },
  voiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  voiceHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
  },
  voiceCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  voiceAvatarWrap: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 160,
    height: 160,
  },
  voiceStatus: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginTop: -8,
  },
  voiceLastMsg: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
    marginTop: 8,
  },
  pulseRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: '#4CAF87',
  },
  voiceBottom: {
    alignItems: 'center',
    paddingBottom: 40,
    gap: 12,
  },
  micButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.lg,
  },
  micButtonActive: {
    backgroundColor: '#C8573E',
  },
  micHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
  },
  transcriptPreview: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    paddingHorizontal: 30,
    fontStyle: 'italic',
    marginTop: 4,
  },
  stopBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  stopBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
});
