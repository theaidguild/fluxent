/**
 * ChatView.tsx
 *
 * A chat-style interface where users can type messages and see responses from
 * the MCP server displayed in conversation bubbles.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Markdown from 'react-native-markdown-display';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { MCPMessage, MCPTool } from '../hooks/useMCPClient';
import { ToolMentionInput } from './ToolMentionInput';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChatViewProps {
  messages: MCPMessage[];
  isConnected: boolean;
  isProcessing: boolean;
  isStreaming: boolean;
  tools: MCPTool[];
  onSend: (text: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChatView({ messages, isConnected, isProcessing, isStreaming, tools, onSend }: ChatViewProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  // Scroll to the bottom whenever a new message arrives
  useEffect(() => {
    if (messages.length > 0) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput('');
    onSend(trimmed);
  };

  return (
    <LinearGradient
      colors={['#4c1d95', '#1e1b4b', '#0f172a']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Message list */}
        <ScrollView
        ref={scrollRef}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
        keyboardShouldPersistTaps="handled"
        testID="message-scroll-view"
      >
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name={isConnected ? 'chatbubbles-outline' : 'cloud-offline-outline'}
              size={52}
              color="#d1d5db"
            />
            <Text style={styles.emptyText}>
              {isConnected
                ? t('chat.connected')
                : t('chat.notConnected')}
            </Text>
          </View>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}
        {isProcessing && !isStreaming && <ThinkingIndicator />}
      </ScrollView>

        {/* Input row */}
        <View style={styles.inputRow}>
        <ToolMentionInput
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSend}
          tools={tools}
          editable={isConnected}
          placeholder={isConnected ? t('chat.typeMessage') : t('chat.connectionRequired')}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!isConnected || !input.trim() || isProcessing) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!isConnected || !input.trim() || isProcessing}
          testID="send-button"
        >
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

// ---------------------------------------------------------------------------
// MessageBubble sub-component
// ---------------------------------------------------------------------------

/** Detect tool-call inline messages (e.g. "🔧 Calling tool: **foo**") */
const TOOL_CALL_PREFIX = '🔧 Calling tool:';

function MessageBubble({ message }: { message: MCPMessage }) {
  const isUser = message.role === 'user';
  const isError = message.role === 'error';
  const isToolCall =
    !isUser && !isError && message.content.startsWith(TOOL_CALL_PREFIX);

  const mdStyle = useMemo(
    () =>
      isUser ? markdownUserStyles : markdownAssistantStyles,
    [isUser],
  );

  if (isToolCall) {
    // Extract the tool name from the message content
    const toolName = message.content
      .replace(TOOL_CALL_PREFIX, '')
      .replace(/\*\*/g, '')
      .trim();
    return (
      <View style={styles.toolCallRow}>
        <Ionicons name="hammer-outline" size={13} color="#6366f1" />
        <Text style={styles.toolCallText}>
          {toolName}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleWrapper, isUser ? styles.bubbleRight : styles.bubbleLeft]}>
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : isError ? styles.bubbleError : styles.bubbleAssistant,
        ]}
      >
        {isUser || isError ? (
          <Text
            style={[
              styles.bubbleText,
              isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant,
            ]}
          >
            {message.content}
          </Text>
        ) : (
          <Markdown style={mdStyle}>{message.content}</Markdown>
        )}
        <Text style={[styles.timestamp, isUser ? styles.timestampUser : styles.timestampAssistant]}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// ThinkingIndicator – three animated dots
// ---------------------------------------------------------------------------

const DOT_DELAY_MS = 160;
const DOT_ANIMATION_DURATION = 320;

function ThinkingIndicator() {
  const dot0 = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const dots = [dot0, dot1, dot2];
    const anims = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * DOT_DELAY_MS),
          Animated.timing(dot, {
            toValue: 1,
            duration: DOT_ANIMATION_DURATION,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: DOT_ANIMATION_DURATION,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.delay((dots.length - 1 - i) * DOT_DELAY_MS),
        ]),
      ),
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [dot0, dot1, dot2]);

  const dots = [dot0, dot1, dot2];

  return (
    <View style={[styles.bubbleWrapper, styles.bubbleLeft]}>
      <View style={[styles.bubble, styles.bubbleAssistant, styles.thinkingBubble]}>
        {dots.map((dot, i) => (
          <Animated.View
            key={i}
            style={[
              styles.thinkingDot,
              {
                opacity: dot,
                transform: [
                  {
                    translateY: dot.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -4],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 16,
    paddingBottom: 8,
    flexGrow: 1,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
    paddingHorizontal: 32,
  },
  emptyText: {
    textAlign: 'center',
    color: '#d1d5db',
    fontSize: 15,
    marginTop: 14,
    lineHeight: 22,
  },

  // Bubble layout
  bubbleWrapper: {
    marginVertical: 3,
    maxWidth: '80%',
  },
  bubbleRight: {
    alignSelf: 'flex-end',
  },
  bubbleLeft: {
    alignSelf: 'flex-start',
  },
  bubble: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bubbleUser: {
    backgroundColor: 'rgba(139, 92, 246, 0.85)',
    borderBottomRightRadius: 6,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bubbleAssistant: {
    backgroundColor: 'rgba(55, 48, 107, 0.6)',
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  bubbleError: {
    backgroundColor: 'rgba(127, 29, 29, 0.7)',
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
  },
  bubbleTextUser: {
    color: '#ffffff',
  },
  bubbleTextAssistant: {
    color: '#e5e7eb',
  },
  timestamp: {
    fontSize: 10,
    marginTop: 5,
  },
  timestampUser: {
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'right',
  },
  timestampAssistant: {
    color: 'rgba(255,255,255,0.4)',
  },

  // Tool call row
  toolCallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginVertical: 3,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.4)',
  },
  toolCallText: {
    fontSize: 12,
    color: '#c4b5fd',
    fontWeight: '600',
    marginLeft: 5,
  },

  // Thinking indicator
  thinkingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  thinkingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#a78bfa',
    marginHorizontal: 3,
  },

  // Input row
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: 'rgba(30, 27, 75, 0.8)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(139, 92, 246, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'visible' as const,
    zIndex: 10,
  },
  sendButton: {
    backgroundColor: '#8b5cf6',
    borderRadius: 22,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 3,
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(139, 92, 246, 0.4)',
  },
});

// ---------------------------------------------------------------------------
// Markdown styles for assistant messages
// ---------------------------------------------------------------------------

const markdownAssistantStyles = StyleSheet.create({
  body: { color: '#e5e7eb', fontSize: 15, lineHeight: 22 },
  paragraph: { marginTop: 0, marginBottom: 8 },
  heading1: { fontSize: 22, fontWeight: '700', color: '#ffffff', marginBottom: 8, marginTop: 10 },
  heading2: { fontSize: 19, fontWeight: '700', color: '#f3f4f6', marginBottom: 6, marginTop: 8 },
  heading3: { fontSize: 17, fontWeight: '600', color: '#f3f4f6', marginBottom: 6, marginTop: 8 },
  strong: { fontWeight: '700', color: '#ffffff' },
  em: { fontStyle: 'italic' },
  link: { color: '#c4b5fd', textDecorationLine: 'underline' },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: '#8b5cf6',
    paddingLeft: 10,
    marginVertical: 6,
  },
  code_inline: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    color: '#fbbf24',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  fence: {
    backgroundColor: 'rgba(30, 27, 75, 0.5)',
    borderRadius: 8,
    padding: 10,
    marginVertical: 6,
  },
  code_block: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    color: '#d1d5db',
  },
  list_item: { marginBottom: 4 },
  bullet_list: { marginVertical: 4 },
  ordered_list: { marginVertical: 4 },
  hr: { backgroundColor: 'rgba(139, 92, 246, 0.3)', height: 1, marginVertical: 8 },
  table: { borderWidth: 1, borderColor: 'rgba(139, 92, 246, 0.3)', borderRadius: 4, marginVertical: 6 },
  thead: { backgroundColor: 'rgba(139, 92, 246, 0.2)' },
  th: { padding: 6, fontWeight: '600', color: '#ffffff' },
  td: { padding: 6, color: '#e5e7eb' },
  tr: { borderBottomWidth: 1, borderColor: 'rgba(139, 92, 246, 0.2)' },
});

// ---------------------------------------------------------------------------
// Markdown styles for user messages (white text on blue)
// ---------------------------------------------------------------------------

const markdownUserStyles = StyleSheet.create({
  body: { color: '#fff', fontSize: 15, lineHeight: 22 },
  paragraph: { marginTop: 0, marginBottom: 6 },
  strong: { fontWeight: '700', color: '#fff' },
  em: { fontStyle: 'italic' },
  link: { color: '#bfdbfe', textDecorationLine: 'underline' },
  code_inline: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  fence: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
    padding: 10,
    marginVertical: 6,
  },
  code_block: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    color: '#fff',
  },
});
