import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import * as XLSX from 'xlsx';
import { CountEntry } from '../db/countsDB';
import { createItem, getItemByCode, normalizeCodigo, updateItem } from '../db/itemsDB';
import { Session } from '../db/sessionsDB';
import { getUsername } from '../db/settingsDB';
import {
  adjustToBusinessDay,
  calculateNextCountDate,
  normalizeCurvaABC,
  parseDateToIso,
} from '../utils/countSchedule';

export type ImportXlsxSummary = {
  created: number;
  updated: number;
  ignored: number;
  fileName: string;
};

const XLSX_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream',
];

const COLUMN_ALIASES = {
  codigo: ['codigo', 'código', 'cod', 'code'],
  descricao: ['descricao', 'descrição', 'description', 'produto', 'item'],
  categoria: ['categoria', 'category'],
  unidade: ['unidade', 'unit'],
  localizacao: ['localizacao', 'localização', 'local', 'endereco', 'endereço'],
  saldo_sistema: ['saldo_sistema', 'saldo sistema', 'saldo', 'estoque', 'quantidade'],
  estoque_minimo: ['estoque_minimo', 'estoque minimo', 'minimo', 'mínimo'],
  custo_ajuste: ['custo_ajuste', 'custo ajuste', 'custo', 'valor_unitario', 'valor unitario', 'preco', 'preço', '__empty_7'],
  data_contado: ['contado', 'data_contado', 'data contado', 'ultima_contagem', 'última_contagem'],
  curva_abc: ['curva_abc', 'curva abc', 'curva', 'abc'],
  proxima_contagem: ['proxima_contagem', 'próxima_contagem', 'proxima contagem', 'próxima contagem', 'data_recontagem'],
} as const;

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/\s+/g, '_');
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? '').trim();
  if (!raw) return 0;

  const hasComma = raw.includes(',');
  const hasDot = raw.includes('.');
  const normalized = hasComma && hasDot
    ? raw.replace(/\./g, '').replace(',', '.')
    : hasComma
      ? raw.replace(',', '.')
      : raw;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getColumnValue(row: Record<string, unknown>, aliases: readonly string[]): unknown {
  const rowKeys = Object.keys(row).reduce<Record<string, string>>((acc, key) => {
    acc[normalizeHeader(key)] = key;
    return acc;
  }, {});

  for (const alias of aliases) {
    const realKey = rowKeys[normalizeHeader(alias)];
    if (realKey !== undefined) {
      return row[realKey];
    }
  }

  return '';
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^\w\-]+/g, '_').replace(/_+/g, '_');
}

function getAdjustmentCost(entry: CountEntry): number {
  const unitCost = getItemByCode(entry.codigo)?.custo_ajuste ?? 0;
  return Math.abs(entry.diferenca) * unitCost;
}

function getResponsibleName(session: Session): string {
  const username = getUsername();
  if (username) return username;
  return session.responsavel?.trim() || 'Operador';
}

export async function exportXLSX(entries: CountEntry[], session: Session): Promise<void> {
  const responsavel = getResponsibleName(session);
  const header = ['Código', 'Descrição', 'Saldo Sistema', 'Contado', 'Diferença', 'Custo do Ajuste', 'Localização', 'Observação', 'Responsável', 'Data/Hora'];
  const rows = entries.map((e) => [
    e.codigo,
    e.descricao,
    e.saldo_sistema,
    e.quantidade_contada,
    e.diferenca,
    getAdjustmentCost(e),
    e.localizacao,
    e.observacao,
    responsavel,
    e.created_at.slice(0, 16).replace('T', ' '),
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, 'Contagem');

  const nome = sanitizeFileName(session.nome);
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const filename = `contagem_${nome}_${date}.xlsx`;

  if (Platform.OS === 'web') {
    XLSX.writeFile(wb, filename);
    return;
  }

  const base64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!baseDir) throw new Error('Não foi possível acessar diretório de arquivos.');

  const fileUri = `${baseDir}${filename}`;
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: `Exportar ${session.nome}`,
      UTI: 'org.openxmlformats.spreadsheetml.sheet',
    });
  }
}

export async function importItemsFromXLSX(): Promise<ImportXlsxSummary | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: XLSX_MIME_TYPES,
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (picked.canceled || !picked.assets?.length) {
    return null;
  }

  const file = picked.assets[0];
  let workbook: XLSX.WorkBook;

  try {
    const webFile = (file as { file?: File }).file;
    const buffer = webFile
      ? await webFile.arrayBuffer()
      : await (await fetch(file.uri)).arrayBuffer();
    workbook = XLSX.read(buffer, { type: 'array' });
  } catch {
    const base64Raw = await FileSystem.readAsStringAsync(file.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const base64 = base64Raw.includes(',')
      ? base64Raw.substring(base64Raw.indexOf(',') + 1)
      : base64Raw;
    workbook = XLSX.read(base64, { type: 'base64' });
  }

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('Planilha sem abas válidas.');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, unknown>[];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
  if (!rows.length) {
    throw new Error('Planilha vazia.');
  }

  let created = 0;
  let updated = 0;
  let ignored = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rawRow = rawRows[index + 1] ?? [];
    const fallbackColH = Array.isArray(rawRow) ? rawRow[7] : '';
    const codigo = normalizeCodigo(getColumnValue(row, COLUMN_ALIASES.codigo) ?? '');
    if (!codigo) {
      ignored += 1;
      continue;
    }

    const descricaoRaw = String(getColumnValue(row, COLUMN_ALIASES.descricao) ?? '').trim();
    const payload = {
      codigo,
      descricao: descricaoRaw || `Item ${codigo}`,
      categoria: String(getColumnValue(row, COLUMN_ALIASES.categoria) ?? '').trim(),
      unidade: String(getColumnValue(row, COLUMN_ALIASES.unidade) ?? '').trim() || 'UN',
      localizacao: String(getColumnValue(row, COLUMN_ALIASES.localizacao) ?? '').trim(),
      saldo_sistema: parseNumber(getColumnValue(row, COLUMN_ALIASES.saldo_sistema)),
      estoque_minimo: parseNumber(getColumnValue(row, COLUMN_ALIASES.estoque_minimo)),
      custo_ajuste: parseNumber(getColumnValue(row, COLUMN_ALIASES.custo_ajuste) || fallbackColH),
      data_contado: parseDateToIso(getColumnValue(row, COLUMN_ALIASES.data_contado)),
      curva_abc: normalizeCurvaABC(getColumnValue(row, COLUMN_ALIASES.curva_abc)),
      proxima_contagem: parseDateToIso(getColumnValue(row, COLUMN_ALIASES.proxima_contagem)),
    };
    if (payload.data_contado && !payload.proxima_contagem) {
      payload.proxima_contagem = calculateNextCountDate(payload.data_contado, payload.curva_abc);
    }
    if (payload.proxima_contagem) {
      payload.proxima_contagem = adjustToBusinessDay(payload.proxima_contagem);
    }

    const existing = getItemByCode(codigo);
    if (existing) {
      updateItem(existing.id, payload);
      updated += 1;
    } else {
      createItem(payload);
      created += 1;
    }
  }

  return {
    created,
    updated,
    ignored,
    fileName: file.name ?? 'planilha.xlsx',
  };
}
