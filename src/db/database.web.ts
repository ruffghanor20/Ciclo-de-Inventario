// Web-compatible in-memory database for preview
// Native builds use database.native.ts with SQLite

export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

type Row = Record<string, any>;

class WebDb {
  private tables: Map<string, Row[]> = new Map();

  private getTable(name: string): Row[] {
    if (!this.tables.has(name)) this.tables.set(name, []);
    return this.tables.get(name)!;
  }

  execSync(_sql: string): void {
    const m = _sql.match(/CREATE TABLE IF NOT EXISTS\s+(\w+)/i);
    if (m) this.getTable(m[1]);
  }

  withTransactionSync(fn: () => void): void { fn(); }

  runSync(sql: string, args: any[] = []): any {
    const upper = sql.trim().toUpperCase();
    if (upper.startsWith('INSERT')) return this._insert(sql, args);
    if (upper.startsWith('UPDATE')) return this._update(sql, args);
    if (upper.startsWith('DELETE')) return this._delete(sql, args);
    return { changes: 0 };
  }

  getFirstSync<T>(sql: string, args: any[] = []): T | null {
    return this.getAllSync<T>(sql, args)[0] ?? null;
  }

  getAllSync<T>(sql: string, args: any[] = []): T[] {
    return this._select<T>(sql, args);
  }

  private _splitValues(valStr: string): string[] {
    const parts: string[] = [];
    let cur = '', inStr = false;
    for (let i = 0; i < valStr.length; i++) {
      const ch = valStr[i];
      if (ch === "'" && !inStr) { inStr = true; cur += ch; }
      else if (ch === "'" && inStr) { inStr = false; cur += ch; }
      else if (ch === ',' && !inStr) { parts.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    if (cur.trim()) parts.push(cur.trim());
    return parts;
  }

  private _insert(sql: string, args: any[]): any {
    const m = sql.match(/INSERT(?:\s+OR\s+IGNORE)?\s+INTO\s+(\w+)\s*\(([^)]+)\)\s+VALUES\s*\(([^)]+)\)/i);
    if (!m) return { changes: 0 };
    const tbl = this.getTable(m[1]);
    const cols = m[2].split(',').map(c => c.trim());
    const valParts = this._splitValues(m[3]);
    const row: Row = {};
    let ai = 0;
    cols.forEach((col, i) => {
      const v = (valParts[i] ?? '?').trim();
      if (v === '?' || v === '') { row[col] = args[ai++]; }
      else if (v.toUpperCase() === 'NULL') { row[col] = null; }
      else if (v.startsWith("'") && v.endsWith("'")) { row[col] = v.slice(1, -1); }
      else if (!isNaN(Number(v))) { row[col] = Number(v); }
      else { row[col] = args[ai++]; }
    });
    const isIgnore = sql.toUpperCase().includes('OR IGNORE');
    if (isIgnore && row.id && tbl.find(r => r.id === row.id)) return { changes: 0 };
    tbl.push(row);
    return { changes: 1 };
  }

  private _update(sql: string, args: any[]): any {
    const tblMatch = sql.match(/UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+(.+)/i);
    if (!tblMatch) return { changes: 0 };
    const tbl = this.getTable(tblMatch[1]);
    const setParts = tblMatch[2].split(',').map(s => s.trim());
    const setCols: string[] = [];
    setParts.forEach(p => {
      const c = p.split(/\s*=\s*\?/)[0].trim();
      if (c) setCols.push(c);
    });
    const setArgs = args.slice(0, setCols.length);
    const whereArgs = args.slice(setCols.length);
    const pred = this._buildPred(tblMatch[3], whereArgs);
    let changes = 0;
    tbl.forEach(row => {
      if (pred(row)) {
        setCols.forEach((c, i) => { row[c] = setArgs[i]; });
        changes++;
      }
    });
    return { changes };
  }

  private _delete(sql: string, args: any[]): any {
    const m = sql.match(/DELETE\s+FROM\s+(\w+)\s+WHERE\s+(.+)/i);
    if (!m) return { changes: 0 };
    const tbl = this.getTable(m[1]);
    const pred = this._buildPred(m[2], args);
    const before = tbl.length;
    const keep = tbl.filter(r => !pred(r));
    this.tables.set(m[1], keep);
    return { changes: before - keep.length };
  }

  private _select<T>(sql: string, args: any[]): T[] {
    const m = sql.match(
      /SELECT\s+(DISTINCT\s+)?(.+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+(.+?))?(?:\s+LIMIT\s+(\d+))?$/i
    );
    if (!m) return [];
    const distinct = !!m[1];
    const cols = m[2].trim();
    let tbl = [...this.getTable(m[3])];
    if (m[4]) { tbl = tbl.filter(this._buildPred(m[4], args)); }
    if (m[5]) { tbl = this._order(tbl, m[5]); }
    if (m[6]) { tbl = tbl.slice(0, parseInt(m[6])); }

    if (cols === '*') return tbl as T[];

    const countMatch = cols.match(/COUNT\(\*\)\s+(?:AS\s+)?(\w+)/i);
    if (countMatch) return [{ [countMatch[1]]: tbl.length } as T];
    if (cols.toUpperCase().startsWith('COUNT(*)')) return [{ count: tbl.length } as T];

    if (distinct) {
      const col = cols.replace(/^DISTINCT\s+/i, '').trim();
      const seen = new Set();
      return tbl.reduce((acc, row) => {
        const v = row[col];
        if (v !== undefined && v !== '' && v !== null && !seen.has(v)) {
          seen.add(v);
          acc.push({ [col]: v } as T);
        }
        return acc;
      }, [] as T[]);
    }
    return tbl as T[];
  }

  private _buildPred(where: string, args: any[]): (row: Row) => boolean {
    where = where.trim();
    let ai = 0;

    const parseOne = (cond: string): ((row: Row) => boolean) => {
      cond = cond.trim().replace(/^\(|\)$/g, '');

      // UPPER(col) LIKE ?
      let mm = cond.match(/UPPER\((\w+)\)\s+LIKE\s+\?/i);
      if (mm) {
        const col = mm[1], pat = args[ai++];
        const re = new RegExp(String(pat).replace(/%/g, '.*'), 'i');
        return row => re.test(String(row[col] ?? '').toUpperCase());
      }

      // col LIKE ?
      mm = cond.match(/^(\w+)\s+LIKE\s+\?$/i);
      if (mm) {
        const col = mm[1], pat = args[ai++];
        const re = new RegExp(String(pat).replace(/%/g, '.*'), 'i');
        return row => re.test(String(row[col] ?? ''));
      }

      // ABS(col) comparisons (rare in WHERE)
      mm = cond.match(/ABS\((\w+)\)\s*(<|>|<=|>=|=|!=)\s*(\d+)/i);
      if (mm) {
        const col = mm[1], op = mm[2], val = Number(mm[3]);
        return row => {
          const v = Math.abs(Number(row[col]));
          return op === '<' ? v < val : op === '>' ? v > val : op === '<=' ? v <= val :
            op === '>=' ? v >= val : op === '!=' ? v !== val : v === val;
        };
      }

      // col op ? (comparison with arg)
      mm = cond.match(/^(\w+)\s*(!=|<>|<=|>=|<|>|=)\s*\?$/i);
      if (mm) {
        const col = mm[1], op = mm[2], val = args[ai++];
        return row => {
          const rv = row[col]; const rv2 = Number(rv); const v2 = Number(val);
          if (op === '=' || op === '==') return rv === val || rv2 === v2;
          if (op === '!=' || op === '<>') return rv !== val && rv2 !== v2;
          if (op === '<') return rv2 < v2;
          if (op === '>') return rv2 > v2;
          if (op === '<=') return rv2 <= v2;
          if (op === '>=') return rv2 >= v2;
          return true;
        };
      }

      // col op 'literal'
      mm = cond.match(/^(\w+)\s*(!=|<>|<=|>=|<|>|=)\s*'([^']*)'\s*$/i);
      if (mm) {
        const col = mm[1], op = mm[2], val = mm[3];
        return row => {
          const rv = String(row[col] ?? '');
          if (op === '=' || op === '==') return rv === val;
          if (op === '!=' || op === '<>') return rv !== val;
          return rv.localeCompare(val) < 0 ? (op === '<' || op === '<=') : (op === '>' || op === '>=');
        };
      }

      // col op number literal
      mm = cond.match(/^(\w+)\s*(!=|<>|<=|>=|<|>|=)\s*(-?\d+(?:\.\d+)?)\s*$/i);
      if (mm) {
        const col = mm[1], op = mm[2], val = Number(mm[3]);
        return row => {
          const rv = Number(row[col]);
          if (op === '=' || op === '==') return rv === val;
          if (op === '!=' || op === '<>') return rv !== val;
          if (op === '<') return rv < val;
          if (op === '>') return rv > val;
          if (op === '<=') return rv <= val;
          if (op === '>=') return rv >= val;
          return true;
        };
      }

      return () => true;
    };

    // Split AND/OR respecting parentheses
    const splitLogic = (expr: string, op: string): string[] => {
      const parts: string[] = [];
      let depth = 0, start = 0;
      const re = new RegExp(`\\s+${op}\\s+`, 'gi');
      let m2;
      re.lastIndex = 0;
      while ((m2 = re.exec(expr)) !== null) {
        const before = expr.substring(start, m2.index);
        const opens = (before.match(/\(/g) ?? []).length;
        const closes = (before.match(/\)/g) ?? []).length;
        depth = opens - closes;
        if (depth === 0) {
          parts.push(before.trim());
          start = m2.index + m2[0].length;
        }
      }
      parts.push(expr.substring(start).trim());
      return parts.length > 1 ? parts : [];
    };

    const andParts = splitLogic(where, 'AND');
    if (andParts.length > 1) {
      const preds = andParts.map(p => this._buildPred(p.replace(/^\(|\)$/g, ''), args.slice(ai)));
      // rebuild with shared arg index - simpler: re-call with fresh state
      const self = this;
      return (row: Row) => {
        let idx = 0;
        for (const part of andParts) {
          const subArgs = args.slice(idx);
          const p = self._buildPred(part.replace(/^\(|\)$/g, ''), subArgs);
          if (!p(row)) return false;
          // advance idx by ? count in part
          idx += (part.match(/\?/g) ?? []).length;
        }
        return true;
      };
    }

    const orParts = splitLogic(where, 'OR');
    if (orParts.length > 1) {
      const self = this;
      return (row: Row) => {
        let idx = 0;
        for (const part of orParts) {
          const subArgs = args.slice(idx);
          const p = self._buildPred(part.replace(/^\(|\)$/g, ''), subArgs);
          if (p(row)) return true;
          idx += (part.match(/\?/g) ?? []).length;
        }
        return false;
      };
    }

    return parseOne(where);
  }

  private _order(tbl: Row[], orderStr: string): Row[] {
    const parts = orderStr.split(',').map(p => p.trim());
    return [...tbl].sort((a, b) => {
      for (const part of parts) {
        const desc = /\bDESC\b/i.test(part);
        const absM = part.match(/ABS\((\w+)\)/i);
        const col = absM ? absM[1] : part.replace(/\b(?:ASC|DESC)\b/i, '').trim();
        let av = absM ? Math.abs(Number(a[col])) : a[col];
        let bv = absM ? Math.abs(Number(b[col])) : b[col];
        if (typeof av === 'string') {
          const c = av.localeCompare(String(bv ?? ''));
          if (c !== 0) return desc ? -c : c;
        } else {
          const d = Number(av ?? 0) - Number(bv ?? 0);
          if (d !== 0) return desc ? -d : d;
        }
      }
      return 0;
    });
  }
}

export const db = new WebDb();

export function openDatabase() { return db; }

export function initDatabase(_: any): void {
  db.execSync('CREATE TABLE IF NOT EXISTS stock_items (id TEXT PRIMARY KEY)');
  db.execSync('CREATE TABLE IF NOT EXISTS inventory_sessions (id TEXT PRIMARY KEY)');
  db.execSync('CREATE TABLE IF NOT EXISTS count_entries (id TEXT PRIMARY KEY)');
  db.execSync('CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY)');
}

export function seedDemoData(_: any): void {
  const c = db.getFirstSync<{count:number}>('SELECT COUNT(*) as count FROM stock_items');
  if (c && c.count > 0) return;

  const now = new Date().toISOString();
  const items = [
    { id: uuid(), codigo: '7891234567890', descricao: 'RESINA PP HOMOPOLÍMERO', categoria: 'MATÉRIA-PRIMA', unidade: 'KG', localizacao: 'A-01', saldo_sistema: 1200, estoque_minimo: 500, ativo: 1, created_at: now, updated_at: now },
    { id: uuid(), codigo: '7891234567891', descricao: 'MASTER AZUL CONCENTRADO', categoria: 'ADITIVOS', unidade: 'KG', localizacao: 'A-02', saldo_sistema: 340, estoque_minimo: 100, ativo: 1, created_at: now, updated_at: now },
    { id: uuid(), codigo: '7891234567892', descricao: 'ADITIVO ANTIOXIDANTE UV', categoria: 'ADITIVOS', unidade: 'KG', localizacao: 'A-03', saldo_sistema: 80, estoque_minimo: 50, ativo: 1, created_at: now, updated_at: now },
    { id: uuid(), codigo: '7891234567893', descricao: 'PIGMENTO VERDE INDUSTRIAL', categoria: 'PIGMENTOS', unidade: 'KG', localizacao: 'B-01', saldo_sistema: 520, estoque_minimo: 200, ativo: 1, created_at: now, updated_at: now },
    { id: uuid(), codigo: '7891234567894', descricao: 'EMBALAGEM SACO 25KG', categoria: 'EMBALAGENS', unidade: 'UN', localizacao: 'C-01', saldo_sistema: 3500, estoque_minimo: 1000, ativo: 1, created_at: now, updated_at: now },
    { id: uuid(), codigo: '7891234567895', descricao: 'CAIXA PAPELÃO 40X60', categoria: 'EMBALAGENS', unidade: 'UN', localizacao: 'C-02', saldo_sistema: 1800, estoque_minimo: 500, ativo: 1, created_at: now, updated_at: now },
    { id: uuid(), codigo: '7891234567896', descricao: 'FITA ADESIVA 45MM MARROM', categoria: 'EMBALAGENS', unidade: 'RL', localizacao: 'C-03', saldo_sistema: 200, estoque_minimo: 50, ativo: 1, created_at: now, updated_at: now },
    { id: uuid(), codigo: '7891234567897', descricao: 'PALLET PLÁSTICO PBR', categoria: 'EQUIPAMENTOS', unidade: 'UN', localizacao: 'D-01', saldo_sistema: 45, estoque_minimo: 20, ativo: 1, created_at: now, updated_at: now },
    { id: uuid(), codigo: '7891234567898', descricao: 'LUVA NITRÍLICA P', categoria: 'EPI', unidade: 'PAR', localizacao: 'E-01', saldo_sistema: 600, estoque_minimo: 200, ativo: 1, created_at: now, updated_at: now },
    { id: uuid(), codigo: '7891234567899', descricao: 'ÓCULOS PROTEÇÃO TRANSPARENTE', categoria: 'EPI', unidade: 'UN', localizacao: 'E-02', saldo_sistema: 120, estoque_minimo: 40, ativo: 1, created_at: now, updated_at: now },
    { id: uuid(), codigo: '7891234567900', descricao: 'CAPACETE SEGURANÇA AMARELO', categoria: 'EPI', unidade: 'UN', localizacao: 'E-03', saldo_sistema: 35, estoque_minimo: 15, ativo: 1, created_at: now, updated_at: now },
    { id: uuid(), codigo: '7891234567901', descricao: 'TALCO INDUSTRIAL 1KG', categoria: 'MATÉRIA-PRIMA', unidade: 'KG', localizacao: 'A-04', saldo_sistema: 450, estoque_minimo: 150, ativo: 1, created_at: now, updated_at: now },
  ];
  items.forEach(item => {
    db.runSync(
      `INSERT OR IGNORE INTO stock_items (id, codigo, descricao, categoria, unidade, localizacao, saldo_sistema, estoque_minimo, ativo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [item.id, item.codigo, item.descricao, item.categoria, item.unidade, item.localizacao, item.saldo_sistema, item.estoque_minimo, item.ativo, item.created_at, item.updated_at]
    );
  });

  const sessionId = uuid();
  db.runSync(
    `INSERT OR IGNORE INTO inventory_sessions (id, nome, responsavel, status, data_inicio, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [sessionId, 'Contagem Geral', 'Operador', 'aberta', now, now]
  );

  const counts = [
    { id: uuid(), sid: sessionId, codigo: '7891234567890', descricao: 'RESINA PP HOMOPOLÍMERO', saldo: 1200, contado: 1185, dif: -15, local: 'A-01', esc: 1 },
    { id: uuid(), sid: sessionId, codigo: '7891234567891', descricao: 'MASTER AZUL CONCENTRADO', saldo: 340, contado: 340, dif: 0, local: 'A-02', esc: 1 },
    { id: uuid(), sid: sessionId, codigo: '7891234567892', descricao: 'ADITIVO ANTIOXIDANTE UV', saldo: 80, contado: 92, dif: 12, local: 'A-03', esc: 1 },
    { id: uuid(), sid: sessionId, codigo: '7891234567894', descricao: 'EMBALAGEM SACO 25KG', saldo: 3500, contado: 3420, dif: -80, local: 'C-01', esc: 1 },
    { id: uuid(), sid: sessionId, codigo: '7891234567898', descricao: 'LUVA NITRÍLICA P', saldo: 600, contado: 612, dif: 12, local: 'E-01', esc: 0 },
  ];
  counts.forEach(c => {
    db.runSync(
      `INSERT OR IGNORE INTO count_entries (id, session_id, item_id, codigo, descricao, saldo_sistema, quantidade_contada, diferenca, localizacao, observacao, escaneado, created_at) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, '', ?, ?)`,
      [c.id, c.sid, c.codigo, c.descricao, c.saldo, c.contado, c.dif, c.local, c.esc, now]
    );
  });
}

// Auto-initialize on module load (fixes direct URL navigation bypassing _layout.tsx)
initDatabase(db);
seedDemoData(db);
