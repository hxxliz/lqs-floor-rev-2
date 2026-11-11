import { mkdir } from 'node:fs/promises';
import type { StudioPreferences } from './shared';

const folderKeys = ['libraryPath', 'downloadPath', 'exportPath'] as const;

export async function ensurePreferenceFolders(preferences: StudioPreferences, fallback?: StudioPreferences) {
  const resolved = { ...preferences };
  for (const key of folderKeys) {
    try {
      await mkdir(resolved[key], { recursive: true });
    } catch (error) {
      if (!fallback) throw error;
      resolved[key] = fallback[key];
      await mkdir(resolved[key], { recursive: true });
    }
  }
  return resolved;
}
