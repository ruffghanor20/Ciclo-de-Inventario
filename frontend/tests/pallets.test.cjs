// node --test tests/pallets.test.cjs (Node 22.13+). Exercita as consultas reais em SQLite.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');
const XLSX = require('xlsx');

require.extensions['.ts'] = (mod, file) => {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  mod._compile(code.outputText, file);
};
const sqlite = new DatabaseSync(':memory:');
const db = {
  execSync: sql => sqlite.exec(sql),
  getFirstSync: (sql, args = []) => sqlite.prepare(sql).get(...args) ?? null,
  getAllSync: (sql, args = []) => sqlite.prepare(sql).all(...args),
  runSync: (sql, args = []) => sqlite.prepare(sql).run(...args),
  withTransactionSync(fn) {
    sqlite.exec('BEGIN');
    try { fn(); sqlite.exec('COMMIT'); }
    catch (e) { sqlite.exec('ROLLBACK'); throw e; }
  },
};
// Mesma interface dos dois adaptadores de banco do app.
const database = require('../src/db/database');
database.db = db;
const { initPalletCounts, listPalletCounts, savePalletCount, suggestMaterials } = require('../src/db/palletDB');
const { buildPalletWorkbook } = require('../src/services/palletWorkbook');
const { parseField, parseCountQuantity } = require('../src/utils/palletRules');
const { deleteSession } = require('../src/db/sessionsDB');
sqlite.exec(`CREATE TABLE stock_items (codigo TEXT, descricao TEXT, ativo INTEGER);
  INSERT INTO stock_items VALUES ('000123', 'Conexão Ø 25 mm "A&B"', 1), ('M_1', 'União', 1), ('M01', 'Bucha', 1);
  CREATE TABLE inventory_sessions (id TEXT PRIMARY KEY, status TEXT);
  INSERT INTO inventory_sessions VALUES ('aberta', 'aberta'), ('separada', 'aberta'), ('fechada', 'fechada');
  CREATE TABLE count_entries (session_id TEXT, codigo TEXT);
  INSERT INTO count_entries VALUES ('aberta','LEGADO');`);
initPalletCounts(db);
initPalletCounts(db);
const base = { sessionId: 'aberta', codigo: '000123', endereco: 'r.13.11.d', uc: '0000000123', quantidade: '12,50' };

test('prefixo literal, seleção e leitura de endereço e UC com zeros', () => {
  assert.deepEqual(suggestMaterials('0001').map(x => x.codigo), ['000123']);
  assert.deepEqual(suggestMaterials('M_').map(x => x.codigo), ['M_1']);
  assert.deepEqual(suggestMaterials('M%'), []);
  assert.equal(parseField('uc', '0000000123\r\n'), '0000000123');
  assert.equal(parseField('endereco', 'r.13.11.d'), 'R.13.11.D');
  assert.throws(() => parseField('uc', 'AB0000000123'));
  assert.throws(() => parseField('uc', '00000001234'));
  assert.throws(() => parseField('uc', '123'));
  assert.throws(() => parseField('endereco', ''));
  assert.equal(parseField('uc', JSON.stringify(base)), base.uc);
});

test('quantidade digitada, inclusive zero, precisa ser numérica e explícita', () => {
  for (const invalid of ['', ' ', '-1', '1.2.3', '1,2,3', '1e5', '12x', '1234567890123456']) {
    assert.throws(() => parseCountQuantity(invalid));
  }
  assert.equal(parseCountQuantity('0'), 0);
  assert.equal(parseCountQuantity('0,125'), 0.125);
});

test('pallets distintos, mistos, duplicação, correção e exportação XLSX real', () => {
  const first = savePalletCount(base);
  assert.throws(() => savePalletCount(base), /já contado/);
  assert.throws(() => savePalletCount({ ...base, codigo: 'M_1', endereco: 'R.14.01.A' }), /já está/);
  assert.throws(() => savePalletCount({ ...base, sessionId: 'fechada' }), /encerrada/);
  assert.throws(() => savePalletCount({ ...base, codigo: 'SEM-CADASTRO' }), /cadastrado/);
  savePalletCount({ ...base, uc: '0000000124', endereco: 'R.14.01.A', quantidade: '8' });
  savePalletCount({ ...base, codigo: 'M_1', quantidade: '1' });
  savePalletCount({ ...base, sessionId: 'separada', endereco: 'OUTRA' });
  const edited = savePalletCount({ ...base, quantidade: '11,125', editingId: first.id });
  assert.equal(edited.id, first.id);
  const rows = listPalletCounts('aberta');
  assert.equal(rows.length, 3);
  const bytes = XLSX.write(buildPalletWorkbook(rows), { type: 'buffer', bookType: 'xlsx' });
  const workbook = XLSX.read(bytes, { type: 'buffer' });
  const sheet = workbook.Sheets['Inventário'];
  const cells = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  assert.deepEqual(cells[0], ['Material', 'Descrição', 'Quantidade', 'Endereço', 'UC']);
  const i = cells.findIndex(row => row[0] === base.codigo && row[4] === base.uc);
  assert.deepEqual(cells[i], [base.codigo, 'Conexão Ø 25 mm "A&B"', 11.125, 'R.13.11.D', base.uc]);
  for (const col of ['A','B','D','E']) assert.equal(sheet[col + (i + 1)].t, 's');
  assert.equal(sheet['C' + (i + 1)].t, 'n');
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM count_entries').get().n, 1);
  deleteSession('separada');
  assert.equal(listPalletCounts('separada').length, 0);
  assert.equal(listPalletCounts('aberta').length, 3);
});
