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
} from 'react-native';
import Svg, { Path, Line, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
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
    setMessages(newMessages);
    setInput('');
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
          <TouchableOpacity onPress={() => { stopSpeaking(); setVoiceMode(false); }} style={styles.closeBtn}>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600' }}>Text</Text>
          </TouchableOpacity>
        </View>

        {/* Center — avatar + status */}
        <View style={styles.voiceCenter}>
          <View style={styles.voiceAvatarWrap}>
            <PulsingRing active={speaking || sending || listening} />
            <CoachAvatar size={80} />
          </View>
          <Text style={styles.voiceStatus}>
            {sending ? 'Thinking...' : speaking ? 'Speaking...' : listening ? 'Listening...' : 'Tap the mic to talk'}
          </Text>
          {/* Last message preview */}
          {messages.length > 0 && (
            <Text style={styles.voiceLastMsg} numberOfLines={3}>
              {messages[messages.length - 1].content}
            </Text>
          )}
        </View>

        {/* Mic button */}
        <View style={styles.voiceBottom}>
          {speaking && (
            <TouchableOpacity style={styles.stopBtn} onPress={stopSpeaking} activeOpacity={0.8}>
              <Text style={styles.stopBtnText}>Stop</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.micButton, listening && styles.micButtonActive]}
            activeOpacity={0.8}
            onPress={listening ? stopListening : startListening}
          >
            <MicIcon size={32} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.micHint}>
            {listening ? 'Listening... tap to stop' : 'Tap to speak'}
          </Text>
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
        <TouchableOpacity onPress={() => setVoiceMode(true)} style={styles.voiceModeBtn}>
          <MicIcon size={18} color={Colors.primary} />
        </TouchableOpacity>
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

            {/* Voice mode CTA */}
            <TouchableOpacity style={styles.voiceCta} onPress={() => setVoiceMode(true)} activeOpacity={0.85}>
              <MicIcon size={18} color={Colors.white} />
              <Text style={styles.voiceCtaText}>Talk to your Skin Coach</Text>
            </TouchableOpacity>
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

      {/* Input */}
      <View style={[styles.inputContainer, { paddingBottom: insets.bottom + Spacing.sm }]}>
        <TextInput
          style={styles.textInput}
          placeholder="Ask about your skin..."
          placeholderTextColor={Colors.textMuted}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={500}
          onSubmitEditing={() => sendMessage()}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
          onPress={() => sendMessage()}
          disabled={!input.trim() || sending}
          activeOpacity={0.8}
        >
          <SendIcon size={18} color={Colors.white} />
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
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
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
    backgroundColor: '#E8F5E9',
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
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderWidth: 1,
    borderColor: Colors.borderLight,
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
    backgroundColor: Colors.white,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  typingBubble: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xxl,
  },
  messageText: { fontSize: 15, lineHeight: 22 },
  userText: { color: Colors.white },
  assistantText: { color: Colors.text },

  /* Input */
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    gap: Spacing.sm,
  },
  textInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    ...Typography.bodyMedium,
    color: Colors.text,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 2,
  },
  sendBtnDisabled: { opacity: 0.4 },

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
    backgroundColor: '#2D4A3E',
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
