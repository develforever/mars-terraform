import '@testing-library/jest-dom';

// Polyfill for @react-three/fiber — jsdom lacks ResizeObserver
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock;