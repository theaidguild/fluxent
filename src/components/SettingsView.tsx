/**
 * SettingsView.tsx
 *
 * Settings screen that lets the user configure multiple remote MCP servers,
 * manage connections, and set the Gemini API key.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ServerState } from '../hooks/useMCPClient';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SettingsViewProps {
  servers: ServerState[];
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  onAddServer: (name: string, url: string) => void;
  onRemoveServer: (serverId: string) => Promise<void>;
  onConnectServer: (serverId: string) => Promise<void>;
  onDisconnectServer: (serverId: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const statusColor: Record<ServerState['status'], string> = {
  disconnected: '#888',
  connecting: '#f5a623',
  connected: '#4caf50',
  error: '#f44336',
};

const statusLabel: Record<ServerState['status'], string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting…',
  connected: 'Connected',
  error: 'Error',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SettingsView({
  servers,
  apiKey,
  onApiKeyChange,
  onAddServer,
  onRemoveServer,
  onConnectServer,
  onDisconnectServer,
}: SettingsViewProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [expandedServer, setExpandedServer] = useState<string | null>(null);

  const handleAdd = () => {
    const trimmedName = newName.trim();
    const trimmedUrl = newUrl.trim();
    if (!trimmedName || !trimmedUrl) return;
    onAddServer(trimmedName, trimmedUrl);
    setNewName('');
    setNewUrl('');
    setShowAddForm(false);
  };

  const handleRemove = (server: ServerState) => {
    Alert.alert(
      'Remove Server',
      `Remove "${server.config.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => onRemoveServer(server.config.id),
        },
      ],
    );
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
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
        <Text style={styles.title}>Settings</Text>

        {/* ── API Key ─────────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Gemini API Key</Text>
        <View style={styles.apiKeyRow}>
          <TextInput
            style={[styles.input, styles.apiKeyInput]}
            value={apiKey}
            onChangeText={onApiKeyChange}
            placeholder="AIza…"
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={!showApiKey}
            testID="api-key-input"
          />
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setShowApiKey((v) => !v)}
          >
            <Text style={styles.toggleButtonText}>
              {showApiKey ? 'Hide' : 'Show'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── MCP Servers ─────────────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>MCP Servers</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddForm((v) => !v)}
          >
            <Ionicons
              name={showAddForm ? 'close-circle-outline' : 'add-circle-outline'}
              size={24}
              color="#a78bfa"
            />
          </TouchableOpacity>
        </View>

        {/* Add-server form */}
        {showAddForm && (
          <View style={styles.addForm}>
            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              placeholder="Server name (e.g. My MCP)"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
              testID="new-server-name"
            />
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              value={newUrl}
              onChangeText={setNewUrl}
              placeholder="https://your-mcp-server.example.com/mcp"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              testID="new-server-url"
            />
            <TouchableOpacity
              style={[
                styles.formButton,
                (!newName.trim() || !newUrl.trim()) && styles.formButtonDisabled,
              ]}
              onPress={handleAdd}
              disabled={!newName.trim() || !newUrl.trim()}
              testID="add-server-button"
            >
              <Text style={styles.formButtonText}>Add Server</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Server cards */}
        {servers.length === 0 && !showAddForm && (
          <View style={styles.emptyServers}>
            <Ionicons name="server-outline" size={36} color="#d1d5db" />
            <Text style={styles.emptyText}>
              No servers configured. Tap + to add one.
            </Text>
          </View>
        )}

        {servers.map((server) => {
          const isExpanded = expandedServer === server.config.id;
          const isServerConnected = server.status === 'connected';
          const isServerConnecting = server.status === 'connecting';

          return (
            <View key={server.config.id} style={styles.serverCard}>
              {/* Card header */}
              <View style={styles.serverCardHeader}>
                <View style={styles.serverInfo}>
                  <View style={styles.serverNameRow}>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: statusColor[server.status] },
                      ]}
                    />
                    <Text style={styles.serverName} numberOfLines={1}>
                      {server.config.name}
                    </Text>
                  </View>
                  <Text style={styles.serverUrl} numberOfLines={1}>
                    {server.config.url}
                  </Text>
                  <Text
                    style={[
                      styles.serverStatus,
                      { color: statusColor[server.status] },
                    ]}
                  >
                    {statusLabel[server.status]}
                    {isServerConnected && server.tools.length > 0
                      ? ` · ${server.tools.length} tool${server.tools.length !== 1 ? 's' : ''}`
                      : ''}
                  </Text>
                </View>

                {/* Action buttons */}
                <View style={styles.serverActions}>
                  {isServerConnected ? (
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => onDisconnectServer(server.config.id)}
                    >
                      <Ionicons name="stop-circle-outline" size={26} color="#dc2626" />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => onConnectServer(server.config.id)}
                      disabled={isServerConnecting}
                    >
                      {isServerConnecting ? (
                        <ActivityIndicator size="small" color="#f5a623" />
                      ) : (
                        <Ionicons name="play-circle-outline" size={26} color="#4caf50" />
                      )}
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => handleRemove(server)}
                  >
                    <Ionicons name="trash-outline" size={22} color="#9ca3af" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Error message */}
              {server.errorMessage ? (
                <Text style={styles.errorText}>{server.errorMessage}</Text>
              ) : null}

              {/* Expandable tools list */}
              {isServerConnected && server.tools.length > 0 && (
                <>
                  <TouchableOpacity
                    style={styles.toolsToggle}
                    onPress={() =>
                      setExpandedServer(isExpanded ? null : server.config.id)
                    }
                  >
                    <Text style={styles.toolsToggleText}>
                      {isExpanded ? 'Hide tools' : 'Show tools'}
                    </Text>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color="#a78bfa"
                    />
                  </TouchableOpacity>
                  {isExpanded &&
                    server.tools.map((tool) => (
                      <View key={tool.name} style={styles.toolItem}>
                        <Text style={styles.toolName}>{tool.name}</Text>
                        {tool.description ? (
                          <Text style={styles.toolDescription}>
                            {tool.description}
                          </Text>
                        ) : null}
                      </View>
                    ))}
                </>
              )}
            </View>
          );
        })}
      </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
    color: '#f3f4f6',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f3f4f6',
  },
  addButton: {
    padding: 4,
  },
  emptyServers: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },

  // API key
  apiKeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  apiKeyInput: {
    flex: 1,
    marginRight: 8,
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(139, 92, 246, 0.3)',
    borderRadius: 8,
  },
  toggleButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e5e7eb',
  },

  // Inputs
  input: {
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: 'rgba(55, 48, 107, 0.5)',
    color: '#e5e7eb',
  },

  // Add form
  addForm: {
    backgroundColor: 'rgba(30, 27, 75, 0.7)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    marginBottom: 12,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  formButton: {
    marginTop: 12,
    backgroundColor: '#8b5cf6',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  formButtonDisabled: {
    backgroundColor: 'rgba(139, 92, 246, 0.4)',
  },
  formButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },

  // Server card
  serverCard: {
    backgroundColor: 'rgba(55, 48, 107, 0.6)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  serverCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  serverInfo: {
    flex: 1,
    marginRight: 8,
  },
  serverNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  serverName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f3f4f6',
    flexShrink: 1,
  },
  serverUrl: {
    fontSize: 12,
    color: '#9ca3af',
    marginLeft: 14,
    marginBottom: 2,
  },
  serverStatus: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 14,
  },
  serverActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 4,
    marginLeft: 4,
  },

  // Error
  errorText: {
    color: '#f87171',
    fontSize: 12,
    marginTop: 6,
    lineHeight: 16,
  },

  // Tools
  toolsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(139, 92, 246, 0.2)',
  },
  toolsToggleText: {
    fontSize: 13,
    color: '#a78bfa',
    fontWeight: '600',
    marginRight: 4,
  },
  toolItem: {
    backgroundColor: 'rgba(30, 27, 75, 0.5)',
    borderRadius: 6,
    padding: 10,
    marginTop: 6,
  },
  toolName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#c4b5fd',
  },
  toolDescription: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
    lineHeight: 16,
  },
});
