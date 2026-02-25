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
import Markdown from 'react-native-markdown-display';
import { Ionicons } from '@expo/vector-icons';

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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
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
                ? 'Connected! Type a message to interact with the MCP server.'
                : 'Connect to an MCP server in the Settings tab to get started.'}
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
          placeholder={isConnected ? 'Type a message…' : 'Connect to a server first'}
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
    backgroundColor: '#f5f6fa',
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
    color: '#9ca3af',
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
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: '#2563eb',
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 1,
  },
  bubbleError: {
    backgroundColor: '#fef2f2',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
  },
  bubbleTextUser: {
    color: '#fff',
  },
  bubbleTextAssistant: {
    color: '#1a1a1a',
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
  },
  timestampUser: {
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'right',
  },
  timestampAssistant: {
    color: '#c0c4cc',
  },

  // Tool call row
  toolCallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginVertical: 3,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#f5f3ff',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd6fe',
  },
  toolCallText: {
    fontSize: 12,
    color: '#6366f1',
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
    backgroundColor: '#9ca3af',
    marginHorizontal: 3,
  },

  // Input row
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'visible' as const,
    zIndex: 10,
  },
  sendButton: {
    backgroundColor: '#2563eb',
    borderRadius: 20,
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#93c5fd',
  },
});

// ---------------------------------------------------------------------------
// Markdown styles for assistant messages
// ---------------------------------------------------------------------------

const markdownAssistantStyles = StyleSheet.create({
  body: { color: '#1a1a1a', fontSize: 15, lineHeight: 22 },
  paragraph: { marginTop: 0, marginBottom: 6 },
  heading1: { fontSize: 22, fontWeight: '700', color: '#1a1a1a', marginBottom: 6, marginTop: 8 },
  heading2: { fontSize: 19, fontWeight: '700', color: '#1a1a1a', marginBottom: 4, marginTop: 6 },
  heading3: { fontSize: 17, fontWeight: '600', color: '#1a1a1a', marginBottom: 4, marginTop: 6 },
  strong: { fontWeight: '700' },
  em: { fontStyle: 'italic' },
  link: { color: '#2563eb', textDecorationLine: 'underline' },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: '#d1d5db',
    paddingLeft: 10,
    marginVertical: 6,
  },
  code_inline: {
    backgroundColor: '#f3f4f6',
    color: '#e11d48',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  fence: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 10,
    marginVertical: 6,
  },
  code_block: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    color: '#1a1a1a',
  },
  list_item: { marginBottom: 4 },
  bullet_list: { marginVertical: 4 },
  ordered_list: { marginVertical: 4 },
  hr: { backgroundColor: '#d1d5db', height: 1, marginVertical: 8 },
  table: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 4, marginVertical: 6 },
  thead: { backgroundColor: '#f3f4f6' },
  th: { padding: 6, fontWeight: '600' },
  td: { padding: 6 },
  tr: { borderBottomWidth: 1, borderColor: '#e5e7eb' },
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
