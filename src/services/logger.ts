/**
 * logger.ts
 *
 * A lightweight, structured logging service for the mobile MCP client.
 *
 * Features:
 *  - Named scopes (e.g. "MCP", "Gemini") for easy filtering
 *  - Configurable log level at runtime
 *  - Timestamped, formatted output
 *  - Buffer of recent log entries for in-app inspection
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  scope: string;
  message: string;
  data?: unknown;
}

type LogListener = (entry: LogEntry) => void;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LEVEL_LABELS: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.SILENT]: 'SILENT',
};

function formatEntry(entry: LogEntry): string {
  const ts = entry.timestamp.toISOString();
  const lvl = LEVEL_LABELS[entry.level];
  const base = `[${ts}] [${lvl}] [${entry.scope}] ${entry.message}`;
  return entry.data !== undefined ? `${base} ${JSON.stringify(entry.data)}` : base;
}

// ---------------------------------------------------------------------------
// Logger core
// ---------------------------------------------------------------------------

const MAX_BUFFER_SIZE = 500;

let _minLevel: LogLevel = __DEV__ ? LogLevel.DEBUG : LogLevel.INFO;
const _buffer: LogEntry[] = [];
const _listeners: Set<LogListener> = new Set();

function emit(entry: LogEntry) {
  _buffer.push(entry);
  if (_buffer.length > MAX_BUFFER_SIZE) {
    _buffer.splice(0, _buffer.length - MAX_BUFFER_SIZE);
  }
  _listeners.forEach((fn) => fn(entry));

  const formatted = formatEntry(entry);
  switch (entry.level) {
    case LogLevel.DEBUG:
      console.debug(formatted);
      break;
    case LogLevel.INFO:
      console.info(formatted);
      break;
    case LogLevel.WARN:
      console.warn(formatted);
      break;
    case LogLevel.ERROR:
      console.error(formatted);
      break;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Set the minimum log level. Messages below this level are silently dropped. */
export function setLogLevel(level: LogLevel) {
  _minLevel = level;
}

/** Get the current minimum log level. */
export function getLogLevel(): LogLevel {
  return _minLevel;
}

/** Return a shallow copy of all buffered log entries (most recent last). */
export function getLogBuffer(): LogEntry[] {
  return [..._buffer];
}

/** Remove all entries from the buffer. */
export function clearLogBuffer() {
  _buffer.length = 0;
}

/** Subscribe to live log entries. Returns an unsubscribe function. */
export function onLog(listener: LogListener): () => void {
  _listeners.add(listener);
  return () => {
    _listeners.delete(listener);
  };
}

// ---------------------------------------------------------------------------
// Scoped logger factory
// ---------------------------------------------------------------------------

export interface Logger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

/** Create a logger scoped to the given component / module name. */
export function createLogger(scope: string): Logger {
  const log = (level: LogLevel, message: string, data?: unknown) => {
    if (level < _minLevel) return;
    emit({ timestamp: new Date(), level, scope, message, data });
  };

  return {
    debug: (msg, data) => log(LogLevel.DEBUG, msg, data),
    info: (msg, data) => log(LogLevel.INFO, msg, data),
    warn: (msg, data) => log(LogLevel.WARN, msg, data),
    error: (msg, data) => log(LogLevel.ERROR, msg, data),
  };
}
