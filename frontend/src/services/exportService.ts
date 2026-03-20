import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { CountEntry } from '../db/countsDB';
import { getItemByCode } from '../db/itemsDB';
import { Session } from '../db/sessionsDB';
import { getUsername } from '../db/settingsDB';

function getAdjustmentCost(entry: CountEntry): number {
  const unitCost = getItemByCode(entry.codigo)?.custo_ajuste ?? 0;
  return Math.abs(entry.diferenca) * unitCost;
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function escapeCSV(val: string | number): string {
  const s = String(val);
  if (s.includes(';') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^\w\-]+/g, '_').replace(/_+/g, '_');
}

function getResponsibleName(session: Session): string {
  const username = getUsername();
  if (username) return username;
  return session.responsavel?.trim() || 'Operador';
}

export async function exportCSV(entries: CountEntry[], session: Session): Promise<void> {
  const responsavel = getResponsibleName(session);
  const header = ['Codigo', 'Descricao', 'Saldo Sistema', 'Contado', 'Diferenca', 'Custo do Ajuste', 'Localizacao', 'Observacao', 'Responsavel', 'Data/Hora'];
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

  const csv = [header, ...rows].map((row) => row.map(escapeCSV).join(';')).join('\n');
  const bom = '\uFEFF';
  const content = bom + csv;

  const nome = sanitizeFileName(session.nome);
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const filename = `contagem_${nome}_${date}.csv`;

  if (Platform.OS === 'web') {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!baseDir) {
    throw new Error('Nao foi possivel acessar diretorio para exportar CSV.');
  }

  const fileUri = `${baseDir}${filename}`;
  await FileSystem.writeAsStringAsync(fileUri, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: `Exportar ${session.nome}`,
      UTI: 'public.comma-separated-values-text',
    });
  }
}

export async function exportPDF(entries: CountEntry[], session: Session): Promise<void> {
  const responsavel = getResponsibleName(session);
  const stats = {
    total: entries.length,
    ok: entries.filter((e) => e.diferenca === 0).length,
    falta: entries.filter((e) => e.diferenca < 0).length,
    diferenca: entries.filter((e) => e.diferenca > 0).length,
  };
  const totalAdjustmentCost = entries.reduce((sum, entry) => sum + getAdjustmentCost(entry), 0);

  const rows = entries
    .map(
      (e) => `
    <tr>
      <td><b>${e.codigo}</b></td>
      <td>${e.descricao}</td>
      <td style="text-align:center">${e.saldo_sistema}</td>
      <td style="text-align:center">${e.quantidade_contada}</td>
      <td style="text-align:center; font-weight:bold; color:${
        e.diferenca < 0 ? '#dc2626' : e.diferenca > 0 ? '#059669' : '#6b7280'
      }">${e.diferenca > 0 ? '+' : ''}${e.diferenca}</td>
      <td style="text-align:center">${formatBRL(getAdjustmentCost(e))}</td>
      <td>${e.localizacao}</td>
      <td>${e.observacao}</td>
    </tr>`
    )
    .join('');

  const totalRow = `
    <tr>
      <td colspan="5" style="text-align:right; font-weight:bold; background:#eef2ff;">Total Custo Ajuste</td>
      <td style="text-align:center; font-weight:bold; background:#eef2ff;">${formatBRL(totalAdjustmentCost)}</td>
      <td colspan="2" style="background:#eef2ff;"></td>
    </tr>`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Relatorio Ciclo de Inventario</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:Arial,sans-serif; font-size:11px; color:#1a1a1a; padding:24px; }
    .header { border-bottom:3px solid #1e3a5f; padding-bottom:16px; margin-bottom:16px; }
    .header h1 { font-size:20px; color:#1e3a5f; }
    .header p { color:#555; margin-top:4px; }
    .stats { display:flex; gap:16px; margin-bottom:20px; }
    .stat { background:#f5f5f5; border-radius:6px; padding:10px 16px; text-align:center; flex:1; }
    .stat-value { font-size:22px; font-weight:bold; }
    .stat-label { font-size:10px; color:#666; margin-top:2px; }
    .ok { color:#059669; } .falta { color:#dc2626; } .diferenca { color:#d97706; } .total { color:#1e3a5f; }
    table { width:100%; border-collapse:collapse; font-size:10px; }
    th { background:#1e3a5f; color:white; padding:7px 8px; text-align:left; }
    td { padding:6px 8px; border-bottom:1px solid #e5e7eb; }
    tr:nth-child(even) { background:#f9fafb; }
    .footer { margin-top:20px; font-size:9px; color:#9ca3af; border-top:1px solid #e5e7eb; padding-top:10px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Relatorio de Contagem de Estoque</h1>
    <p>Sessao: <b>${session.nome}</b> | Responsavel: ${responsavel} | Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
  </div>
  <div class="stats">
    <div class="stat"><div class="stat-value total">${stats.total}</div><div class="stat-label">CONTADOS</div></div>
    <div class="stat"><div class="stat-value ok">${stats.ok}</div><div class="stat-label">OK</div></div>
    <div class="stat"><div class="stat-value falta">${stats.falta}</div><div class="stat-label">FALTA</div></div>
    <div class="stat"><div class="stat-value diferenca">${stats.diferenca}</div><div class="stat-label">DIFERENCA</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Codigo</th><th>Descricao</th><th>Saldo Sist.</th><th>Contado</th><th>Diferenca</th><th>Custo Ajuste</th><th>Local.</th><th>Obs.</th>
      </tr>
    </thead>
    <tbody>${rows}${totalRow}</tbody>
  </table>
  <div class="footer">Ciclo de Inventario · ${entries.length} itens · Sessao iniciada em ${new Date(session.data_inicio).toLocaleString('pt-BR')}</div>
</body>
</html>`;

  const { uri } = await Print.printToFileAsync({ html, base64: false });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Relatorio ${session.nome}`,
      UTI: 'com.adobe.pdf',
    });
  }
}
