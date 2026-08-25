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

export function normalizeMaterialCode(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

export function upsertBlendMaterial(codigoRaw: unknown, descricaoRaw: unknown, tipo: MaterialTipo): BlendMaterial | null {
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
  const q = normalizeMaterialCode(query);
  if (!q) return db.getAllSync<BlendMaterial>(
    `SELECT * FROM blend_materials WHERE tipo = ? ORDER BY codigo ASC LIMIT ${limit}`,
    [tipo]
  );
  return db.getAllSync<BlendMaterial>(
    `SELECT * FROM blend_materials WHERE tipo = ? AND (UPPER(codigo) LIKE ? OR UPPER(descricao) LIKE ?) ORDER BY codigo ASC LIMIT ${limit}`,
    [tipo, `%${q}%`, `%${q}%`]
  );
}

export function getBlendMaterialCount(): number {
  return db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM blend_materials')?.count ?? 0;
}

export function createBlendCount(payload: NewBlendCount): BlendCount {
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
  return db.getAllSync<BlendCount>(
    `SELECT * FROM blend_counts WHERE session_id = ? ORDER BY created_at DESC`,
    [sessionId]
  );
}

export function getBlendCountsByMachine(sessionId: string, maquina: string): BlendCount[] {
  return db.getAllSync<BlendCount>(
    `SELECT * FROM blend_counts WHERE session_id = ? AND maquina = ? ORDER BY created_at DESC`,
    [sessionId, maquina]
  );
}

export function deleteBlendCount(id: string): void {
  db.runSync(`DELETE FROM blend_counts WHERE id = ?`, [id]);
}
