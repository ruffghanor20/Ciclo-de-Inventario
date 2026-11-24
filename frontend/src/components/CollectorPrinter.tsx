import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check, Printer as PrinterIcon } from 'lucide-react-native';
import { pairedPrinters, type Printer } from '../services/labelPrinter';

export function CollectorPrinter({ current, choose, close }: {
  current: Printer | null; choose: (device: Printer | null) => void; close: () => void;
}) {
  const [paired, setPaired] = useState<Printer[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  async function loadPaired() {
    setLoading(true); setStatus('');
    try {
      const devices = await pairedPrinters();
      setPaired(devices);
      if (!devices.length) setStatus('Nenhum dispositivo pareado. Pareie a Zebra nas configurações Bluetooth do coletor.');
    } catch (e) { setStatus((e as Error).message); }
    finally { setLoading(false); }
  }
  return <Modal visible transparent animationType="fade" onRequestClose={close}>
    <View style={s.overlay}><View style={s.sheet}>
      <View style={s.row}><PrinterIcon color="#66baff" /><Text style={s.title}>Impressora da contagem</Text></View>
      <Text style={s.note}>Zebra ZQ510 · 203 dpi · bobina de 60 mm, avanço de 90 mm.</Text>
      <Pressable style={s.option} onPress={() => choose(null)}><Text style={s.text}>Serviço de impressão do Android</Text>{!current && <Check color="#77d8ba" />}</Pressable>
      <Pressable disabled={loading} style={s.option} onPress={loadPaired}><Text style={s.text}>{loading ? 'Buscando…' : 'Ver impressoras Bluetooth pareadas'}</Text></Pressable>
      <ScrollView style={{ maxHeight: 248 }} keyboardShouldPersistTaps="handled">
        {paired.map((printer) => <Pressable key={printer.address} style={s.option} onPress={() => choose(printer)}>
          <View style={{ flex: 1 }}><Text style={s.text}>{printer.name}</Text><Text style={s.note}>{printer.address}</Text></View>
          {current?.address === printer.address && <Check color="#77d8ba" />}
        </Pressable>)}
      </ScrollView>
      {status ? <Text style={s.note}>{status}</Text> : null}
      <Pressable style={s.option} onPress={close}><Text style={s.text}>Fechar</Text></Pressable>
    </View></View>
  </Modal>;
}
const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#0009', justifyContent: 'center', padding: 20 },
  sheet: { backgroundColor: '#182230', padding: 20, gap: 12, borderRadius: 16 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  title: { color: 'white', fontSize: 20, fontWeight: '700', flexShrink: 1 },
  note: { color: '#bdcbda', fontSize: 14, lineHeight: 20 },
  option: { minHeight: 46, padding: 10, borderRadius: 8, backgroundColor: '#263449', flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 2 },
  text: { color: '#edf4fa', fontSize: 15, fontWeight: '600', flexShrink: 1 },
});
