// WebGL Context Tracker for diagnostics and lifecycle verification

declare global {
  interface Window {
    __ACTIVE_WEBGL_CONTEXTS__?: Set<WebGLRenderingContext | WebGL2RenderingContext>;
    __GET_ACTIVE_CONTEXT_COUNT__?: () => number;
  }
}

if (typeof window !== "undefined") {
  if (!window.__ACTIVE_WEBGL_CONTEXTS__) {
    window.__ACTIVE_WEBGL_CONTEXTS__ = new Set();
  }
  window.__GET_ACTIVE_CONTEXT_COUNT__ = () => {
    if (!window.__ACTIVE_WEBGL_CONTEXTS__) return 0;
    const contexts = Array.from(window.__ACTIVE_WEBGL_CONTEXTS__);
    return contexts.filter((ctx) => !ctx.isContextLost()).length;
  };
}

export function registerWebGLContext(ctx: WebGLRenderingContext | WebGL2RenderingContext | null): void {
  if (!ctx || typeof window === "undefined") return;
  if (!window.__ACTIVE_WEBGL_CONTEXTS__) {
    window.__ACTIVE_WEBGL_CONTEXTS__ = new Set();
  }
  window.__ACTIVE_WEBGL_CONTEXTS__.add(ctx);
}

export function unregisterWebGLContext(ctx: WebGLRenderingContext | WebGL2RenderingContext | null): void {
  if (!ctx || typeof window === "undefined" || !window.__ACTIVE_WEBGL_CONTEXTS__) return;
  window.__ACTIVE_WEBGL_CONTEXTS__.delete(ctx);
}

