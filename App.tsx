/**
 * App.tsx
 *
 * Root component for the MCP mobile client.  Provides a two-tab navigation:
 *   • Chat    – send messages to the MCP server and see responses
 *   • Settings – configure the server URL and manage the connection
 */

import React, { useState } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ChatView } from './src/components/ChatView';
import { SettingsView } from './src/components/SettingsView';
import { SessionView } from './src/components/SessionView';
import { useMCPClient } from './src/hooks/useMCPClient';

// ---------------------------------------------------------------------------
// Tab type
// ---------------------------------------------------------------------------

type Tab = 'chat' | 'session' | 'settings';

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('chat');

  const {
    servers,
    tools,
    messages,
    isProcessing,
    isConnected,
    apiKey,
    setApiKey,
    addServer,
    removeServer,
    connectServer,
    disconnectServer,
    sendMessage,
  } = useMCPClient();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>MCP Client</Text>
        <View style={styles.headerStatusDot}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isConnected ? '#4caf50' : '#9ca3af' },
            ]}
          />
        </View>
      </View>

      {/* Tab content */}
      <View style={styles.content}>
        {activeTab === 'chat' ? (
          <ChatView
            messages={messages}
            isConnected={isConnected}
            isProcessing={isProcessing}
            tools={tools}
            onSend={sendMessage}
          />
        ) : activeTab === 'session' ? (
          <SessionView />
        ) : (
          <SettingsView
            servers={servers}
            apiKey={apiKey}
            onApiKeyChange={setApiKey}
            onAddServer={addServer}
            onRemoveServer={removeServer}
            onConnectServer={connectServer}
            onDisconnectServer={disconnectServer}
          />
        )}
      </View>

      {/* Bottom tab bar */}
      <View style={styles.tabBar}>
        <TabBarButton
          label="Chat"
          icon="chatbubble-ellipses"
          iconOutline="chatbubble-ellipses-outline"
          active={activeTab === 'chat'}
          onPress={() => setActiveTab('chat')}
          testID="tab-chat"
        />
        <TabBarButton
          label="Session"
          icon="list"
          iconOutline="list-outline"
          active={activeTab === 'session'}
          onPress={() => setActiveTab('session')}
          testID="tab-session"
        />
        <TabBarButton
          label="Settings"
          icon="settings"
          iconOutline="settings-outline"
          active={activeTab === 'settings'}
          onPress={() => setActiveTab('settings')}
          testID="tab-settings"
        />
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// TabBarButton
// ---------------------------------------------------------------------------

interface TabBarButtonProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconOutline: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
  testID?: string;
}

function TabBarButton({ label, icon, iconOutline, active, onPress, testID }: TabBarButtonProps) {
  return (
    <TouchableOpacity style={styles.tabButton} onPress={onPress} testID={testID}>
      <Ionicons
        name={active ? icon : iconOutline}
        size={22}
        color={active ? '#2563eb' : '#6b7280'}
      />
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
      {active && <View style={styles.tabIndicator} />}
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  headerStatusDot: {
    padding: 4,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    position: 'relative',
  },
  tabIcon: {
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  tabLabelActive: {
    color: '#2563eb',
    fontWeight: '600',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '25%',
    right: '25%',
    height: 2,
    backgroundColor: '#2563eb',
    borderRadius: 1,
  },
});
