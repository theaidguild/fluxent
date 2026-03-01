/**
 * ToolMentionInput.tsx
 *
 * A rich text input that supports #tool_name mentions. When the user types `#`,
 * a picker of available MCP tools appears. Selecting a tool inserts a mention
 * that is rendered in bold with a distinctive colour. The raw text (including
 * the `#tool_name` tokens) is passed through to the LLM so it can see which
 * tools the user is referencing.
 *
 * Implementation: an invisible TextInput sits on top of a styled Text overlay.
 * Both share identical font metrics so the caret lines up with the rendered
 * segments.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TextInputSelectionChangeEvent,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { MCPTool } from '../hooks/useMCPClient';

// ---------------------------------------------------------------------------
// Segment types
// ---------------------------------------------------------------------------

interface TextSegment {
  type: 'text';
  value: string;
}

interface ToolSegment {
  type: 'tool';
  value: string;   // e.g. "#get_weather"
  toolName: string; // e.g. "get_weather"
}

type Segment = TextSegment | ToolSegment;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse input text and split it into plain-text and tool-mention segments. */
function parseSegments(text: string, toolNames: string[]): Segment[] {
  if (!text || toolNames.length === 0 || !text.includes('#')) {
    return text ? [{ type: 'text', value: text }] : [];
  }

  // Match longest tool names first to avoid partial matches.
  const sorted = [...toolNames].sort((a, b) => b.length - a.length);
  const escaped = sorted.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`#(${escaped.join('|')})(?=\\s|$)`, 'g');

  const segments: Segment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'tool', value: match[0], toolName: match[1] });
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: 'text', value: text }];
}

/**
 * Look backward from the cursor to find an in-progress `#` trigger.
 * Returns `{ start, query }` when the user is actively typing a mention,
 * or `null` when there is nothing to autocomplete.
 */
function findHashTrigger(
  text: string,
  cursorPos: number,
  toolNames: string[],
): { start: number; query: string } | null {
  let i = cursorPos - 1;

  while (i >= 0) {
    const ch = text[i];

    if (ch === '#') {
      // `#` must be at the start or preceded by whitespace.
      if (i > 0 && !/\s/.test(text[i - 1])) return null;

      const query = text.slice(i + 1, cursorPos);

      // If the full word already matches a completed mention followed by a
      // space (or end-of-string *after* the cursor), don't reopen the picker.
      const afterCursor = text.slice(cursorPos);
      const trailingWord = afterCursor.match(/^\S*/)?.[0] ?? '';
      const fullWord = query + trailingWord;
      if (toolNames.includes(fullWord) && (cursorPos >= text.length || /\s/.test(text[cursorPos]))) {
        return null;
      }

      return { start: i, query };
    }

    if (/\s/.test(ch)) return null;
    i--;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ToolMentionInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmitEditing: () => void;
  tools: MCPTool[];
  editable: boolean;
  placeholder?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ToolMentionInput({
  value,
  onChangeText,
  onSubmitEditing,
  tools,
  editable,
  placeholder,
}: ToolMentionInputProps) {
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const inputRef = useRef<TextInput>(null);

  const toolNames = useMemo(() => tools.map((t) => t.name), [tools]);

  // Styled segments for the overlay.
  const segments = useMemo(() => parseSegments(value, toolNames), [value, toolNames]);

  // Determine whether the picker should be visible.
  const trigger = useMemo(
    () => findHashTrigger(value, selection.start, toolNames),
    [value, selection.start, toolNames],
  );

  const filteredTools = useMemo(() => {
    if (!trigger || tools.length === 0) return [];
    const q = trigger.query.toLowerCase();
    return tools.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description?.toLowerCase().includes(q) ?? false),
    );
  }, [trigger, tools]);

  const showPicker = trigger !== null && filteredTools.length > 0;

  // --------------------------------------------------
  // Handlers
  // --------------------------------------------------

  const handleSelectionChange = useCallback(
    (e: TextInputSelectionChangeEvent) => {
      setSelection(e.nativeEvent.selection);
    },
    [],
  );

  const handleSelectTool = useCallback(
    (toolName: string) => {
      if (!trigger) return;
      const before = value.slice(0, trigger.start);
      const after = value.slice(selection.start);
      const newValue = `${before}#${toolName} ${after}`;

      onChangeText(newValue);
    },
    [trigger, value, selection.start, onChangeText],
  );

  // --------------------------------------------------
  // Render
  // --------------------------------------------------

  return (
    <View style={styles.container}>
      {/* Floating tool picker */}
      {showPicker && (
        <View style={styles.pickerContainer}>
          <FlatList
            data={filteredTools}
            keyExtractor={(item) => item.name}
            keyboardShouldPersistTaps="always"
            style={styles.pickerList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.pickerItem}
                onPress={() => handleSelectTool(item.name)}
              >
                <Ionicons name="hammer-outline" size={16} color="#6366f1" />
                <View style={styles.pickerItemTextContainer}>
                  <Text style={styles.pickerToolName}>{item.name}</Text>
                  {item.description ? (
                    <Text style={styles.pickerToolDesc} numberOfLines={1}>
                      {item.description}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Input wrapper */}
      <View style={[styles.inputWrapper, !editable && styles.inputWrapperDisabled]}>
        <TextInput
          ref={inputRef}
          style={styles.textInput}
          value={value}
          onChangeText={onChangeText}
          onSelectionChange={handleSelectionChange}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          editable={editable}
          multiline
          maxLength={4000}
          returnKeyType="default"
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit={false}
          selectionColor="#a78bfa"
          testID="chat-input"
        />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const FONT_SIZE = 15;
const LINE_HEIGHT = 20;
const PADDING_H = 16;
const PADDING_V = 10;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginRight: 8,
    overflow: 'visible',
  },

  // Input wrapper ----------------------------------------------------------
  inputWrapper: {
    position: 'relative',
    minHeight: 42,
    maxHeight: 200,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    borderRadius: 22,
    backgroundColor: 'rgba(55, 48, 107, 0.5)',
    overflow: 'hidden',
  },
  inputWrapperDisabled: {
    backgroundColor: 'rgba(55, 48, 107, 0.3)',
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },

  // TextInput --------------------------------------------------------------
  textInput: {
    minHeight: 42,
    maxHeight: 200,
    paddingHorizontal: PADDING_H,
    paddingVertical: PADDING_V,
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT,
    color: '#e5e7eb',
    backgroundColor: 'transparent',
  },

  // Tool picker popup -----------------------------------------------------
  pickerContainer: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    marginBottom: 4,
    backgroundColor: 'rgba(30, 27, 75, 0.95)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    maxHeight: 200,
    zIndex: 100,
    ...Platform.select({
      ios: {
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  pickerList: {
    maxHeight: 200,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(139, 92, 246, 0.2)',
  },
  pickerItemTextContainer: {
    marginLeft: 8,
    flex: 1,
  },
  pickerToolName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f3f4f6',
  },
  pickerToolDesc: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 1,
  },
});
