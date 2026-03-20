const XLSX = require('xlsx');

const wb = XLSX.utils.book_new();

const header = [
  'codigo',
  'descricao',
  'categoria',
  'unidade',
  'localizacao',
  'saldo_sistema',
  'estoque_minimo',
  'custo_ajuste',
  'contado',
  'curva_abc',
  'proxima_contagem',
];

const exemplo1 = [
  '7891234567890',
  'RESINA PP HOMOPOLIMERO',
  'RESINAS',
  'KG',
  'A-01',
  1200,
  300,
  2.5,
  '14/03/2026',
  'A',
  '13/04/2026',
];

const exemplo2 = [
  '7891234567891',
  'MASTER AZUL CONCENTRADO',
  'ADITIVOS',
  'KG',
  'A-02',
  340,
  100,
  1.8,
  '10/03/2026',
  'B',
  '08/06/2026',
];

const observacoes = [
  ['OBSERVACOES'],
  ['A importacao usa a primeira aba do arquivo.'],
  ['Colunas esperadas (ordem recomendada): A codigo, B descricao, C categoria, D unidade, E localizacao, F saldo_sistema, G estoque_minimo, H custo_ajuste, I contado, J curva_abc, K proxima_contagem.'],
  ['A coluna contado aceita dd/mm/aaaa, yyyy-mm-dd ou serial de data do Excel.'],
  ['Curva-ABC aceita A, B ou C. Se a proxima_contagem estiver vazia, o app calcula automaticamente.'],
  ['Se o codigo estiver vazio, a linha e ignorada.'],
  ['Alias aceitos tambem funcionam (ex.: codigo/codigo, descricao/produto/item, etc.).'],
];

const wsDados = XLSX.utils.aoa_to_sheet([header, exemplo1, exemplo2]);
wsDados['!cols'] = [
  { wch: 18 },
  { wch: 36 },
  { wch: 18 },
  { wch: 10 },
  { wch: 14 },
  { wch: 14 },
  { wch: 16 },
  { wch: 14 },
  { wch: 14 },
  { wch: 12 },
  { wch: 18 },
];

const wsObs = XLSX.utils.aoa_to_sheet(observacoes);
wsObs['!cols'] = [{ wch: 120 }];

XLSX.utils.book_append_sheet(wb, wsDados, 'Importacao');
XLSX.utils.book_append_sheet(wb, wsObs, 'Observacoes');

const out1 = '/data/data/com.termux/files/home/projects/EstoqueAudit_v2_reviewed-1/frontend/layout_importacao_estoqueaudit.xlsx';
const out2 = '/storage/emulated/0/Download/layout_importacao_estoqueaudit.xlsx';

XLSX.writeFile(wb, out1);
XLSX.writeFile(wb, out2);

console.log(out1);
console.log(out2);
