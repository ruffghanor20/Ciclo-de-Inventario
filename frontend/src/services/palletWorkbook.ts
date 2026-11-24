import * as XLSX from 'xlsx';
import type { PalletCount } from '../db/palletDB';

export function buildPalletWorkbook(entries: PalletCount[]) {
  const rows = entries.map((e) => [e.codigo, e.descricao, e.quantidade, e.endereco, e.uc]);
  const sheet = XLSX.utils.aoa_to_sheet([['Material', 'Descrição', 'Quantidade', 'Endereço', 'UC'], ...rows]);
  sheet['!cols'] = [{ wch: 20 }, { wch: 54 }, { wch: 18 }, { wch: 20 }, { wch: 16 }];
  sheet['!autofilter'] = { ref: sheet['!ref'] };
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Inventário');
  return workbook;
}
