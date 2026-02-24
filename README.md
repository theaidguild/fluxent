# Fluxent

A React Native (Expo) mobile agentic AI app powered by **Google Gemini** and the **Model Context Protocol (MCP)**. Connect to any remote MCP server over Streamable HTTP, and let Fluxent autonomously invoke server-side tools — all from your phone.

---

## Features

- **Multi-server support** — Add, connect, and manage multiple MCP servers simultaneously.
- **Streamable HTTP transport** — Uses the MCP SDK's `StreamableHTTPClientTransport` with SSE streaming, automatic reconnection, and resumption tokens.
- **Google Gemini integration** — Conversations are powered by Gemini 2.5 Flash with full function-calling support.
- **Agentic tool-calling loop** — Gemini autonomously calls MCP tools, interprets results, and continues reasoning (up to 10 rounds per message).
- **Streamed responses** — LLM output is streamed token-by-token into chat bubbles in real time.
- **Tool mention autocomplete** — Type `#` in the chat input to browse and insert available tools by name.
- **Session debug log** — A dedicated Session tab shows a colour-coded timeline of every user message, tool request/response, and LLM response.
- **Markdown rendering** — Assistant replies are rendered with full Markdown support (headings, code blocks, tables, lists, etc.).
- **Persistent settings** — API key and server configurations are saved to `AsyncStorage` and restored on launch.
- **Background/foreground lifecycle** — Streams are paused when the app is backgrounded and resumed (with the last event ID) when foregrounded.
- **Structured logging** — A scoped, levelled logger buffers the last 500 entries for in-app inspection.

---

## Screenshots

| Chat | Session Log | Settings |
|------|------------|----------|
| _Chat with an MCP server_ | _Debug timeline of tool calls_ | _Manage servers & API key_ |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Expo](https://expo.dev) ~54 / React Native 0.81 |
| Language | TypeScript 5.9 (strict mode) |
| LLM | [Google Gemini](https://ai.google.dev/) via `@google/genai` |
| MCP | `@modelcontextprotocol/sdk` (Streamable HTTP Client) |
| Storage | `@react-native-async-storage/async-storage` |
| UI | React Native core components, `@expo/vector-icons` (Ionicons), `react-native-markdown-display` |
| Streaming polyfills | `web-streams-polyfill`, `react-native-fetch-api` |

---

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npx expo`)
- A **Google Gemini API key** — get one at [Google AI Studio](https://aistudio.google.com/apikey)
- A running **MCP server** accessible over HTTP(S) that supports Streamable HTTP transport

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/theaidguild/mobile-mcp-client.git
cd mobile-mcp-client
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the Expo development server

```bash
npm start
```

This launches `expo start -c` (cache-cleared). From there you can:

- Press **i** to open the iOS Simulator
- Press **a** to open the Android Emulator
- Scan the QR code with [Expo Go](https://expo.dev/go) on a physical device

### 4. Configure the app

1. Open the **Settings** tab.
2. Paste your **Gemini API key**.
3. Tap **+** to add an MCP server (give it a name and its URL, e.g. `https://your-server.example.com/mcp`).
4. Tap the ▶️ button to connect.
5. Switch to the **Chat** tab and start chatting!

---

## Available Scripts

| Command | Description |
|---------|------------|
| `npm start` | Start the Expo dev server (cache-cleared) |
| `npm run ios` | Start on iOS Simulator |
| `npm run android` | Start on Android Emulator |
| `npm run web` | Start in a web browser |
| `npm run typecheck` | Run TypeScript type checking (`tsc --noEmit`) |

---

## Project Structure

```
├── App.tsx                          # Root component — tab navigation (Chat, Session, Settings)
├── index.ts                         # Entry point — loads polyfills & registers the app
├── app.json                         # Expo configuration
├── metro.config.js                  # Metro bundler config (enables package exports)
├── tsconfig.json                    # TypeScript configuration
├── src/
│   ├── polyfills.ts                 # Web Streams, TextDecoderStream & fetch polyfills
│   ├── components/
│   │   ├── ChatView.tsx             # Chat UI with message bubbles & Markdown rendering
│   │   ├── SessionView.tsx          # Debug log timeline for the current session
│   │   ├── SettingsView.tsx         # Server management & API key configuration
│   │   └── ToolMentionInput.tsx     # Chat input with #tool autocomplete
│   ├── hooks/
│   │   └── useMCPClient.ts          # Core hook — MCP connections, Gemini chat, tool-calling loop
│   ├── services/
│   │   ├── geminiService.ts         # Gemini SDK wrapper & MCP-to-Gemini tool conversion
│   │   ├── logger.ts               # Scoped, levelled logging service with in-memory buffer
│   │   └── sessionService.ts       # Chat session debug log management
│   └── types/
│       └── react-native-fetch-api.d.ts  # Type declarations for react-native-fetch-api
└── assets/                          # App icons & splash screen images
```

---

## How It Works

### MCP Connection

The app creates an MCP `Client` that connects to remote servers using `StreamableHTTPClientTransport`. The transport is configured with a custom fetch wrapper (`react-native-fetch-api`) that enables `ReadableStream` on React Native's Hermes engine. Once connected, the app fetches the server's tool list and makes them available to Gemini.

### Agentic Loop

When the user sends a message:

1. The message is sent to **Gemini** along with declared tool schemas.
2. If Gemini responds with **function calls**, each call is routed to the appropriate MCP server.
3. Tool results are sent back to Gemini, which may make further tool calls or produce a final text response.
4. This loop continues for up to **10 rounds** per user message.
5. All text responses are **streamed** to the UI token-by-token.

### Polyfills

React Native (Hermes) lacks the Web Streams API and `TextDecoderStream`. The app patches these globals at startup via `polyfills.ts` so the MCP SDK and Gemini SDK work transparently:

- `ReadableStream`, `TransformStream`, `WritableStream` from `web-streams-polyfill`
- `TextDecoderStream` custom polyfill built on Hermes's native `TextDecoder`
- Global `fetch` replaced with `react-native-fetch-api` for `response.body` streaming

---

## Configuration Notes

### iOS Local Networking

The Expo config includes `NSAllowsLocalNetworking` in `NSAppTransportSecurity`, which allows connecting to MCP servers on your local network (e.g. `http://192.168.x.x:3000/mcp`) during development.

### Metro Package Exports

`metro.config.js` enables `unstable_enablePackageExports` so that the MCP SDK's conditional `exports` field resolves correctly in the React Native bundler.

---

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

---

## License

This project is open source. See the repository for license details.