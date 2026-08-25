import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
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
  const webFile = (file as { file?: File }).file;
  const buffer = webFile ? await webFile.arrayBuffer() : await (await fetch(file.uri)).arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

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

export async function exportBlendCountsXLSX(entries: BlendCount[], session: Session): Promise<void> {
  const header = [
    'Sessão', 'Depósito', 'Máquina', 'Tipo de máquina', 'Tipo de contagem',
    'Código Blend', 'Blend kg',
    'Componente 1', 'Comp. 1 kg', 'Componente 2', 'Comp. 2 kg', 'Componente 3', 'Comp. 3 kg',
    'Total kg', 'Foto', 'Observação', 'Responsável', 'Data/Hora',
  ];

  const rows = entries.map((e) => [
    session.nome,
    e.deposito,
    e.maquina,
    e.tipo_maquina,
    e.modo,
    e.blend_codigo,
    e.blend_kg,
    e.comp1_codigo,
    e.comp1_kg,
    e.comp2_codigo,
    e.comp2_kg,
    e.comp3_codigo,
    e.comp3_kg,
    e.modo === 'BLEND' ? e.blend_kg : e.comp1_kg + e.comp2_kg + e.comp3_kg,
    e.foto_uri,
    e.observacao,
    e.responsavel,
    e.created_at.slice(0, 16).replace('T', ' '),
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, 'Blends por Máquina');

  const filename = `contagem_blends_${session.deposito}_${sanitize(session.nome)}_${new Date().toISOString().slice(0, 10)}.xlsx`;

  if (Platform.OS === 'web') {
    XLSX.writeFile(wb, filename);
    return;
  }

  const base64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!baseDir) throw new Error('Não foi possível acessar o diretório de arquivos.');
  const uri = `${baseDir}${filename}`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Exportar contagem de blends',
    });
  }
}
