import { db, uuid } from './database';
import type { DatabaseAdapter } from './database.types';
import { getItemByCode, type StockItem } from './itemsDB';
import { getSessionById } from './sessionsDB';
import { parseCountQuantity, parseField } from '../utils/palletRules';

export interface PalletCount {
  id: string;
  session_id: string;
  codigo: string;
  descricao: string;
  quantidade: number;
  endereco: string;
  uc: string;
  created_at: string;
}

export function initPalletCounts(database: DatabaseAdapter): void {
  database.execSync(`CREATE TABLE IF NOT EXISTS pallet_counts (
    id TEXT PRIMARY KEY, session_id TEXT NOT NULL, codigo TEXT NOT NULL,
    descricao TEXT NOT NULL, quantidade REAL NOT NULL CHECK (quantidade >= 0),
    endereco TEXT NOT NULL, uc TEXT NOT NULL CHECK (length(uc) = 10 AND uc NOT GLOB '*[^0-9]*'),
    created_at TEXT NOT NULL, UNIQUE (session_id, uc, codigo)
  )`);
  database.execSync('CREATE INDEX IF NOT EXISTS idx_pallet_history ON pallet_counts(session_id, created_at DESC)');
  database.execSync('CREATE INDEX IF NOT EXISTS idx_stock_codigo_prefix ON stock_items(codigo COLLATE NOCASE)');
}

export function suggestMaterials(prefix: string): StockItem[] {
  const value = prefix.trim();
  if (!value) return [];
  const pattern = value.replace(/[\\%_]/g, '\\$&') + '%';
  return db.getAllSync<StockItem>(
    "SELECT * FROM stock_items WHERE ativo = 1 AND codigo LIKE ? ESCAPE '\\' ORDER BY codigo LIMIT 8",
    [pattern]
  );
}

export function listPalletCounts(sessionId: string): PalletCount[] {
  return db.getAllSync<PalletCount>(
    'SELECT * FROM pallet_counts WHERE session_id = ? ORDER BY created_at DESC',
    [sessionId]
  );
}

export function getPalletTotal(sessionId: string): number {
  return db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM pallet_counts WHERE session_id = ?', [sessionId])?.n ?? 0;
}

export function savePalletCount(input: {
  sessionId: string; codigo: string; quantidade: string; endereco: string; uc: string; editingId?: string;
}): PalletCount {
  const uc = parseField('uc', input.uc);
  const endereco = parseField('endereco', input.endereco);
  const quantidade = parseCountQuantity(input.quantidade);
  let saved!: PalletCount;
  db.withTransactionSync(() => {
    const session = getSessionById(input.sessionId);
    if (session?.status !== 'aberta') throw new Error('Esta sessão está encerrada. Abra a sessão de inventário desejada.');
    const item = getItemByCode(input.codigo);
    if (!item) throw new Error('Selecione um material cadastrado.');
    const siblings = db.getAllSync<PalletCount>('SELECT * FROM pallet_counts WHERE session_id = ? AND uc = ?', [session.id, uc]);
    for (const other of siblings) {
      if (other.id === input.editingId) continue;
      if (other.endereco !== endereco) throw new Error(`A UC ${uc} já está na posição ${other.endereco} nesta sessão.`);
      if (other.codigo === item.codigo) throw new Error('Material já contado nesta UC. Abra o histórico para corrigir a contagem.');
    }
    if (input.editingId) {
      const existing = db.getFirstSync<PalletCount>('SELECT * FROM pallet_counts WHERE session_id = ? AND id = ?', [session.id, input.editingId]);
      if (!existing) throw new Error('Contagem não encontrada nesta sessão.');
      db.runSync('UPDATE pallet_counts SET codigo = ?, descricao = ?, quantidade = ?, endereco = ?, uc = ? WHERE id = ?',
        [item.codigo, item.descricao, quantidade, endereco, uc, existing.id]);
      saved = { ...existing, codigo: item.codigo, descricao: item.descricao, quantidade, endereco, uc };
    } else {
      saved = { id: uuid(), session_id: session.id, codigo: item.codigo, descricao: item.descricao, quantidade, endereco, uc, created_at: new Date().toISOString() };
      db.runSync('INSERT INTO pallet_counts (id, session_id, codigo, descricao, quantidade, endereco, uc, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [saved.id, session.id, saved.codigo, saved.descricao, quantidade, endereco, uc, saved.created_at]);
    }
  });
  return saved;
}
