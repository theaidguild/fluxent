/**
 * geminiService.ts
 *
 * Wrapper around the Google GenAI SDK for Gemini.
 * Converts MCP tool definitions to Gemini function declarations and provides
 * a helper to create a configured chat session.
 */

import { GoogleGenAI, Type, FunctionDeclaration, Content } from '@google/genai';
import { createLogger } from './logger';

// Re-export for convenience
export type { Content };

const log = createLogger('Gemini');

const DEFAULT_MODEL = 'gemini-2.5-flash';

const SYSTEM_PROMPT =
  'You are a helpful AI assistant running inside a mobile MCP client app. ' +
  'You have access to tools provided by a connected MCP (Model Context Protocol) server. ' +
  'Use these tools whenever they can help answer the user\'s questions or accomplish their tasks. ' +
  'When you call a tool, briefly explain what you are doing and why. ' +
  'When you receive the results of a tool call, interpret and summarize the information clearly for the user. ' +
  'Format your responses using Markdown for readability: use headings, bullet points, code blocks, and bold text where appropriate. ' +
  'Always provide complete, well-structured answers rather than raw data dumps. ' +
  'If a tool returns an error, explain the issue and suggest alternatives when possible.';

// ---------------------------------------------------------------------------
// Convert MCP JSON Schema type strings to Gemini Type enum
// ---------------------------------------------------------------------------

function jsonSchemaTypeToGemini(jsonType?: string): Type | undefined {
  switch (jsonType) {
    case 'string':
      return Type.STRING;
    case 'number':
      return Type.NUMBER;
    case 'integer':
      return Type.INTEGER;
    case 'boolean':
      return Type.BOOLEAN;
    case 'array':
      return Type.ARRAY;
    case 'object':
      return Type.OBJECT;
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Convert a JSON Schema property to Gemini Schema format
// ---------------------------------------------------------------------------

function convertSchemaProperty(prop: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};

  const geminiType = jsonSchemaTypeToGemini(prop.type);
  if (geminiType) {
    result.type = geminiType;
  }

  if (prop.description) {
    result.description = prop.description;
  }

  if (prop.enum) {
    result.enum = prop.enum;
  }

  // Handle array items
  if (prop.type === 'array' && prop.items) {
    result.items = convertSchemaProperty(prop.items);
  }

  // Handle nested object properties
  if (prop.type === 'object' && prop.properties) {
    result.properties = {};
    for (const [key, value] of Object.entries(prop.properties)) {
      result.properties[key] = convertSchemaProperty(value as Record<string, any>);
    }
    if (prop.required) {
      result.required = prop.required;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Convert MCP tools → Gemini function declarations
// ---------------------------------------------------------------------------

export function mcpToolsToGeminiFunctions(
  mcpTools: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }>,
): FunctionDeclaration[] {
  return mcpTools.map((t) => {
    const schema = t.inputSchema ?? { type: 'object', properties: {} };
    const parameters = convertSchemaProperty(schema as Record<string, any>);

    return {
      name: t.name,
      description: t.description ?? '',
      parameters,
    };
  });
}

// ---------------------------------------------------------------------------
// Create a Gemini chat session with tools
// ---------------------------------------------------------------------------

export function createGeminiChat(params: {
  apiKey: string;
  tools: FunctionDeclaration[];
  history?: Content[];
  model?: string;
}) {
  const genai = new GoogleGenAI({ apiKey: params.apiKey });

  const config: Record<string, any> = {
    systemInstruction: SYSTEM_PROMPT,
  };

  if (params.tools.length > 0) {
    config.tools = [{ functionDeclarations: params.tools }];
  }

  if (params.history && params.history.length > 0) {
    config.history = params.history;
  }

  log.debug('Creating chat session', {
    model: params.model ?? DEFAULT_MODEL,
    toolCount: params.tools.length,
    historyLength: params.history?.length ?? 0,
  });

  return genai.chats.create({
    model: params.model ?? DEFAULT_MODEL,
    config,
  });
}
