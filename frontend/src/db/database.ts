// Platform-specific database implementations:
// - database.native.ts → SQLite (iOS + Android)
// - database.web.ts    → In-memory store (Web preview)
// This file is only a fallback and should not be reached in normal builds.

export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const db: any = null;
export function openDatabase(): any { return null; }
export function initDatabase(_: any): void {}
export function seedDemoData(_: any): void {}
