import type { DatabaseAdapter } from './database.types';

// Platform-specific database implementations:
// - database.native.ts -> SQLite (iOS + Android)
// - database.web.ts    -> In-memory store (Web preview)
// This file is only a fallback and should not be reached in normal builds.

export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const fallbackDb: DatabaseAdapter = {
  execSync(): void {},
  withTransactionSync(fn: () => void): void { fn(); },
  runSync(): { changes: number } { return { changes: 0 }; },
  getFirstSync<T>(): T | null { return null; },
  getAllSync<T>(): T[] { return []; },
};

export const db: DatabaseAdapter = fallbackDb;
export function openDatabase(): DatabaseAdapter { return db; }
export function initDatabase(_: DatabaseAdapter): void {}
export function seedDemoData(_: DatabaseAdapter): void {}
