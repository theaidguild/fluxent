/**
 * SessionView.tsx
 *
 * Displays the debug log entries for the current chat session. Each entry
 * is colour-coded and structured by type: user messages, MCP tool
 * requests/responses, and LLM responses.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  ChatSession,
  SessionLogEntry,
  SessionLogType,
  UserMessageData,
  ToolRequestData,
  ToolResponseData,
  LLMResponseData,
  getCurrentSession,
  onSessionChange,
} from '../services/sessionService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_CONFIG: Record<
  SessionLogType,
  { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }
> = {
  user_message: {
    label: 'User Message',
    icon: 'person-outline',
    color: '#2563eb',
    bg: '#eff6ff',
  },
  tool_request: {
    label: 'Tool Request',
    icon: 'arrow-forward-circle-outline',
    color: '#7c3aed',
    bg: '#f5f3ff',
  },
  tool_response: {
    label: 'Tool Response',
    icon: 'arrow-back-circle-outline',
    color: '#059669',
    bg: '#ecfdf5',
  },
  llm_response: {
    label: 'LLM Response',
    icon: 'sparkles-outline',
    color: '#d97706',
    bg: '#fffbeb',
  },
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SessionView() {
  const [session, setSession] = useState<ChatSession | null>(getCurrentSession);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const unsub = onSessionChange((updated) => {
      setSession({ ...updated, entries: [...updated.entries] });
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (session && session.entries.length > 0) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [session?.entries.length]);

  if (!session) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="document-text-outline" size={48} color="#d1d5db" />
        <Text style={styles.emptyText}>No active session</Text>
        <Text style={styles.emptySubtext}>
          Send a message in the Chat tab to start a session.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Session header */}
      <View style={styles.sessionHeader}>
        <Text style={styles.sessionId}>{session.id}</Text>
        <Text style={styles.sessionTime}>
          Started {formatTime(session.startedAt)} · {session.entries.length} entries
        </Text>
      </View>

      {/* Entries */}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {session.entries.length === 0 ? (
          <Text style={styles.emptyEntries}>
            Session started. Waiting for activity…
          </Text>
        ) : (
          session.entries.map((entry) => (
            <EntryCard key={entry.id} entry={entry} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// EntryCard
// ---------------------------------------------------------------------------

function EntryCard({ entry }: { entry: SessionLogEntry }) {
  const config = TYPE_CONFIG[entry.type];
  const [expanded, setExpanded] = useState(true);

  return (
    <View style={[styles.card, { borderLeftColor: config.color }]}>
      <TouchableOpacity
        style={[styles.cardHeader, { backgroundColor: config.bg }]}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeaderLeft}>
          <Ionicons name={config.icon} size={16} color={config.color} />
          <Text style={[styles.cardLabel, { color: config.color }]}>
            {config.label}
          </Text>
        </View>
        <View style={styles.cardHeaderRight}>
          <Text style={styles.cardTime}>{formatTime(entry.timestamp)}</Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color="#9ca3af"
          />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.cardBody}>
          <EntryBody entry={entry} />
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// EntryBody – renders type-specific content
// ---------------------------------------------------------------------------

function EntryBody({ entry }: { entry: SessionLogEntry }) {
  switch (entry.type) {
    case 'user_message': {
      const data = entry.data as UserMessageData;
      return <Text style={styles.bodyText}>{data.text}</Text>;
    }
    case 'tool_request': {
      const data = entry.data as ToolRequestData;
      return (
        <View>
          <Row label="Tool" value={data.toolName} />
          <Row label="Server" value={data.serverId} />
          {Object.keys(data.args).length > 0 && (
            <View style={styles.codeBlock}>
              <Text style={styles.codeLabel}>Arguments</Text>
              <Text style={styles.codeText}>
                {JSON.stringify(data.args, null, 2)}
              </Text>
            </View>
          )}
        </View>
      );
    }
    case 'tool_response': {
      const data = entry.data as ToolResponseData;
      return (
        <View>
          <Row label="Tool" value={data.toolName} />
          <Row label="Duration" value={`${data.durationMs}ms`} />
          <Row
            label="Status"
            value={data.isError ? 'Error' : 'Success'}
            valueColor={data.isError ? '#dc2626' : '#059669'}
          />
          <View style={styles.codeBlock}>
            <Text style={styles.codeLabel}>Result</Text>
            <Text
              style={[styles.codeText, data.isError && { color: '#dc2626' }]}
              numberOfLines={20}
            >
              {data.result}
            </Text>
          </View>
        </View>
      );
    }
    case 'llm_response': {
      const data = entry.data as LLMResponseData;
      return (
        <View>
          {data.hasFunctionCalls && data.functionCallNames && (
            <Row
              label="Function calls"
              value={data.functionCallNames.join(', ')}
            />
          )}
          {data.text ? (
            <Text style={styles.bodyText}>{data.text}</Text>
          ) : (
            <Text style={styles.bodyMuted}>(no text – function calls only)</Text>
          )}
        </View>
      );
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Row helper
// ---------------------------------------------------------------------------

function Row({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, valueColor ? { color: valueColor } : undefined]}>
        {value}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#f9fafb',
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
    textAlign: 'center',
  },
  emptyEntries: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
  },

  // Session header
  sessionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sessionId: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  sessionTime: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 24,
  },

  // Card
  card: {
    marginBottom: 8,
    borderRadius: 10,
    borderLeftWidth: 3,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
  cardTime: {
    fontSize: 11,
    color: '#9ca3af',
    marginRight: 4,
  },
  cardBody: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  // Body
  bodyText: {
    fontSize: 14,
    color: '#1a1a1a',
    lineHeight: 20,
  },
  bodyMuted: {
    fontSize: 13,
    color: '#9ca3af',
    fontStyle: 'italic',
  },

  // Row
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  rowLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    width: 100,
  },
  rowValue: {
    fontSize: 13,
    color: '#1a1a1a',
    flex: 1,
  },

  // Code block
  codeBlock: {
    marginTop: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    padding: 10,
  },
  codeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  codeText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#1a1a1a',
    lineHeight: 18,
  },
});
