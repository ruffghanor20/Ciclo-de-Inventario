import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { BlendCount, MaterialTipo, upsertBlendMaterial } from '../db/blendDB';
import { Session } from '../db/sessionsDB';

export interface BlendImportSummary {
  createdOrUpdated: number;
  ignored: number;
  fileName: string;
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_');
}

function valueFrom(row: Record<string, unknown>, aliases: string[]): unknown {
  const map = Object.keys(row).reduce<Record<string, string>>((acc, key) => {
    acc[normalizeHeader(key)] = key;
    return acc;
  }, {});
  for (const alias of aliases) {
    const key = map[normalizeHeader(alias)];
    if (key !== undefined) return row[key];
  }
  return '';
}

function parseTipo(value: unknown, fallback: MaterialTipo): MaterialTipo {
  const raw = String(value ?? '').trim().toUpperCase();
  if (raw.includes('DOS')) return 'DOSADOR';
  if (raw.includes('BLEND')) return 'BLEND';
  return fallback;
}

async function readWorkbook(file: DocumentPicker.DocumentPickerAsset): Promise<ReturnType<typeof XLSX.read>> {
  try {
    const webFile = (file as { file?: File }).file;
    const buffer = webFile
      ? await webFile.arrayBuffer()
      : await (await fetch(file.uri)).arrayBuffer();
    return XLSX.read(buffer, { type: 'array' });
  } catch {
    const base64Raw = await FileSystem.readAsStringAsync(file.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const base64 = base64Raw.includes(',')
      ? base64Raw.substring(base64Raw.indexOf(',') + 1)
      : base64Raw;
    return XLSX.read(base64, { type: 'base64' });
  }
}

export async function importBlendBaseXLSX(): Promise<BlendImportSummary | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/octet-stream',
    ],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (picked.canceled || !picked.assets?.length) return null;

  const file = picked.assets[0];
  const workbook = await readWorkbook(file);
  let createdOrUpdated = 0;
  let ignored = 0;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, unknown>[];
    const sheetUpper = sheetName.toUpperCase();
    const fallback: MaterialTipo = sheetUpper.includes('DOS') ? 'DOSADOR' : 'BLEND';

    for (const row of rows) {
      const codigo = valueFrom(row, ['codigo', 'código', 'cod', 'material', 'item']);
      const descricao = valueFrom(row, ['descricao', 'descrição', 'texto', 'description']);
      const tipoRaw = valueFrom(row, ['tipo', 'categoria', 'classe']);
      const tipo = parseTipo(tipoRaw, fallback);
      if (!String(codigo ?? '').trim()) {
        ignored += 1;
        continue;
      }
      upsertBlendMaterial(codigo, descricao, tipo);
      createdOrUpdated += 1;
    }
  }

  return { createdOrUpdated, ignored, fileName: file.name ?? 'base_blends.xlsx' };
}

function sanitize(value: string): string {
  return value.replace(/[^\w\-]+/g, '_').replace(/_+/g, '_');
}

function bytesToBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;
    result += chars[(triple >> 18) & 63];
    result += chars[(triple >> 12) & 63];
    result += i + 1 < bytes.length ? chars[(triple >> 6) & 63] : '=';
    result += i + 2 < bytes.length ? chars[triple & 63] : '=';
  }
  return result;
}

type ExcelImageExtension = 'png' | 'jpeg' | 'gif';

function imageTypeFromUri(uri: string): { extension: ExcelImageExtension; mime: string } {
  const lower = uri.toLowerCase();
  if (lower.startsWith('data:image/png') || lower.includes('.png')) return { extension: 'png', mime: 'image/png' };
  if (lower.startsWith('data:image/gif') || lower.includes('.gif')) return { extension: 'gif', mime: 'image/gif' };
  return { extension: 'jpeg', mime: 'image/jpeg' };
}

async function photoForExcel(uri: string): Promise<{ base64: string; extension: ExcelImageExtension }> {
  const fallback = imageTypeFromUri(uri);
  if (uri.startsWith('data:image/')) return { base64: uri, extension: fallback.extension };

  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    if (!response.ok) throw new Error('Não foi possível ler uma das fotos da contagem.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    const mime = response.headers.get('content-type') || fallback.mime;
    const extension: ExcelImageExtension = mime.includes('png') ? 'png' : mime.includes('gif') ? 'gif' : 'jpeg';
    return { base64: `data:${mime};base64,${bytesToBase64(bytes)}`, extension };
  }

  const raw = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  return { base64: `data:${fallback.mime};base64,${raw}`, extension: fallback.extension };
}

function formatMaterial(entry: BlendCount): string {
  if (entry.modo === 'BLEND') return entry.blend_codigo;
  return [entry.comp1_codigo, entry.comp2_codigo, entry.comp3_codigo].filter(Boolean).join(' + ');
}

function totalKg(entry: BlendCount): number {
  return entry.modo === 'BLEND' ? entry.blend_kg : entry.comp1_kg + entry.comp2_kg + entry.comp3_kg;
}

async function buildBlendWorkbook(entries: BlendCount[], session: Session): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EstoqueAudit Pro';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Contagens');
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: 'A1', to: 'S1' };
  sheet.columns = [
    { header: 'Sessão', key: 'sessao', width: 24 },
    { header: 'Depósito', key: 'deposito', width: 11 },
    { header: 'Máquina', key: 'maquina', width: 12 },
    { header: 'Tipo de máquina', key: 'tipoMaquina', width: 17 },
    { header: 'Tipo de contagem', key: 'modo', width: 16 },
    { header: 'Código Blend', key: 'blendCodigo', width: 18 },
    { header: 'Blend kg', key: 'blendKg', width: 12 },
    { header: 'Componente 1', key: 'comp1', width: 18 },
    { header: 'Comp. 1 kg', key: 'comp1Kg', width: 12 },
    { header: 'Componente 2', key: 'comp2', width: 18 },
    { header: 'Comp. 2 kg', key: 'comp2Kg', width: 12 },
    { header: 'Componente 3', key: 'comp3', width: 18 },
    { header: 'Comp. 3 kg', key: 'comp3Kg', width: 12 },
    { header: 'Total kg', key: 'totalKg', width: 12 },
    { header: 'Material contado', key: 'material', width: 32 },
    { header: 'Foto anexada', key: 'foto', width: 14 },
    { header: 'Observação', key: 'observacao', width: 28 },
    { header: 'Responsável', key: 'responsavel', width: 18 },
    { header: 'Data/Hora', key: 'dataHora', width: 20 },
  ];

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
  header.alignment = { vertical: 'middle', horizontal: 'center' };
  header.height = 24;

  for (const entry of entries) {
    const row = sheet.addRow({
      sessao: session.nome,
      deposito: entry.deposito,
      maquina: entry.maquina,
      tipoMaquina: entry.tipo_maquina,
      modo: entry.modo,
      blendCodigo: entry.blend_codigo,
      blendKg: entry.blend_kg || '',
      comp1: entry.comp1_codigo,
      comp1Kg: entry.comp1_kg || '',
      comp2: entry.comp2_codigo,
      comp2Kg: entry.comp2_kg || '',
      comp3: entry.comp3_codigo,
      comp3Kg: entry.comp3_kg || '',
      totalKg: totalKg(entry),
      material: formatMaterial(entry),
      foto: entry.foto_uri ? 'SIM' : 'NÃO',
      observacao: entry.observacao,
      responsavel: entry.responsavel,
      dataHora: entry.created_at.slice(0, 16).replace('T', ' '),
    });
    ['G', 'I', 'K', 'M', 'N'].forEach((column) => { row.getCell(column).numFmt = '0.000'; });
  }

  const photoEntries = entries.filter((entry) => Boolean(entry.foto_uri));
  if (photoEntries.length > 0) {
    const photos = workbook.addWorksheet('Fotos');
    photos.columns = [{ width: 22 }, { width: 28 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 20 }];
    photos.mergeCells('A1:H1');
    photos.getCell('A1').value = `Evidências fotográficas — ${session.nome} — Depósito ${session.deposito}`;
    photos.getCell('A1').font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' } };
    photos.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
    photos.getRow(1).height = 28;

    let startRow = 3;
    for (const entry of photoEntries) {
      const labels: Array<[string, string | number]> = [
        ['Máquina', `${entry.tipo_maquina} ${entry.maquina}`],
        ['Material', formatMaterial(entry)],
        ['Quantidade', totalKg(entry)],
        ['Responsável', entry.responsavel],
        ['Data/Hora', entry.created_at.slice(0, 16).replace('T', ' ')],
        ['Depósito', entry.deposito],
      ];
      labels.forEach(([label, value], index) => {
        photos.getCell(`A${startRow + index}`).value = label;
        photos.getCell(`A${startRow + index}`).font = { bold: true };
        photos.getCell(`B${startRow + index}`).value = value;
      });
      photos.getCell(`B${startRow + 2}`).numFmt = '0.000 "kg"';

      try {
        const image = await photoForExcel(entry.foto_uri);
        const imageId = workbook.addImage({ base64: image.base64, extension: image.extension });
        photos.addImage(imageId, { tl: { col: 2.15, row: startRow - 1 }, ext: { width: 420, height: 235 }, editAs: 'oneCell' });
      } catch {
        photos.getCell(`C${startRow}`).value = 'Foto indisponível no momento da exportação';
      }
      startRow += 15;
    }
  }

  return workbook;
}

export async function exportBlendCountsXLSX(entries: BlendCount[], session: Session): Promise<void> {
  const workbook = await buildBlendWorkbook(entries, session);
  const filename = `contagem_blends_${session.deposito}_${sanitize(session.nome)}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  const bytes = new Uint8Array(buffer as ArrayBuffer);

  if (Platform.OS === 'web') {
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }

  const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!baseDir) throw new Error('Não foi possível acessar o diretório de arquivos.');
  const uri = `${baseDir}${filename}`;
  await FileSystem.writeAsStringAsync(uri, bytesToBase64(bytes), { encoding: FileSystem.EncodingType.Base64 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Exportar contagem de blends com fotos',
      UTI: 'org.openxmlformats.spreadsheetml.sheet',
    });
  }
}
