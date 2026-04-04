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
} from 'react-native';
import Svg, { Path, Line, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
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

export default function CoachScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    })();
  }, []);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending || !userId) return;

    const userMsg: Message = { role: 'user', content: text };
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
          message: text,
          history: messages.slice(-10),
        }),
      });

      const rawText = await res.text();
      let reply: string;
      try {
        const parsed = JSON.parse(rawText);
        reply = parsed?.reply || `Debug: status=${res.status} body=${rawText.substring(0, 200)}`;
      } catch {
        reply = `Debug: status=${res.status} body=${rawText.substring(0, 200)}`;
      }

      const assistantMsg: Message = { role: 'assistant', content: reply };
      setMessages([...newMessages, assistantMsg]);
    } catch (err: any) {
      const errorMsg: Message = { role: 'assistant', content: `Catch error: ${err?.message || String(err)}` };
      setMessages([...newMessages, errorMsg]);
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

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
        {/* Welcome message */}
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
                'Is my cleanser right for me?',
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
          onSubmitEditing={sendMessage}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
          onPress={sendMessage}
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

  /* Messages */
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },

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

  /* Message bubbles */
  messageBubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  assistantRow: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '78%',
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
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: Colors.white,
  },
  assistantText: {
    color: Colors.text,
  },

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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
});
