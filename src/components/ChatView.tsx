/**
 * ChatView.tsx
 *
 * A chat-style interface where users can type messages and see responses from
 * the MCP server displayed in conversation bubbles.
 */

import React, { useEffect, useRef, useState } from 'react';
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
          <Text style={styles.sendButtonText}>Send</Text>
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

  return (
    <View style={[styles.bubbleWrapper, isUser ? styles.bubbleRight : styles.bubbleLeft]}>
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : isError ? styles.bubbleError : styles.bubbleAssistant,
        ]}
      >
        <Text
          style={[
            styles.bubbleText,
            isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant,
          ]}
        >
          {message.content}
        </Text>
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
    paddingHorizontal: 18,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#93c5fd',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
