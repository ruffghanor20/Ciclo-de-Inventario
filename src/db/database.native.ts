import * as SQLite from 'expo-sqlite';

// Auto-open and initialize on module load (fixes direct URL navigation)
export const db: SQLite.SQLiteDatabase = SQLite.openDatabaseSync('estoqueaudit.db');

export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function openDatabase(): SQLite.SQLiteDatabase {
  return db;
}

export function initDatabase(database: SQLite.SQLiteDatabase): void {
  database.execSync(`
    CREATE TABLE IF NOT EXISTS stock_items (
      id TEXT PRIMARY KEY,
      codigo TEXT UNIQUE NOT NULL,
      descricao TEXT NOT NULL,
      categoria TEXT DEFAULT '',
      unidade TEXT DEFAULT 'UN',
      localizacao TEXT DEFAULT '',
      saldo_sistema REAL DEFAULT 0,
      estoque_minimo REAL DEFAULT 0,
      custo_ajuste REAL DEFAULT 0,
      data_contado TEXT,
      curva_abc TEXT DEFAULT 'C',
      proxima_contagem TEXT,
      ativo INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // Migration for existing databases created before custo_ajuste column.
  const itemCols = database.getAllSync<{ name: string }>(`PRAGMA table_info(stock_items)`);
  const hasAdjustmentCost = itemCols.some((col) => col.name === 'custo_ajuste');
  if (!hasAdjustmentCost) {
    database.execSync(`ALTER TABLE stock_items ADD COLUMN custo_ajuste REAL DEFAULT 0`);
  }
  const hasDataContado = itemCols.some((col) => col.name === 'data_contado');
  if (!hasDataContado) {
    database.execSync(`ALTER TABLE stock_items ADD COLUMN data_contado TEXT`);
  }
  const hasCurvaAbc = itemCols.some((col) => col.name === 'curva_abc');
  if (!hasCurvaAbc) {
    database.execSync(`ALTER TABLE stock_items ADD COLUMN curva_abc TEXT DEFAULT 'C'`);
  }
  const hasProximaContagem = itemCols.some((col) => col.name === 'proxima_contagem');
  if (!hasProximaContagem) {
    database.execSync(`ALTER TABLE stock_items ADD COLUMN proxima_contagem TEXT`);
  }

  database.execSync(`
    CREATE TABLE IF NOT EXISTS inventory_sessions (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      responsavel TEXT DEFAULT '',
      status TEXT DEFAULT 'aberta',
      data_inicio TEXT NOT NULL,
      data_fim TEXT,
      created_at TEXT NOT NULL
    )
  `);

  database.execSync(`
    CREATE TABLE IF NOT EXISTS count_entries (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      item_id TEXT,
      codigo TEXT NOT NULL,
      descricao TEXT NOT NULL,
      saldo_sistema REAL DEFAULT 0,
      quantidade_contada REAL DEFAULT 0,
      diferenca REAL DEFAULT 0,
      localizacao TEXT DEFAULT '',
      observacao TEXT DEFAULT '',
      escaneado INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `);

  database.execSync(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT DEFAULT '',
      updated_at TEXT NOT NULL
    )
  `);

  database.execSync(`CREATE INDEX IF NOT EXISTS idx_items_codigo ON stock_items(codigo)`);
  database.execSync(`CREATE INDEX IF NOT EXISTS idx_counts_session ON count_entries(session_id)`);
  database.execSync(`CREATE INDEX IF NOT EXISTS idx_counts_codigo ON count_entries(codigo)`);
}

export function seedDemoData(database: SQLite.SQLiteDatabase): void {
  const count = database.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM stock_items');
  if (count && count.count > 0) return;

  const now = new Date().toISOString();

  const items = [
    { id: uuid(), codigo: '7891234567890', descricao: 'RESINA PP HOMOPOLÍMERO', categoria: 'MATÉRIA-PRIMA', unidade: 'KG', localizacao: 'A-01', saldo_sistema: 1200, estoque_minimo: 500 },
    { id: uuid(), codigo: '7891234567891', descricao: 'MASTER AZUL CONCENTRADO', categoria: 'ADITIVOS', unidade: 'KG', localizacao: 'A-02', saldo_sistema: 340, estoque_minimo: 100 },
    { id: uuid(), codigo: '7891234567892', descricao: 'ADITIVO ANTIOXIDANTE UV', categoria: 'ADITIVOS', unidade: 'KG', localizacao: 'A-03', saldo_sistema: 80, estoque_minimo: 50 },
    { id: uuid(), codigo: '7891234567893', descricao: 'PIGMENTO VERDE INDUSTRIAL', categoria: 'PIGMENTOS', unidade: 'KG', localizacao: 'B-01', saldo_sistema: 520, estoque_minimo: 200 },
    { id: uuid(), codigo: '7891234567894', descricao: 'EMBALAGEM SACO 25KG', categoria: 'EMBALAGENS', unidade: 'UN', localizacao: 'C-01', saldo_sistema: 3500, estoque_minimo: 1000 },
    { id: uuid(), codigo: '7891234567895', descricao: 'CAIXA PAPELÃO 40X60', categoria: 'EMBALAGENS', unidade: 'UN', localizacao: 'C-02', saldo_sistema: 1800, estoque_minimo: 500 },
    { id: uuid(), codigo: '7891234567896', descricao: 'FITA ADESIVA 45MM MARROM', categoria: 'EMBALAGENS', unidade: 'RL', localizacao: 'C-03', saldo_sistema: 200, estoque_minimo: 50 },
    { id: uuid(), codigo: '7891234567897', descricao: 'PALLET PLÁSTICO PBR', categoria: 'EQUIPAMENTOS', unidade: 'UN', localizacao: 'D-01', saldo_sistema: 45, estoque_minimo: 20 },
    { id: uuid(), codigo: '7891234567898', descricao: 'LUVA NITRÍLICA P', categoria: 'EPI', unidade: 'PAR', localizacao: 'E-01', saldo_sistema: 600, estoque_minimo: 200 },
    { id: uuid(), codigo: '7891234567899', descricao: 'ÓCULOS PROTEÇÃO TRANSPARENTE', categoria: 'EPI', unidade: 'UN', localizacao: 'E-02', saldo_sistema: 120, estoque_minimo: 40 },
    { id: uuid(), codigo: '7891234567900', descricao: 'CAPACETE SEGURANÇA AMARELO', categoria: 'EPI', unidade: 'UN', localizacao: 'E-03', saldo_sistema: 35, estoque_minimo: 15 },
    { id: uuid(), codigo: '7891234567901', descricao: 'TALCO INDUSTRIAL 1KG', categoria: 'MATÉRIA-PRIMA', unidade: 'KG', localizacao: 'A-04', saldo_sistema: 450, estoque_minimo: 150 },
  ];

  database.withTransactionSync(() => {
    for (const item of items) {
      database.runSync(
        `INSERT OR IGNORE INTO stock_items 
         (id, codigo, descricao, categoria, unidade, localizacao, saldo_sistema, estoque_minimo, ativo, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [item.id, item.codigo, item.descricao, item.categoria, item.unidade,
          item.localizacao, item.saldo_sistema, item.estoque_minimo, now, now]
      );
    }
  });

  // Create initial session
  const sessionId = uuid();
  database.runSync(
    `INSERT OR IGNORE INTO inventory_sessions (id, nome, responsavel, status, data_inicio, created_at) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [sessionId, 'Contagem Geral', 'Operador', 'aberta', now, now]
  );

  // Demo counts
  const counts = [
    { id: uuid(), session_id: sessionId, codigo: '7891234567890', descricao: 'RESINA PP HOMOPOLÍMERO', saldo_sistema: 1200, quantidade_contada: 1185, diferenca: -15, localizacao: 'A-01', escaneado: 1 },
    { id: uuid(), session_id: sessionId, codigo: '7891234567891', descricao: 'MASTER AZUL CONCENTRADO', saldo_sistema: 340, quantidade_contada: 340, diferenca: 0, localizacao: 'A-02', escaneado: 1 },
    { id: uuid(), session_id: sessionId, codigo: '7891234567892', descricao: 'ADITIVO ANTIOXIDANTE UV', saldo_sistema: 80, quantidade_contada: 92, diferenca: 12, localizacao: 'A-03', escaneado: 1 },
    { id: uuid(), session_id: sessionId, codigo: '7891234567894', descricao: 'EMBALAGEM SACO 25KG', saldo_sistema: 3500, quantidade_contada: 3420, diferenca: -80, localizacao: 'C-01', escaneado: 1 },
    { id: uuid(), session_id: sessionId, codigo: '7891234567898', descricao: 'LUVA NITRÍLICA P', saldo_sistema: 600, quantidade_contada: 612, diferenca: 12, localizacao: 'E-01', escaneado: 0 },
  ];

  database.withTransactionSync(() => {
    for (const c of counts) {
      database.runSync(
        `INSERT OR IGNORE INTO count_entries 
         (id, session_id, item_id, codigo, descricao, saldo_sistema, quantidade_contada, diferenca, localizacao, observacao, escaneado, created_at) 
         VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, '', ?, ?)`,
        [c.id, c.session_id, c.codigo, c.descricao, c.saldo_sistema,
          c.quantidade_contada, c.diferenca, c.localizacao, c.escaneado, now]
      );
    }
  });
}
