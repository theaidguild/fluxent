/**
 * SettingsView.tsx
 *
 * A simple settings screen that lets the user enter the remote MCP server URL
 * and connect / disconnect.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { MCPTool } from '../hooks/useMCPClient';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SettingsViewProps {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  errorMessage: string | null;
  tools: MCPTool[];
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  onConnect: (url: string) => void;
  onDisconnect: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SettingsView({
  status,
  errorMessage,
  tools,
  apiKey,
  onApiKeyChange,
  onConnect,
  onDisconnect,
}: SettingsViewProps) {
  const [url, setUrl] = useState('http://127.0.0.1:7788/mcp');
  const [showApiKey, setShowApiKey] = useState(false);

  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';

  const statusColor: Record<SettingsViewProps['status'], string> = {
    disconnected: '#888',
    connecting: '#f5a623',
    connected: '#4caf50',
    error: '#f44336',
  };

  const statusLabel: Record<SettingsViewProps['status'], string> = {
    disconnected: 'Disconnected',
    connecting: 'Connecting…',
    connected: 'Connected',
    error: 'Error',
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Text style={styles.title}>MCP Server Settings</Text>

      {/* Status indicator */}
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, { backgroundColor: statusColor[status] }]} />
        <Text style={[styles.statusText, { color: statusColor[status] }]}>
          {statusLabel[status]}
        </Text>
      </View>

      {errorMessage ? (
        <Text style={styles.errorText}>{errorMessage}</Text>
      ) : null}

      {/* API Key input */}
      <Text style={styles.label}>Gemini API Key</Text>
      <View style={styles.apiKeyRow}>
        <TextInput
          style={[styles.input, styles.apiKeyInput]}
          value={apiKey}
          onChangeText={onApiKeyChange}
          placeholder="AIza…"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={!showApiKey}
          testID="api-key-input"
        />
        <TouchableOpacity
          style={styles.toggleButton}
          onPress={() => setShowApiKey((v) => !v)}
        >
          <Text style={styles.toggleButtonText}>{showApiKey ? 'Hide' : 'Show'}</Text>
        </TouchableOpacity>
      </View>

      {/* URL input */}
      <Text style={styles.label}>Server URL</Text>
      <TextInput
        style={styles.input}
        value={url}
        onChangeText={setUrl}
        placeholder="https://your-mcp-server.example.com/mcp"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        editable={!isConnecting && !isConnected}
        testID="server-url-input"
      />

      {/* Connect / Disconnect button */}
      {isConnected ? (
        <TouchableOpacity style={[styles.button, styles.disconnectButton]} onPress={onDisconnect}>
          <Text style={styles.buttonText}>Disconnect</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.button, isConnecting && styles.buttonDisabled]}
          onPress={() => onConnect(url)}
          disabled={isConnecting}
          testID="connect-button"
        >
          {isConnecting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Connect</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Tool list */}
      {tools.length > 0 && (
        <View style={styles.toolsContainer}>
          <Text style={styles.toolsTitle}>Available Tools ({tools.length})</Text>
          {tools.map((tool) => (
            <View key={tool.name} style={styles.toolItem}>
              <Text style={styles.toolName}>{tool.name}</Text>
              {tool.description ? (
                <Text style={styles.toolDescription}>{tool.description}</Text>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f9f9f9',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
    color: '#1a1a1a',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: '#f44336',
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444',
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#fff',
    color: '#1a1a1a',
  },
  apiKeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  apiKeyInput: {
    flex: 1,
    marginRight: 8,
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
  },
  toggleButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  button: {
    marginTop: 20,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#93b4f5',
  },
  disconnectButton: {
    backgroundColor: '#dc2626',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  toolsContainer: {
    marginTop: 28,
  },
  toolsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 10,
  },
  toolItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  toolName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  toolDescription: {
    fontSize: 13,
    color: '#555',
    marginTop: 2,
    lineHeight: 18,
  },
});
