declare module 'react-native-fetch-api' {
  export function fetch(url: string | URL, init?: RequestInit & { reactNative?: { textStreaming?: boolean } }): Promise<Response>;
}
