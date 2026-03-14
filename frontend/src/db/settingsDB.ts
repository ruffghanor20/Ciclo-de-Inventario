import { db } from './database';

const USERNAME_KEY = 'username';

export function getUsername(): string {
  const row = db.getFirstSync<{ value: string }>(
    `SELECT value FROM app_settings WHERE key = ?`,
    [USERNAME_KEY]
  );
  return String(row?.value ?? '').trim();
}

export function saveUsername(value: string): void {
  const normalized = value.trim();
  db.runSync(
    `INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)`,
    [USERNAME_KEY, normalized, new Date().toISOString()]
  );
}
