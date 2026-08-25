import { db, uuid } from './database';

export type MaterialTipo = 'BLEND' | 'DOSADOR';
export type ModoContagem = 'BLEND' | 'DOSADOR';

export interface BlendMaterial {
  id: string;
  codigo: string;
  descricao: string;
  tipo: MaterialTipo;
  created_at: string;
}

export interface BlendCount {
  id: string;
  session_id: string;
  deposito: string;
  maquina: string;
  tipo_maquina: string;
  modo: ModoContagem;
  blend_codigo: string;
  blend_kg: number;
  comp1_codigo: string;
  comp1_kg: number;
  comp2_codigo: string;
  comp2_kg: number;
  comp3_codigo: string;
  comp3_kg: number;
  foto_uri: string;
  observacao: string;
  responsavel: string;
  created_at: string;
}

export type NewBlendCount = Omit<BlendCount, 'id' | 'created_at'>;

export function ensureBlendSchema(): void {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS blend_materials (
      id TEXT PRIMARY KEY,
      codigo TEXT NOT NULL,
      descricao TEXT NOT NULL,
      tipo TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  db.execSync(`
    CREATE TABLE IF NOT EXISTS blend_counts (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      deposito TEXT NOT NULL,
      maquina TEXT NOT NULL,
      tipo_maquina TEXT NOT NULL,
      modo TEXT NOT NULL,
      blend_codigo TEXT DEFAULT '',
      blend_kg REAL DEFAULT 0,
      comp1_codigo TEXT DEFAULT '',
      comp1_kg REAL DEFAULT 0,
      comp2_codigo TEXT DEFAULT '',
      comp2_kg REAL DEFAULT 0,
      comp3_codigo TEXT DEFAULT '',
      comp3_kg REAL DEFAULT 0,
      foto_uri TEXT DEFAULT '',
      observacao TEXT DEFAULT '',
      responsavel TEXT DEFAULT '',
      created_at TEXT NOT NULL
    )
  `);
  db.execSync(`CREATE INDEX IF NOT EXISTS idx_blend_material_codigo ON blend_materials(codigo)`);
  db.execSync(`CREATE INDEX IF NOT EXISTS idx_blend_count_session ON blend_counts(session_id)`);
  db.execSync(`CREATE INDEX IF NOT EXISTS idx_blend_count_maquina ON blend_counts(maquina)`);
}

export function normalizeMaterialCode(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

export function upsertBlendMaterial(codigoRaw: unknown, descricaoRaw: unknown, tipo: MaterialTipo): BlendMaterial | null {
  ensureBlendSchema();
  const codigo = normalizeMaterialCode(codigoRaw);
  if (!codigo) return null;
  const descricao = String(descricaoRaw ?? '').trim() || `Material ${codigo}`;
  const existing = db.getFirstSync<BlendMaterial>(
    `SELECT * FROM blend_materials WHERE codigo = ? AND tipo = ?`,
    [codigo, tipo]
  );
  const now = new Date().toISOString();
  if (existing) {
    db.runSync(`UPDATE blend_materials SET descricao = ? WHERE id = ?`, [descricao, existing.id]);
    return { ...existing, descricao };
  }
  const row: BlendMaterial = { id: uuid(), codigo, descricao, tipo, created_at: now };
  db.runSync(
    `INSERT INTO blend_materials (id, codigo, descricao, tipo, created_at) VALUES (?, ?, ?, ?, ?)`,
    [row.id, row.codigo, row.descricao, row.tipo, row.created_at]
  );
  return row;
}

export function searchBlendMaterials(query: string, tipo: MaterialTipo, limit = 8): BlendMaterial[] {
  ensureBlendSchema();
  const q = normalizeMaterialCode(query);
  if (!q) {
    return db.getAllSync<BlendMaterial>(
      `SELECT * FROM blend_materials WHERE tipo = ? ORDER BY codigo ASC LIMIT ${limit}`,
      [tipo]
    );
  }
  return db.getAllSync<BlendMaterial>(
    `SELECT * FROM blend_materials WHERE tipo = ? AND (UPPER(codigo) LIKE ? OR UPPER(descricao) LIKE ?) ORDER BY codigo ASC LIMIT ${limit}`,
    [tipo, `%${q}%`, `%${q}%`]
  );
}

export function getBlendMaterialCount(): number {
  ensureBlendSchema();
  return db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM blend_materials')?.count ?? 0;
}

export function createBlendCount(payload: NewBlendCount): BlendCount {
  ensureBlendSchema();
  const row: BlendCount = { id: uuid(), created_at: new Date().toISOString(), ...payload };
  db.runSync(
    `INSERT INTO blend_counts
    (id, session_id, deposito, maquina, tipo_maquina, modo, blend_codigo, blend_kg,
     comp1_codigo, comp1_kg, comp2_codigo, comp2_kg, comp3_codigo, comp3_kg,
     foto_uri, observacao, responsavel, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id, row.session_id, row.deposito, row.maquina, row.tipo_maquina, row.modo,
      row.blend_codigo, row.blend_kg, row.comp1_codigo, row.comp1_kg, row.comp2_codigo,
      row.comp2_kg, row.comp3_codigo, row.comp3_kg, row.foto_uri, row.observacao,
      row.responsavel, row.created_at,
    ]
  );
  return row;
}

export function getBlendCountsBySession(sessionId: string): BlendCount[] {
  ensureBlendSchema();
  return db.getAllSync<BlendCount>(
    `SELECT * FROM blend_counts WHERE session_id = ? ORDER BY created_at DESC`,
    [sessionId]
  );
}

export function getBlendCountsByMachine(sessionId: string, maquina: string): BlendCount[] {
  ensureBlendSchema();
  return db.getAllSync<BlendCount>(
    `SELECT * FROM blend_counts WHERE session_id = ? AND maquina = ? ORDER BY created_at DESC`,
    [sessionId, maquina]
  );
}

export function clearBlendPhotoUris(ids: string[]): void {
  ensureBlendSchema();
  if (!ids.length) return;
  db.withTransactionSync(() => {
    for (const id of ids) {
      db.runSync(`UPDATE blend_counts SET foto_uri = '' WHERE id = ?`, [id]);
    }
  });
}

export function deleteBlendCount(id: string): void {
  ensureBlendSchema();
  db.runSync(`DELETE FROM blend_counts WHERE id = ?`, [id]);
}
