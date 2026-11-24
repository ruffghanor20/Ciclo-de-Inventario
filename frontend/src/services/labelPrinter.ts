import { requireOptionalNativeModule } from 'expo';
import { Platform, PermissionsAndroid } from 'react-native';
import { db } from '../db/database';
import type { PalletCount } from '../db/palletDB';

export type Printer = { name: string; address: string };
type NativePrinter = {
  paired(): Promise<Printer[]>;
  print(payload: string, quantity: string): Promise<void>;
  sendBluetooth(payload: string, quantity: string, address: string): Promise<void>;
};
const nativeModule = Platform.OS === 'android' ? requireOptionalNativeModule<NativePrinter>('InventoryLabel') : null;
const key = 'inventario_zebra';
function nativePrinter() {
  if (!nativeModule) throw new Error('A impressão térmica está disponível no APK Android do inventário.');
  return nativeModule;
}

async function bluetoothAccess() {
  if (Platform.OS === 'android' && Number(Platform.Version) >= 31) {
    const status = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
    if (status !== PermissionsAndroid.RESULTS.GRANTED) throw new Error('Permita o acesso a dispositivos por perto para usar a Zebra pareada.');
  }
}

export async function pairedPrinters(): Promise<Printer[]> {
  await bluetoothAccess();
  return nativePrinter().paired();
}

export function preferredPrinter(): Printer | null {
  const row = db.getFirstSync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', [key]);
  if (!row?.value) return null;
  return JSON.parse(row.value);
}

export function setPreferredPrinter(printer: Printer | null) {
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM app_settings WHERE key = ?', [key]);
    if (printer) db.runSync('INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)',
      [key, JSON.stringify(printer), new Date().toISOString()]);
  });
}

export async function printPallet(entry: PalletCount, printer: Printer | null) {
  const { codigo, descricao, quantidade, endereco, uc } = entry;
  const payload = JSON.stringify({ codigo, descricao, quantidade, endereco, uc });
  const display = String(quantidade).replace('.', ',');
  if (printer) {
    await bluetoothAccess();
    await nativePrinter().sendBluetooth(payload, display, printer.address);
  } else {
    await nativePrinter().print(payload, display);
  }
}
