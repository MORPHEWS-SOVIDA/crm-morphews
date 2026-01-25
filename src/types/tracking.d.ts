// Global tracking pixel type declarations
// Consolidated here to avoid duplicate declarations across files

export {};

declare global {
  interface Window {
    fbq: (...args: unknown[]) => void;
    _fbq: unknown;
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
    ttq: {
      load: (id: string) => void;
      page: () => void;
      track: (event: string, data?: Record<string, unknown>) => void;
    };
  }
}
