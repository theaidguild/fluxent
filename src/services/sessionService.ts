/**
 * sessionService.ts
 *
 * Manages chat session debug logs. Each chat conversation creates a session
 * that captures structured log entries for:
 *  - User messages
 *  - MCP tool requests and responses
 *  - LLM responses
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SessionLogType =
  | 'user_message'
  | 'tool_request'
  | 'tool_response'
  | 'llm_response';

export interface UserMessageData {
  text: string;
}

export interface ToolRequestData {
  toolName: string;
  serverId: string;
  args: Record<string, unknown>;
}

export interface ToolResponseData {
  toolName: string;
  result: string;
  isError: boolean;
  durationMs: number;
}

export interface LLMResponseData {
  text: string;
  /** Whether this response contained function calls instead of text */
  hasFunctionCalls: boolean;
  functionCallNames?: string[];
}

export type SessionLogData =
  | UserMessageData
  | ToolRequestData
  | ToolResponseData
  | LLMResponseData;

export interface SessionLogEntry {
  id: string;
  timestamp: Date;
  type: SessionLogType;
  data: SessionLogData;
}

export interface ChatSession {
  id: string;
  startedAt: Date;
  entries: SessionLogEntry[];
}

type SessionListener = (session: ChatSession) => void;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let _entryId = 0;
let _sessionId = 0;
let _currentSession: ChatSession | null = null;
const _listeners = new Set<SessionListener>();

function notify() {
  if (!_currentSession) return;
  const snapshot = { ..._currentSession, entries: [..._currentSession.entries] };
  _listeners.forEach((fn) => fn(snapshot));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Start a new chat session. Any previous session is replaced. */
export function startSession(): ChatSession {
  _entryId = 0;
  _currentSession = {
    id: `session_${++_sessionId}`,
    startedAt: new Date(),
    entries: [],
  };
  notify();
  return _currentSession;
}

/** Get the current session (or null if none has started). */
export function getCurrentSession(): ChatSession | null {
  return _currentSession;
}

/** Add a structured log entry to the current session. */
export function addSessionLog(type: SessionLogType, data: SessionLogData): void {
  if (!_currentSession) return;
  _currentSession.entries.push({
    id: `entry_${++_entryId}`,
    timestamp: new Date(),
    type,
    data,
  });
  notify();
}

/** Clear the current session. */
export function clearSession(): void {
  _currentSession = null;
  notify();
}

/** Subscribe to session changes. Returns an unsubscribe function. */
export function onSessionChange(listener: SessionListener): () => void {
  _listeners.add(listener);
  return () => {
    _listeners.delete(listener);
  };
}
