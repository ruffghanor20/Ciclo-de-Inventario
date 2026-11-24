export type ScanField = 'endereco' | 'uc';

export function parseField(field: ScanField, raw: string): string {
  let value = raw.trim();
  // A etiqueta gerada pelo próprio coletor também pode ser lida.
  if (value.startsWith('{')) {
    let payload;
    try { payload = JSON.parse(value); } catch { /* mensagem específica do campo abaixo */ }
    value = typeof payload?.[field] === 'string' ? payload[field].trim() : '';
  }
  if (field === 'uc') {
    if (!/^\d{10}$/.test(value)) throw new Error('A UC deve conter exatamente 10 dígitos.');
    return value;
  }
  if (!/^[\p{L}\d][\p{L}\d ._/-]*$/u.test(value)) {
    throw new Error('Informe o endereço da posição, por exemplo R.13.11.D.');
  }
  return value.toUpperCase();
}

export function parseCountQuantity(raw: string): number {
  const value = raw.trim();
  if (!/^\d+(?:[,.]\d+)?$/.test(value)) {
    throw new Error('Informe a quantidade sem separador de milhar. Exemplo: 1250,5.');
  }
  // Um XLSX armazena apenas 15 algarismos significativos.
  const digits = value.replace(/[.,]/, '').replace(/^0+/, '');
  const number = Number(value.replace(',', '.'));
  if (digits.length > 15 || !Number.isFinite(number) || (digits && number === 0)) {
    throw new Error('Quantidade fora da precisão suportada pelo Excel.');
  }
  return number;
}
