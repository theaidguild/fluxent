/**
 * ChatView.tsx
 *
 * A chat-style interface where users can type messages and see responses from
 * the MCP server displayed in conversation bubbles.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { Ionicons } from '@expo/vector-icons';

import { MCPMessage } from '../hooks/useMCPClient';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChatViewProps {
  messages: MCPMessage[];
  isConnected: boolean;
  isProcessing: boolean;
  onSend: (text: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChatView({ messages, isConnected, isProcessing, onSend }: ChatViewProps) {
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
          <Text style={styles.emptyText}>
            {isConnected
              ? 'Connected! Type a message to interact with the MCP server.'
              : 'Connect to an MCP server in the Settings tab to get started.'}
          </Text>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}
        {isProcessing && (
          <View style={[styles.bubbleWrapper, styles.bubbleLeft]}>
            <View style={[styles.bubble, styles.bubbleAssistant]}>
              <Text style={styles.bubbleTextAssistant}>Thinking…</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input row */}
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.textInput, !isConnected && styles.textInputDisabled]}
          value={input}
          onChangeText={setInput}
          placeholder={isConnected ? 'Type a message…' : 'Connect to a server first'}
          placeholderTextColor="#aaa"
          editable={isConnected}
          multiline
          maxLength={2000}
          returnKeyType="send"
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
          testID="chat-input"
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

function MessageBubble({ message }: { message: MCPMessage }) {
  const isUser = message.role === 'user';
  const isError = message.role === 'error';

  const mdStyle = useMemo(
    () =>
      isUser ? markdownUserStyles : markdownAssistantStyles,
    [isUser],
  );

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
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 16,
    paddingBottom: 8,
    flexGrow: 1,
  },
  emptyText: {
    flex: 1,
    textAlign: 'center',
    color: '#888',
    fontSize: 15,
    marginTop: 60,
    paddingHorizontal: 20,
    lineHeight: 22,
  },

  // Bubble layout
  bubbleWrapper: {
    marginVertical: 4,
    maxWidth: '80%',
  },
  bubbleRight: {
    alignSelf: 'flex-end',
  },
  bubbleLeft: {
    alignSelf: 'flex-start',
  },
  bubble: {
    borderRadius: 16,
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
    borderWidth: 1,
    borderColor: '#e5e7eb',
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
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'right',
  },
  timestampAssistant: {
    color: '#aaa',
  },

  // Input row
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  textInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#f9fafb',
    color: '#1a1a1a',
    marginRight: 8,
  },
  textInputDisabled: {
    backgroundColor: '#f3f4f6',
    color: '#9ca3af',
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
