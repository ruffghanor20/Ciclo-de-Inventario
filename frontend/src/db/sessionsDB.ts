import { db, uuid } from './database';
import { ensureBlendSchema } from './blendDB';

export interface Session {
  id: string;
  nome: string;
  responsavel: string;
  deposito: string;
  status: string;
  data_inicio: string;
  data_fim: string | null;
  created_at: string;
}

export interface SessionWithStats extends Session {
  total_contagens: number;
}

function ensureSessionSchema(): void {
  const cols = db.getAllSync<{ name: string }>(`PRAGMA table_info(inventory_sessions)`);
  if (cols.length > 0 && !cols.some((col) => col.name === 'deposito')) {
    db.execSync(`ALTER TABLE inventory_sessions ADD COLUMN deposito TEXT DEFAULT '1023'`);
  }
}

function normalizeSession(session: Session | null): Session | null {
  if (!session) return null;
  return { ...session, deposito: session.deposito || '1023' };
}

export function getAllSessions(): Session[] {
  ensureSessionSchema();
  return db.getAllSync<Session>(
    `SELECT * FROM inventory_sessions ORDER BY created_at DESC`
  ).map((session) => normalizeSession(session)!);
}

export function getAllSessionsWithStats(): SessionWithStats[] {
  const sessions = getAllSessions();
  return sessions.map((session) => {
    const total = db.getFirstSync<{ c: number }>(
      `SELECT COUNT(*) as c FROM count_entries WHERE session_id = ?`,
      [session.id]
    )?.c ?? 0;
    return { ...session, total_contagens: total };
  });
}

export function getOpenSession(): Session | null {
  ensureSessionSchema();
  return normalizeSession(db.getFirstSync<Session>(
    `SELECT * FROM inventory_sessions WHERE status = 'aberta' ORDER BY created_at DESC`
  ) ?? null);
}

export function getSessionById(id: string): Session | null {
  ensureSessionSchema();
  return normalizeSession(db.getFirstSync<Session>(
    `SELECT * FROM inventory_sessions WHERE id = ?`, [id]
  ) ?? null);
}

export function createSession(nome: string, responsavel: string = 'Operador', deposito: '1020' | '1023' = '1023'): Session {
  ensureSessionSchema();
  const now = new Date().toISOString();
  const id = uuid();
  db.runSync(
    `INSERT INTO inventory_sessions (id, nome, responsavel, deposito, status, data_inicio, created_at) VALUES (?, ?, ?, ?, 'aberta', ?, ?)`,
    [id, nome, responsavel, deposito, now, now]
  );
  return getSessionById(id)!;
}

export function closeSession(id: string): void {
  db.runSync(
    `UPDATE inventory_sessions SET status = 'fechada', data_fim = ? WHERE id = ?`,
    [new Date().toISOString(), id]
  );
}

export function loadSession(id: string): Session | null {
  const target = getSessionById(id);
  if (!target) return null;

  const now = new Date().toISOString();
  db.withTransactionSync(() => {
    db.runSync(
      `UPDATE inventory_sessions 
       SET status = 'fechada', data_fim = COALESCE(data_fim, ?)
       WHERE status = 'aberta' AND id != ?`,
      [now, id]
    );
    db.runSync(
      `UPDATE inventory_sessions SET status = 'aberta', data_fim = NULL WHERE id = ?`,
      [id]
    );
  });

  return getSessionById(id);
}

export function deleteSession(id: string): void {
  ensureBlendSchema();
  db.withTransactionSync(() => {
    db.runSync(`DELETE FROM count_entries WHERE session_id = ?`, [id]);
    db.runSync(`DELETE FROM blend_counts WHERE session_id = ?`, [id]);
    db.runSync(`DELETE FROM inventory_sessions WHERE id = ?`, [id]);
  });
}

export function ensureOpenSession(): Session {
  const open = getOpenSession();
  if (open) return open;
  const now = new Date();
  const nome = `Contagem ${now.toLocaleDateString('pt-BR')}`;
  return createSession(nome);
}
