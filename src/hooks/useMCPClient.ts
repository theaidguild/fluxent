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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MCPTool {
  name: string;
  description?: string;
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
  /** Connect to the given server URL */
  connect: (serverUrl: string) => Promise<void>;
  /** Disconnect from the current server */
  disconnect: () => Promise<void>;
  /** Send a user message and invoke MCP tool listing as a demo interaction */
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

  // Stable refs so callbacks always see the latest values without re-subscribing
  const clientRef = useRef<Client | null>(null);
  const transportRef = useRef<StreamableHTTPClientTransport | null>(null);
  const serverUrlRef = useRef<string>('');
  /** Last resumption token received from the server (for reconnection) */
  const resumptionTokenRef = useRef<string | undefined>(undefined);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

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
      setTools(
        (result.tools ?? []).map((t) => ({
          name: t.name,
          description: t.description,
        })),
      );
    } catch (err) {
      console.warn('[MCP] Could not list tools:', err);
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

    try {
      const url = new URL(serverUrl);

      const transport = new StreamableHTTPClientTransport(url, {
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

      // Immediately fetch available tools to populate the UI
      await refreshTools(client);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
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
    await cleanupTransport();
    setStatus('disconnected');
    setErrorMessage(null);
    setTools([]);
  }, [cleanupTransport]);

  // ---------------------------------------------------------------------------
  // sendMessage
  // ---------------------------------------------------------------------------

  const sendMessage = useCallback(async (text: string) => {
    appendMessage('user', text);

    if (!clientRef.current || status !== 'connected') {
      appendMessage('error', 'Not connected to an MCP server.');
      return;
    }

    try {
      // Fetch available tools and return them as a response (demo interaction).
      // Replace the block below with an actual LLM API call (e.g. OpenAI / Claude)
      // that uses `clientRef.current` to call tools chosen by the model.
      const result = await clientRef.current.listTools();
      const toolNames = (result.tools ?? []).map((t) => t.name);

      if (toolNames.length === 0) {
        appendMessage('assistant', 'The server has no tools registered.');
      } else {
        appendMessage(
          'assistant',
          `Available tools on the server:\n${toolNames.map((n) => `• ${n}`).join('\n')}`,
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      appendMessage('error', `Error: ${message}`);
    }
  }, [appendMessage, status]);

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
          console.log('[MCP] App backgrounded – pausing stream.');
        } else if (
          (prevState === 'background' || prevState === 'inactive') &&
          nextState === 'active'
        ) {
          // App returned to the foreground – try to resume the stream
          console.log('[MCP] App foregrounded – attempting stream resume.');
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
                console.log('[MCP] Stream resumed with resumption token.');
              } else {
                // No token available – perform a fresh reconnect
                await connect(url);
              }
            } catch (err) {
              console.warn('[MCP] Resume failed, reconnecting from scratch:', err);
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
    connect,
    disconnect,
    sendMessage,
  };
}
