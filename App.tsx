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

import { ChatView } from './src/components/ChatView';
import { SettingsView } from './src/components/SettingsView';
import { useMCPClient } from './src/hooks/useMCPClient';

// ---------------------------------------------------------------------------
// Tab type
// ---------------------------------------------------------------------------

type Tab = 'chat' | 'settings';

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('chat');

  const {
    status,
    errorMessage,
    tools,
    messages,
    isProcessing,
    apiKey,
    setApiKey,
    connect,
    disconnect,
    sendMessage,
  } = useMCPClient();

  const isConnected = status === 'connected';

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
            onSend={sendMessage}
          />
        ) : (
          <SettingsView
            status={status}
            errorMessage={errorMessage}
            tools={tools}
            apiKey={apiKey}
            onApiKeyChange={setApiKey}
            onConnect={connect}
            onDisconnect={disconnect}
          />
        )}
      </View>

      {/* Bottom tab bar */}
      <View style={styles.tabBar}>
        <TabBarButton
          label="Chat"
          icon="💬"
          active={activeTab === 'chat'}
          onPress={() => setActiveTab('chat')}
          testID="tab-chat"
        />
        <TabBarButton
          label="Settings"
          icon="⚙️"
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
  icon: string;
  active: boolean;
  onPress: () => void;
  testID?: string;
}

function TabBarButton({ label, icon, active, onPress, testID }: TabBarButtonProps) {
  return (
    <TouchableOpacity style={styles.tabButton} onPress={onPress} testID={testID}>
      <Text style={styles.tabIcon}>{icon}</Text>
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
    fontSize: 20,
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
