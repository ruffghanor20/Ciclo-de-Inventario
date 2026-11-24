import React, { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { parseField, type ScanField } from '../utils/palletRules';

export function PalletScanner({ field, onRead, onClose }: {
  field: ScanField; onRead: (value: string) => void; onClose: () => void;
}) {
  const [permission, request] = useCameraPermissions();
  const [error, setError] = useState('');
  const accepted = useRef(false);
  const name = field === 'uc' ? 'UC' : 'endereço';
  const read = (raw: string) => {
    if (accepted.current) return;
    try {
      const value = parseField(field, raw);
      accepted.current = true;
      onRead(value);
    } catch (e) { setError((e as Error).message); }
  };
  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={s.page}>
        <View style={s.bar}>
          <Text style={s.title}>Ler {name}</Text>
          <Pressable style={s.close} onPress={onClose} accessibilityLabel="Fechar câmera"><X color="white" /></Pressable>
        </View>
        {permission?.granted ? (
          <View style={s.camera}>
            <CameraView style={StyleSheet.absoluteFill} facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'code39', 'itf14', 'ean13', 'ean8', 'upc_a', 'datamatrix', 'pdf417', 'aztec', 'codabar', 'code93'] }}
              onMountError={() => setError('Câmera indisponível. Feche e digite o valor no campo.')}
              onBarcodeScanned={({ data }) => read(data)} />
            <View pointerEvents="none" style={s.target} />
          </View>
        ) : <View style={s.center}>
          <Text style={s.info}>{permission?.canAskAgain === false ? 'Ative a câmera nas permissões do Android ou digite o valor.' : 'Permita usar a câmera para ler a etiqueta.'}</Text>
          {permission?.canAskAgain !== false && <Pressable style={s.button} onPress={request}><Text style={s.buttonText}>Permitir câmera</Text></Pressable>}
        </View>}
        <Text accessibilityLiveRegion="polite" style={s.info}>{error || (field === 'uc' ? 'Aponte para a etiqueta de UC de 10 dígitos.' : 'Aponte para o QR da posição no estoque.')}</Text>
        <Pressable style={s.button} onPress={onClose}><Text style={s.buttonText}>Voltar e digitar</Text></Pressable>
      </SafeAreaView>
    </Modal>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#101722', padding: 16, gap: 14 },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 22, color: 'white', fontWeight: '700' }, close: { padding: 12 },
  camera: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 14 },
  target: { width: '78%', height: 180, borderWidth: 2, borderColor: '#75cbff', borderRadius: 14 },
  info: { color: '#e4ebf4', fontSize: 16, textAlign: 'center', padding: 6 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  button: { alignItems: 'center', justifyContent: 'center', minHeight: 48, backgroundColor: '#26354c', borderRadius: 10, paddingHorizontal: 20 },
  buttonText: { color: 'white', fontWeight: '700', fontSize: 15 }
});
