import { db, uuid } from './database';

export interface Session {
  id: string;
  nome: string;
  responsavel: string;
  status: string;
  data_inicio: string;
  data_fim: string | null;
  created_at: string;
}

export interface SessionWithStats extends Session {
  total_contagens: number;
}

export function getAllSessions(): Session[] {
  return db.getAllSync<Session>(
    `SELECT * FROM inventory_sessions ORDER BY created_at DESC`
  );
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
  return db.getFirstSync<Session>(
    `SELECT * FROM inventory_sessions WHERE status = 'aberta' ORDER BY created_at DESC`
  ) ?? null;
}

export function getSessionById(id: string): Session | null {
  return db.getFirstSync<Session>(
    `SELECT * FROM inventory_sessions WHERE id = ?`, [id]
  ) ?? null;
}

export function createSession(nome: string, responsavel: string = 'Operador'): Session {
  const now = new Date().toISOString();
  const id = uuid();
  db.runSync(
    `INSERT INTO inventory_sessions (id, nome, responsavel, status, data_inicio, created_at) VALUES (?, ?, ?, 'aberta', ?, ?)`,
    [id, nome, responsavel, now, now]
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
  db.withTransactionSync(() => {
    db.runSync(`DELETE FROM count_entries WHERE session_id = ?`, [id]);
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
