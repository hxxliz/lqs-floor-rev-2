import type { DesktopApi } from './shared';

declare module '*.css';

declare global {
  interface Window {
    cuttingFloor: DesktopApi;
  }
}

export {};
