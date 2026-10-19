import type { z } from 'zod';

export type StorageIssue = 'unavailable' | 'corrupt' | null;
export type StorageAccess = () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export const browserStorage: StorageAccess = () => window.localStorage;

export function readStored<T>(access: StorageAccess, key: string, schema: z.ZodType<T>) {
  try {
    const raw = access().getItem(key);
    if (raw === null) return { value: null, issue: null } as const;
    const parsed = schema.safeParse(JSON.parse(raw) as unknown);
    if (parsed.success) return { value: parsed.data, issue: null } as const;
  } catch (error) {
    if (!(error instanceof SyntaxError)) return { value: null, issue: 'unavailable' } as const;
  }
  writeStored(access, key, null);
  return { value: null, issue: 'corrupt' } as const;
}

export function writeStored(access: StorageAccess, key: string, value: unknown): StorageIssue {
  try {
    if (value === null) access().removeItem(key);
    else access().setItem(key, JSON.stringify(value));
    return null;
  } catch {
    return 'unavailable';
  }
}
