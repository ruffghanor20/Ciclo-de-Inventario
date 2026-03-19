import { db, uuid } from './database';
import {
  calculateNextCountDate,
  CurvaABC,
  normalizeCurvaABC,
  todayIsoDate,
} from '../utils/countSchedule';

export interface StockItem {
  id: string;
  codigo: string;
  descricao: string;
  categoria: string;
  unidade: string;
  localizacao: string;
  saldo_sistema: number;
  estoque_minimo: number;
  custo_ajuste: number;
  data_contado: string | null;
  curva_abc: CurvaABC;
  proxima_contagem: string | null;
  ativo: number;
  created_at: string;
  updated_at: string;
}

export type StockItemInput = {
  codigo: string;
  descricao: string;
  categoria?: string;
  unidade?: string;
  localizacao?: string;
  saldo_sistema?: number;
  estoque_minimo?: number;
  custo_ajuste?: number;
  data_contado?: string | null;
  curva_abc?: CurvaABC | string;
  proxima_contagem?: string | null;
};

export function normalizeCodigo(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  // Excel often converts numeric codes to values like "12345.0"
  if (/^\d+\.0+$/.test(raw)) {
    return raw.replace(/\.0+$/, '');
  }

  return raw;
}

export function getAllItems(search?: string, categoria?: string): StockItem[] {
  if (search) {
    const q = `%${search.toUpperCase()}%`;
    return db.getAllSync<StockItem>(
      `SELECT * FROM stock_items WHERE ativo = 1 
       AND (UPPER(codigo) LIKE ? OR UPPER(descricao) LIKE ?) 
       ORDER BY descricao LIMIT 5000`,
      [q, q]
    );
  }
  if (categoria) {
    return db.getAllSync<StockItem>(
      `SELECT * FROM stock_items WHERE ativo = 1 AND categoria = ? ORDER BY descricao LIMIT 5000`,
      [categoria]
    );
  }
  return db.getAllSync<StockItem>(
    `SELECT * FROM stock_items WHERE ativo = 1 ORDER BY descricao LIMIT 5000`
  );
}

export function getItemByCode(codigo: string): StockItem | null {
  const normalized = normalizeCodigo(codigo);
  if (!normalized) return null;

  const direct = db.getFirstSync<StockItem>(
    `SELECT * FROM stock_items WHERE codigo = ? AND ativo = 1`,
    [normalized]
  );
  if (direct) return direct;

  // Backward compatibility for legacy imports that stored codes like "123.0"
  return db.getFirstSync<StockItem>(
    `SELECT * FROM stock_items WHERE codigo = ? AND ativo = 1`,
    [`${normalized}.0`]
  ) ?? null;
}

export function createItem(data: StockItemInput): StockItem {
  const now = new Date().toISOString();
  const id = uuid();
  const codigo = normalizeCodigo(data.codigo);

  if (!codigo) {
    throw new Error('Código inválido para cadastro do item.');
  }

  const curvaAbc = normalizeCurvaABC(data.curva_abc);
  const dataContado = data.data_contado ?? null;
  const proximaContagem = data.proxima_contagem ?? (dataContado ? calculateNextCountDate(dataContado, curvaAbc) : null);

  db.runSync(
    `INSERT INTO stock_items (id, codigo, descricao, categoria, unidade, localizacao, saldo_sistema, estoque_minimo, custo_ajuste, data_contado, curva_abc, proxima_contagem, ativo, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [id, codigo, data.descricao, data.categoria, data.unidade,
      data.localizacao ?? '', data.saldo_sistema ?? 0, data.estoque_minimo ?? 0, data.custo_ajuste ?? 0,
      dataContado, curvaAbc, proximaContagem, now, now]
  );
  return getItemByCode(codigo)!;
}

export function updateItem(id: string, data: Partial<StockItem>): void {
  const current = db.getFirstSync<StockItem>(`SELECT * FROM stock_items WHERE id = ?`, [id]);
  if (!current) return;

  const now = new Date().toISOString();
  const curvaAbc = normalizeCurvaABC(data.curva_abc ?? current.curva_abc);
  const dataContado = data.data_contado !== undefined ? data.data_contado : (current.data_contado ?? null);
  const proximaContagem =
    data.proxima_contagem !== undefined
      ? data.proxima_contagem
      : dataContado
        ? calculateNextCountDate(dataContado, curvaAbc)
        : null;

  db.runSync(
    `UPDATE stock_items SET descricao=?, categoria=?, unidade=?, localizacao=?, 
     saldo_sistema=?, estoque_minimo=?, custo_ajuste=?, data_contado=?, curva_abc=?, proxima_contagem=?, updated_at=? WHERE id=?`,
    [
      data.descricao ?? current.descricao,
      data.categoria ?? current.categoria,
      data.unidade ?? current.unidade,
      data.localizacao ?? current.localizacao,
      data.saldo_sistema ?? current.saldo_sistema,
      data.estoque_minimo ?? current.estoque_minimo,
      data.custo_ajuste ?? current.custo_ajuste,
      dataContado,
      curvaAbc,
      proximaContagem,
      now,
      id,
    ]
  );
}

export function deleteItem(id: string): void {
  db.runSync(`UPDATE stock_items SET ativo = 0, updated_at = ? WHERE id = ?`,
    [new Date().toISOString(), id]);
}

export function getCategories(): string[] {
  const rows = db.getAllSync<{ categoria: string }>(
    `SELECT DISTINCT categoria FROM stock_items WHERE ativo = 1 AND categoria != '' ORDER BY categoria`
  );
  return rows.map((r) => r.categoria);
}

export function getTotalItems(): number {
  const r = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM stock_items WHERE ativo = 1');
  return r?.count ?? 0;
}

export function getLowStockItems(): StockItem[] {
  return db.getAllSync<StockItem>(
    `SELECT * FROM stock_items WHERE ativo = 1 AND saldo_sistema <= estoque_minimo AND estoque_minimo > 0 ORDER BY saldo_sistema ASC LIMIT 20`
  );
}

export function markItemAsCounted(codigo: string, countedIsoDate = todayIsoDate()): void {
  const item = getItemByCode(codigo);
  if (!item) return;

  const now = new Date().toISOString();
  const curva = normalizeCurvaABC(item.curva_abc);
  const proximaContagem = calculateNextCountDate(countedIsoDate, curva);

  db.runSync(
    `UPDATE stock_items SET data_contado = ?, proxima_contagem = ?, updated_at = ? WHERE id = ?`,
    [countedIsoDate, proximaContagem, now, item.id]
  );
}

export function getScheduledItems(): StockItem[] {
  return db
    .getAllSync<StockItem>(
      `SELECT * FROM stock_items WHERE ativo = 1 ORDER BY proxima_contagem ASC, descricao ASC`
    )
    .filter((item: StockItem) => Boolean(item.proxima_contagem));
}
