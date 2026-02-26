/**
 * App.tsx
 *
 * Root component for the MCP mobile client.  Provides a two-tab navigation:
 *   • Chat    – send messages to the MCP server and see responses
 *   • Settings – configure the server URL and manage the connection
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';

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
  const [appIsReady, setAppIsReady] = useState(false);

  const {
    servers,
    tools,
    messages,
    isProcessing,
    isStreaming,
    isConnected,
    apiKey,
    setApiKey,
    addServer,
    removeServer,
    connectServer,
    disconnectServer,
    sendMessage,
    startNewChat,
  } = useMCPClient();

  // Hide splash screen when app is ready
  useEffect(() => {
    setAppIsReady(true);
  }, []);

  useEffect(() => {
    if (appIsReady) {
      SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#1e1b4b" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Fluxent</Text>
        <View style={styles.headerRight}>
          {activeTab === 'chat' && (
            <TouchableOpacity
              style={styles.newChatButton}
              onPress={startNewChat}
              testID="new-chat-button"
            >
              <Ionicons name="create-outline" size={22} color="#a78bfa" />
            </TouchableOpacity>
          )}
          <StatusDot connected={isConnected} />
        </View>
      </View>

      {/* Tab content */}
      <View style={styles.content}>
        {activeTab === 'chat' ? (
          <ChatView
            messages={messages}
            isConnected={isConnected}
            isProcessing={isProcessing}
            isStreaming={isStreaming ?? false}
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
// StatusDot – pulses when connected
// ---------------------------------------------------------------------------

const PULSE_SCALE = 1.6;
const PULSE_DURATION = 800;
const PULSE_IDLE_DELAY = 600;

function StatusDot({ connected }: { connected: boolean }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!connected) {
      scaleAnim.setValue(1);
      opacityAnim.setValue(1);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: PULSE_SCALE,
            duration: PULSE_DURATION,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: PULSE_DURATION,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(PULSE_IDLE_DELAY),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [connected, scaleAnim, opacityAnim]);

  const color = connected ? '#4caf50' : '#9ca3af';

  return (
    <View style={styles.statusDotWrapper}>
      {connected && (
        <Animated.View
          style={[
            styles.statusDotRing,
            { backgroundColor: color, transform: [{ scale: scaleAnim }], opacity: opacityAnim },
          ]}
        />
      )}
      <View style={[styles.statusDot, { backgroundColor: color }]} />
    </View>
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
      <View style={[styles.tabPill, active && styles.tabPillActive]}>
        <Ionicons
          name={active ? icon : iconOutline}
          size={22}
          color={active ? '#a78bfa' : '#9ca3af'}
        />
      </View>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1e1b4b',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(30, 27, 75, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139, 92, 246, 0.2)',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f3f4f6',
    letterSpacing: -0.3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  newChatButton: {
    padding: 4,
    marginRight: 10,
  },
  statusDotWrapper: {
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDotRing: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    opacity: 0.4,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(30, 27, 75, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(139, 92, 246, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    paddingBottom: 4,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  tabPill: {
    width: 44,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  tabPillActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.3)',
  },
  tabLabel: {
    fontSize: 11,
    color: '#9ca3af',
  },
  tabLabelActive: {
    color: '#c4b5fd',
    fontWeight: '600',
  },
});
