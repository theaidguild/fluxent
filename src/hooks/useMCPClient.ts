/**
 * useMCPClient.ts
 *
 * A React hook that manages the lifecycle of multiple MCP (Model Context
 * Protocol) clients over Streamable HTTP transport.  It handles:
 *
 *  - Connecting / disconnecting to multiple remote MCP servers
 *  - AppState lifecycle: pausing when the app goes to the background and
 *    resuming (with the Last-Event-ID resumption token) when it comes back
 *  - Exposing the aggregated list of available tools from all servers
 *  - A `sendMessage` helper that routes a user prompt through Gemini with
 *    tool calls dispatched to the correct server
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { fetch as streamingFetch } from 'react-native-fetch-api';
import {
  Content,
  mcpToolsToGeminiFunctions,
  createGeminiChat,
} from '../services/geminiService';
import { createLogger } from '../services/logger';
import type { Chat } from '@google/genai';

const log = createLogger('MCP');

/**
 * A fetch wrapper that enables text streaming on React Native.
 * RN's built-in fetch does not expose `response.body` as a ReadableStream;
 * react-native-fetch-api does when the `reactNative.textStreaming` flag is set.
 *
 * We also normalise headers to a plain Record so that react-native-fetch-api
 * does not fall back to the default `text/plain` Content-Type.
 */
const mcpFetch = (url: string | URL, init?: RequestInit): Promise<Response> => {
  let headers: Record<string, string> = {};
  if (init?.headers) {
    if (init.headers instanceof Headers) {
      init.headers.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(init.headers)) {
      for (const [key, value] of init.headers) {
        headers[key] = value;
      }
    } else {
      headers = { ...init.headers } as Record<string, string>;
    }
  }

  return streamingFetch(url, {
    ...init,
    headers,
    reactNative: { textStreaming: true },
  });
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface MCPMessage {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  timestamp: Date;
}

export type ServerStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ServerConfig {
  id: string;
  name: string;
  url: string;
}

export interface ServerState {
  config: ServerConfig;
  status: ServerStatus;
  errorMessage: string | null;
  tools: MCPTool[];
}

/** Runtime refs for a single server connection (not exposed to UI) */
interface ServerRuntime {
  client: Client | null;
  transport: StreamableHTTPClientTransport | null;
  resumptionToken: string | undefined;
}

export interface UseMCPClientReturn {
  /** All configured servers with their current state */
  servers: ServerState[];
  /** Aggregated tools from all connected servers */
  tools: MCPTool[];
  /** Chat message history */
  messages: MCPMessage[];
  /** Whether the AI is currently processing a response */
  isProcessing: boolean;
  /** Whether at least one server is connected */
  isConnected: boolean;
  /** Gemini API key */
  apiKey: string;
  /** Set the Gemini API key */
  setApiKey: (key: string) => void;
  /** Add a new server configuration */
  addServer: (name: string, url: string) => void;
  /** Remove a server configuration (disconnects first) */
  removeServer: (serverId: string) => Promise<void>;
  /** Connect a specific server by id */
  connectServer: (serverId: string) => Promise<void>;
  /** Disconnect a specific server by id */
  disconnectServer: (serverId: string) => Promise<void>;
  /** Send a user message and get an AI response (with MCP tool calling) */
  sendMessage: (text: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Helper – generate a short unique id for messages
// ---------------------------------------------------------------------------
let _msgId = 0;
function nextId(): string {
  return String(++_msgId);
}

let _serverId = 0;
function nextServerId(): string {
  return `srv_${++_serverId}`;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useMCPClient(): UseMCPClientReturn {
  const [servers, setServers] = useState<ServerState[]>([]);
  const [messages, setMessages] = useState<MCPMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [apiKey, setApiKey] = useState('');

  // Runtime data keyed by server id (not in React state – avoids stale closures)
  const runtimesRef = useRef<Map<string, ServerRuntime>>(new Map());
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  /** Conversation history in Gemini Content format (kept as backup for chat recreation) */
  const conversationRef = useRef<Content[]>([]);

  /** Persistent Gemini Chat instance – reused across turns */
  const chatRef = useRef<any>(null);
  /** Key that tracks which tools + API key the current chat was built with */
  const chatToolsKeyRef = useRef<string>('');

  // Keep a ref to the latest servers array so callbacks see fresh data
  const serversRef = useRef<ServerState[]>(servers);
  serversRef.current = servers;

  // ---------------------------------------------------------------------------
  // Derived: aggregate tools from all connected servers
  // ---------------------------------------------------------------------------

  const tools: MCPTool[] = servers
    .filter((s) => s.status === 'connected')
    .flatMap((s) => s.tools);

  const isConnected = servers.some((s) => s.status === 'connected');

  // Build a lookup: tool name → server id (for routing tool calls)
  const toolToServerRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    const map = new Map<string, string>();
    for (const s of servers) {
      if (s.status === 'connected') {
        for (const t of s.tools) {
          map.set(t.name, s.config.id);
        }
      }
    }
    toolToServerRef.current = map;
  }, [servers]);

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  const appendMessage = useCallback((role: MCPMessage['role'], content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role, content, timestamp: new Date() },
    ]);
  }, []);

  const updateServer = useCallback(
    (serverId: string, patch: Partial<Omit<ServerState, 'config'>>) => {
      setServers((prev) =>
        prev.map((s) => (s.config.id === serverId ? { ...s, ...patch } : s)),
      );
    },
    [],
  );

  const cleanupRuntime = useCallback(async (serverId: string) => {
    const runtime = runtimesRef.current.get(serverId);
    if (!runtime) return;
    try {
      if (runtime.client) {
        await runtime.client.close();
      }
    } catch {
      // ignore close errors
    }
    runtime.client = null;
    runtime.transport = null;
    runtime.resumptionToken = undefined;
  }, []);

  // ---------------------------------------------------------------------------
  // refreshTools – fetch the tool list from a connected server
  // ---------------------------------------------------------------------------

  const refreshServerTools = useCallback(
    async (serverId: string, client: Client) => {
      try {
        const result = await client.listTools();
        const fullTools: MCPTool[] = (result.tools ?? []).map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema as Record<string, unknown>,
        }));
        updateServer(serverId, { tools: fullTools });
      } catch (err) {
        log.warn('Could not list tools', err);
      }
    },
    [updateServer],
  );

  // ---------------------------------------------------------------------------
  // addServer
  // ---------------------------------------------------------------------------

  const addServer = useCallback((name: string, url: string) => {
    const id = nextServerId();
    const config: ServerConfig = { id, name, url };
    const state: ServerState = {
      config,
      status: 'disconnected',
      errorMessage: null,
      tools: [],
    };
    runtimesRef.current.set(id, {
      client: null,
      transport: null,
      resumptionToken: undefined,
    });
    setServers((prev) => [...prev, state]);
  }, []);

  // ---------------------------------------------------------------------------
  // removeServer
  // ---------------------------------------------------------------------------

  const removeServer = useCallback(
    async (serverId: string) => {
      await cleanupRuntime(serverId);
      runtimesRef.current.delete(serverId);
      setServers((prev) => prev.filter((s) => s.config.id !== serverId));
    },
    [cleanupRuntime],
  );

  // ---------------------------------------------------------------------------
  // connectServer
  // ---------------------------------------------------------------------------

  const connectServer = useCallback(
    async (serverId: string) => {
      const server = serversRef.current.find((s) => s.config.id === serverId);
      if (!server) return;

      const serverUrl = server.config.url;
      if (!serverUrl.trim()) {
        updateServer(serverId, { errorMessage: 'Server URL must not be empty.', status: 'error' });
        return;
      }

      await cleanupRuntime(serverId);

      updateServer(serverId, { status: 'connecting', errorMessage: null });
      log.info('Connecting to server', { id: serverId, url: serverUrl });

      try {
        const url = new URL(serverUrl);

        const transport = new StreamableHTTPClientTransport(url, {
          fetch: mcpFetch as any,
          reconnectionOptions: {
            maxRetries: 3,
            initialReconnectionDelay: 1000,
            maxReconnectionDelay: 30_000,
            reconnectionDelayGrowFactor: 1.5,
          },
        });

        const client = new Client(
          { name: 'mobile-mcp-client', version: '1.0.0' },
          { capabilities: {} },
        );

        await client.connect(transport);

        const runtime = runtimesRef.current.get(serverId);
        if (runtime) {
          runtime.client = client;
          runtime.transport = transport;
        }

        updateServer(serverId, { status: 'connected' });
        log.info('Connected successfully', { id: serverId });

        await refreshServerTools(serverId, client);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.error('Connection failed', { id: serverId, error: message });
        updateServer(serverId, { errorMessage: message, status: 'error' });
        const runtime = runtimesRef.current.get(serverId);
        if (runtime) {
          runtime.client = null;
          runtime.transport = null;
        }
      }
    },
    [cleanupRuntime, refreshServerTools, updateServer],
  );

  // ---------------------------------------------------------------------------
  // disconnectServer
  // ---------------------------------------------------------------------------

  const disconnectServer = useCallback(
    async (serverId: string) => {
      log.info('Disconnecting', { id: serverId });
      await cleanupRuntime(serverId);
      updateServer(serverId, { status: 'disconnected', errorMessage: null, tools: [] });
    },
    [cleanupRuntime, updateServer],
  );

  // ---------------------------------------------------------------------------
  // sendMessage – agentic loop: user → Gemini → (function calls) → Gemini → …
  // ---------------------------------------------------------------------------

  /** Maximum number of tool-calling rounds to prevent runaway loops */
  const MAX_TOOL_ROUNDS = 10;

  const sendMessage = useCallback(async (text: string) => {
    appendMessage('user', text);

    if (!isConnected) {
      appendMessage('error', 'Not connected to any MCP server.');
      return;
    }

    if (!apiKey.trim()) {
      appendMessage('error', 'Please set your Gemini API key in the Settings tab.');
      return;
    }

    const geminiFunctions = mcpToolsToGeminiFunctions(tools);

    // Determine whether we need a fresh chat session
    const toolsKey = tools.map((t) => t.name).sort().join(',') + '|' + apiKey;
    const needNewChat = !chatRef.current || chatToolsKeyRef.current !== toolsKey;

    setIsProcessing(true);
    try {
      let chat: Chat;
      if (needNewChat) {
        chat = createGeminiChat({
          apiKey,
          tools: geminiFunctions,
          history: conversationRef.current,
        });
        chatRef.current = chat;
        chatToolsKeyRef.current = toolsKey;
      } else {
        chat = chatRef.current;
      }

      // Send the user message
      let response = await chat.sendMessage({ message: text });

      // Store the user turn in our conversation history
      conversationRef.current.push({
        role: 'user',
        parts: [{ text }],
      });

      let rounds = 0;

      while (rounds < MAX_TOOL_ROUNDS) {
        rounds++;

        // Check if the model wants to call functions
        const functionCalls = response.functionCalls;

        if (!functionCalls || functionCalls.length === 0) {
          // No function calls — we have the final text response
          break;
        }

        // Store the model's function call response in history
        conversationRef.current.push({
          role: 'model',
          parts: functionCalls
            .filter((fc) => fc.name != null)
            .map((fc) => ({
              functionCall: {
                name: fc.name!,
                args: fc.args as Record<string, unknown> | undefined,
              },
            })),
        });

        // Execute each function call via the appropriate MCP server
        const functionResponses: Array<{
          name: string;
          response: Record<string, unknown>;
        }> = [];

        for (const fc of functionCalls) {
          const toolName = fc.name ?? 'unknown';
          appendMessage('assistant', `\uD83D\uDD27 Calling tool: **${toolName}**`);

          // Route the tool call to the correct server
          const targetServerId = toolToServerRef.current.get(toolName);
          const runtime = targetServerId
            ? runtimesRef.current.get(targetServerId)
            : undefined;

          if (!runtime?.client) {
            log.error('No server found for tool', { tool: toolName });
            functionResponses.push({
              name: toolName,
              response: {
                error: `No connected server provides the tool "${toolName}"`,
                is_error: true,
              },
            });
            continue;
          }

          try {
            log.debug('Calling MCP tool', { tool: toolName, server: targetServerId, args: fc.args });
            const mcpResult = await runtime.client.callTool({
              name: toolName,
              arguments: fc.args as Record<string, unknown>,
            });

            const resultText = (mcpResult.content as Array<{ type: string; text?: string }>)
              .filter((c) => c.type === 'text' && c.text)
              .map((c) => c.text)
              .join('\n') || JSON.stringify(mcpResult.content);

            functionResponses.push({
              name: toolName,
              response: {
                result: resultText,
                is_error: mcpResult.isError === true,
              },
            });
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            log.error('MCP tool call failed', { tool: toolName, error: errMsg });
            functionResponses.push({
              name: toolName,
              response: {
                error: errMsg,
                is_error: true,
              },
            });
          }
        }

        // Store function results in history
        conversationRef.current.push({
          role: 'user',
          parts: functionResponses.map((fr) => ({
            functionResponse: { name: fr.name, response: fr.response },
          })),
        });

        // Send function results back to Gemini
        response = await chat.sendMessage({
          message: functionResponses.map((fr) => ({
            functionResponse: { name: fr.name, response: fr.response },
          })),
        });
      }

      // Store the final model response in history
      if (response.text) {
        conversationRef.current.push({
          role: 'model',
          parts: [{ text: response.text }],
        });
        appendMessage('assistant', response.text);
      }

      if (rounds >= MAX_TOOL_ROUNDS) {
        appendMessage('error', 'Reached the maximum number of tool-calling rounds.');
      }
    } catch (err) {
      // Invalidate chat so the next message recreates it with clean state
      chatRef.current = null;
      chatToolsKeyRef.current = '';
      const message = err instanceof Error ? err.message : String(err);
      log.error('sendMessage failed', { error: message });
      appendMessage('error', `Error: ${message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [appendMessage, isConnected, apiKey, tools]);

  // ---------------------------------------------------------------------------
  // AppState lifecycle – pause / resume on background / foreground
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      async (nextState: AppStateStatus) => {
        const prevState = appStateRef.current;
        appStateRef.current = nextState;

        if (
          prevState === 'active' &&
          (nextState === 'background' || nextState === 'inactive')
        ) {
          log.info('App backgrounded – pausing streams.');
        } else if (
          (prevState === 'background' || prevState === 'inactive') &&
          nextState === 'active'
        ) {
          log.info('App foregrounded – attempting stream resume.');

          for (const server of serversRef.current) {
            if (server.status !== 'connected') continue;
            const runtime = runtimesRef.current.get(server.config.id);
            if (!runtime?.transport) continue;

            try {
              if (runtime.resumptionToken) {
                await runtime.transport.resumeStream(runtime.resumptionToken, {
                  onresumptiontoken: (token) => {
                    runtime.resumptionToken = token;
                  },
                });
                log.info('Stream resumed', { id: server.config.id });
              } else {
                await connectServer(server.config.id);
              }
            } catch (err) {
              log.warn('Resume failed, reconnecting', { id: server.config.id, error: err });
              await connectServer(server.config.id);
            }
          }
        }
      },
    );

    return () => {
      subscription.remove();
    };
  }, [connectServer]);

  // ---------------------------------------------------------------------------
  // Cleanup on unmount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      for (const serverId of runtimesRef.current.keys()) {
        cleanupRuntime(serverId);
      }
    };
  }, [cleanupRuntime]);

  return {
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
  };
}
