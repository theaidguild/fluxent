/**
 * useMCPClient.ts
 *
 * A React hook that manages the lifecycle of an MCP (Model Context Protocol)
 * client over Streamable HTTP transport.  It handles:
 *
 *  - Connecting / disconnecting to a remote MCP server
 *  - AppState lifecycle: pausing when the app goes to the background and
 *    resuming (with the Last-Event-ID resumption token) when it comes back
 *  - Exposing the list of available tools from the server
 *  - A `sendMessage` helper that routes a user prompt through the MCP client
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

export interface UseMCPClientReturn {
  /** Current connection status */
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  /** Human-readable error message when status === 'error' */
  errorMessage: string | null;
  /** Available tools reported by the MCP server */
  tools: MCPTool[];
  /** Chat message history */
  messages: MCPMessage[];
  /** Whether the AI is currently processing a response */
  isProcessing: boolean;
  /** Gemini API key */
  apiKey: string;
  /** Set the Gemini API key */
  setApiKey: (key: string) => void;
  /** Connect to the given server URL */
  connect: (serverUrl: string) => Promise<void>;
  /** Disconnect from the current server */
  disconnect: () => Promise<void>;
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

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useMCPClient(): UseMCPClientReturn {
  const [status, setStatus] = useState<UseMCPClientReturn['status']>('disconnected');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [messages, setMessages] = useState<MCPMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [apiKey, setApiKey] = useState('');

  // Stable refs so callbacks always see the latest values without re-subscribing
  const clientRef = useRef<Client | null>(null);
  const transportRef = useRef<StreamableHTTPClientTransport | null>(null);
  const serverUrlRef = useRef<string>('');
  /** Last resumption token received from the server (for reconnection) */
  const resumptionTokenRef = useRef<string | undefined>(undefined);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  /** Full tool definitions from the MCP server (needed for AI tool calling) */
  const toolDefsRef = useRef<MCPTool[]>([]);
  /** Conversation history in Gemini Content format */
  const conversationRef = useRef<Content[]>([]);

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  const appendMessage = useCallback((role: MCPMessage['role'], content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role, content, timestamp: new Date() },
    ]);
  }, []);

  const cleanupTransport = useCallback(async () => {
    try {
      if (clientRef.current) {
        await clientRef.current.close();
      }
    } catch {
      // ignore close errors
    }
    clientRef.current = null;
    transportRef.current = null;
    resumptionTokenRef.current = undefined;
  }, []);

  // ---------------------------------------------------------------------------
  // refreshTools – fetch the tool list from the connected server
  // ---------------------------------------------------------------------------

  const refreshTools = useCallback(async (client: Client) => {
    try {
      const result = await client.listTools();
      const fullTools = (result.tools ?? []).map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema as Record<string, unknown>,
      }));
      toolDefsRef.current = fullTools;
      setTools(fullTools);
    } catch (err) {
      log.warn('Could not list tools', err);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // connect
  // ---------------------------------------------------------------------------

  const connect = useCallback(async (serverUrl: string) => {
    if (!serverUrl.trim()) {
      setErrorMessage('Server URL must not be empty.');
      setStatus('error');
      return;
    }

    // Tear down any existing connection first
    await cleanupTransport();

    setStatus('connecting');
    setErrorMessage(null);
    serverUrlRef.current = serverUrl;
    log.info('Connecting to server', { url: serverUrl });

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

      clientRef.current = client;
      transportRef.current = transport;

      setStatus('connected');
      log.info('Connected successfully');

      // Immediately fetch available tools to populate the UI
      await refreshTools(client);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error('Connection failed', { error: message });
      setErrorMessage(message);
      setStatus('error');
      clientRef.current = null;
      transportRef.current = null;
    }
  }, [cleanupTransport, refreshTools]);

  // ---------------------------------------------------------------------------
  // disconnect
  // ---------------------------------------------------------------------------

  const disconnect = useCallback(async () => {
    log.info('Disconnecting');
    await cleanupTransport();
    setStatus('disconnected');
    setErrorMessage(null);
    setTools([]);
    toolDefsRef.current = [];
    conversationRef.current = [];
  }, [cleanupTransport]);

  // ---------------------------------------------------------------------------
  // sendMessage – agentic loop: user → Gemini → (function calls) → Gemini → …
  // ---------------------------------------------------------------------------

  /** Maximum number of tool-calling rounds to prevent runaway loops */
  const MAX_TOOL_ROUNDS = 10;

  const sendMessage = useCallback(async (text: string) => {
    appendMessage('user', text);

    if (!clientRef.current || status !== 'connected') {
      appendMessage('error', 'Not connected to an MCP server.');
      return;
    }

    if (!apiKey.trim()) {
      appendMessage('error', 'Please set your Gemini API key in the Settings tab.');
      return;
    }

    const geminiFunctions = mcpToolsToGeminiFunctions(toolDefsRef.current);

    setIsProcessing(true);
    try {
      // Create a new chat session with the full conversation history
      const chat = createGeminiChat({
        apiKey,
        tools: geminiFunctions,
        history: conversationRef.current,
      });

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
          parts: functionCalls.map((fc) => ({
            functionCall: { name: fc.name, args: fc.args },
          })),
        });

        // Execute each function call via MCP
        const functionResponses: Array<{
          name: string;
          response: Record<string, unknown>;
        }> = [];

        for (const fc of functionCalls) {
          const toolName = fc.name ?? 'unknown';
          appendMessage('assistant', `\uD83D\uDD27 Calling tool: **${toolName}**`);

          try {
            log.debug('Calling MCP tool', { tool: toolName, args: fc.args });
            const mcpResult = await clientRef.current!.callTool({
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
      const message = err instanceof Error ? err.message : String(err);
      log.error('sendMessage failed', { error: message });
      appendMessage('error', `Error: ${message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [appendMessage, status, apiKey]);

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
          // App is going to the background – pausing stream.
          log.info('App backgrounded – pausing stream.');
        } else if (
          (prevState === 'background' || prevState === 'inactive') &&
          nextState === 'active'
        ) {
          // App returned to the foreground – try to resume the stream
          log.info('App foregrounded – attempting stream resume.');
          const transport = transportRef.current;
          const url = serverUrlRef.current;

          if (transport && url) {
            try {
              if (resumptionTokenRef.current) {
                // Resume from last known event position
                await transport.resumeStream(resumptionTokenRef.current, {
                  onresumptiontoken: (token) => {
                    resumptionTokenRef.current = token;
                  },
                });
                log.info('Stream resumed with resumption token.');
              } else {
                // No token available – perform a fresh reconnect
                await connect(url);
              }
            } catch (err) {
              log.warn('Resume failed, reconnecting from scratch', err);
              await connect(url);
            }
          }
        }
      },
    );

    return () => {
      subscription.remove();
    };
  }, [connect]);

  // ---------------------------------------------------------------------------
  // Cleanup on unmount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      cleanupTransport();
    };
  }, [cleanupTransport]);

  return {
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
  };
}
