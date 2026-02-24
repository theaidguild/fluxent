/**
 * polyfills.ts
 *
 * Must be imported at the very top of index.ts, BEFORE any other module.
 *
 * React Native (Hermes) lacks the Web Streams API and TextDecoderStream that
 * the MCP SDK's StreamableHTTPClientTransport relies on for SSE parsing.
 * This file patches the globals so the SDK works transparently.
 */

import {
  ReadableStream,
  TransformStream,
  WritableStream,
} from 'web-streams-polyfill';

// ---------------------------------------------------------------------------
// 1. Web Streams API
// ---------------------------------------------------------------------------

if (typeof globalThis.ReadableStream === 'undefined') {
  (globalThis as any).ReadableStream = ReadableStream;
}
if (typeof globalThis.TransformStream === 'undefined') {
  (globalThis as any).TransformStream = TransformStream;
}
if (typeof globalThis.WritableStream === 'undefined') {
  (globalThis as any).WritableStream = WritableStream;
}

// ---------------------------------------------------------------------------
// 2. TextDecoderStream  (built on top of Hermes's native TextDecoder)
// ---------------------------------------------------------------------------

if (typeof (globalThis as any).TextDecoderStream === 'undefined') {
  class TextDecoderStreamPolyfill {
    readonly encoding: string;
    readonly readable: ReadableStream<string>;
    readonly writable: WritableStream<BufferSource>;

    constructor(label = 'utf-8', options?: TextDecoderOptions) {
      this.encoding = label;
      const decoder = new TextDecoder(label, options);

      const ts = new TransformStream<BufferSource, string>({
        transform(chunk: BufferSource, controller: TransformStreamDefaultController<string>) {
          const text = decoder.decode(chunk as any, { stream: true });
          if (text.length > 0) controller.enqueue(text);
        },
        flush(controller: TransformStreamDefaultController<string>) {
          const text = decoder.decode();
          if (text.length > 0) controller.enqueue(text);
        },
      });

      this.readable = ts.readable;
      this.writable = ts.writable;
    }
  }

  (globalThis as any).TextDecoderStream = TextDecoderStreamPolyfill;
}
