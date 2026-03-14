import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
  TextInput, Alert, KeyboardAvoidingView, Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { ScanLine, Keyboard, X, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { Colors } from '../../src/theme/colors';
import { getItemByCode } from '../../src/db/itemsDB';
import { ensureOpenSession } from '../../src/db/sessionsDB';

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [manualMode, setManualMode] = useState(Platform.OS === 'web');
  const [manualCode, setManualCode] = useState('');
  const [lastCode, setLastCode] = useState('');
  const [foundItem, setFoundItem] = useState<{ descricao: string; saldo: number; localizacao: string } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const cooldownRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'web' && !permission?.granted) {
      requestPermission();
    }
  }, []);

  const handleCodeDetected = useCallback(
    (codigo: string) => {
      if (cooldownRef.current) return;
      cooldownRef.current = true;
      setScanned(true);
      setLastCode(codigo);

      const item = getItemByCode(codigo);
      if (item) {
        setFoundItem({ descricao: item.descricao, saldo: item.saldo_sistema, localizacao: item.localizacao });
        setNotFound(false);
        if (Platform.OS !== 'web') Vibration.vibrate(80);
      } else {
        setFoundItem(null);
        setNotFound(true);
        if (Platform.OS !== 'web') Vibration.vibrate([0, 80, 80, 80]);
      }

      // Reset cooldown after 3 seconds
      setTimeout(() => {
        cooldownRef.current = false;
      }, 3000);
    },
    []
  );

  const handleManualSubmit = () => {
    if (!manualCode.trim()) return;
    handleCodeDetected(manualCode.trim());
  };

  const goToCount = () => {
    if (!lastCode) return;
    const session = ensureOpenSession();
    router.push({
      pathname: '/count',
      params: { codigo: lastCode, sessionId: session.id },
    });
    resetScan();
  };

  const resetScan = () => {
    setScanned(false);
    setFoundItem(null);
    setNotFound(false);
    setManualCode('');
    cooldownRef.current = false;
  };

  if (!permission && Platform.OS !== 'web') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.permText}>Solicitando permissão de câmera...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Scanner</Text>
        <TouchableOpacity
          testID="toggle-manual-btn"
          style={styles.modeBtn}
          onPress={() => {
            setManualMode(!manualMode);
            resetScan();
          }}
        >
          {manualMode ? <ScanLine size={20} color={Colors.brand.primary} /> : <Keyboard size={20} color={Colors.brand.primary} />}
          <Text style={styles.modeBtnText}>{manualMode ? 'Câmera' : 'Manual'}</Text>
        </TouchableOpacity>
      </View>

      {/* Camera or Manual */}
      {!manualMode && Platform.OS !== 'web' && permission?.granted ? (
        <View style={styles.cameraWrap}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            onBarcodeScanned={scanned ? undefined : ({ data }) => handleCodeDetected(data)}
            barcodeScannerSettings={{
              barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upcA', 'upcE', 'pdf417'],
            }}
          />
          {/* Overlay */}
          <View style={styles.overlay}>
            <View style={styles.overlayTop} />
            <View style={styles.overlayMid}>
              <View style={styles.overlayLeft} />
              <View style={styles.scanBox}>
                {/* Corner marks */}
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
              </View>
              <View style={styles.overlayRight} />
            </View>
            <View style={styles.overlayBottom}>
              <Text style={styles.scanHint}>Aponte para o código de barras</Text>
            </View>
          </View>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.manualWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.manualInner}>
            {!permission?.granted && Platform.OS !== 'web' && (
              <View style={styles.permCard}>
                <AlertCircle size={32} color={Colors.brand.warning} />
                <Text style={styles.permTitle}>Permissão de câmera necessária</Text>
                <TouchableOpacity testID="grant-perm-btn" style={styles.permBtn} onPress={requestPermission}>
                  <Text style={styles.permBtnText}>Conceder Permissão</Text>
                </TouchableOpacity>
                <Text style={styles.permSub}>ou use entrada manual abaixo</Text>
              </View>
            )}
            <Text style={styles.manualLabel}>Código de barras / EAN</Text>
            <TextInput
              testID="manual-barcode-input"
              style={styles.manualInput}
              value={manualCode}
              onChangeText={setManualCode}
              placeholder="Ex: 7891234567890"
              placeholderTextColor={Colors.text.muted}
              keyboardType="number-pad"
              autoFocus={manualMode}
              onSubmitEditing={handleManualSubmit}
              returnKeyType="search"
            />
            <TouchableOpacity
              testID="manual-search-btn"
              style={styles.searchBtn}
              onPress={handleManualSubmit}
            >
              <Text style={styles.searchBtnText}>Buscar Item</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Result Card */}
      {(foundItem || notFound || scanned) && (
        <View style={[styles.resultCard, foundItem ? styles.resultFound : styles.resultNotFound]}>
          <View style={styles.resultHeader}>
            {foundItem ? (
              <CheckCircle2 size={20} color={Colors.brand.success} />
            ) : (
              <AlertCircle size={20} color={Colors.brand.warning} />
            )}
            <Text style={styles.resultCode}>{lastCode}</Text>
            <TouchableOpacity testID="close-result-btn" onPress={resetScan} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={18} color={Colors.text.muted} />
            </TouchableOpacity>
          </View>

          {foundItem ? (
            <>
              <Text style={styles.resultDescricao}>{foundItem.descricao}</Text>
              <View style={styles.resultMeta}>
                <Text style={styles.resultMetaText}>Saldo sistema: <Text style={styles.resultMetaVal}>{foundItem.saldo}</Text></Text>
                {foundItem.localizacao ? (
                  <Text style={styles.resultMetaText}>Local: <Text style={styles.resultMetaVal}>{foundItem.localizacao}</Text></Text>
                ) : null}
              </View>
              <TouchableOpacity testID="count-now-btn" style={styles.countBtn} onPress={goToCount}>
                <Text style={styles.countBtnText}>Registrar Contagem</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.resultNotFoundText}>Item não encontrado no estoque local</Text>
              <TouchableOpacity testID="count-new-btn" style={styles.countBtn} onPress={goToCount}>
                <Text style={styles.countBtnText}>Registrar Mesmo Assim</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const OVERLAY_COLOR = 'rgba(0,0,0,0.6)';
const SCAN_BOX = 260;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg.primary },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text.primary },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.brand.primary + '20',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: Colors.brand.primary + '40',
  },
  modeBtnText: { fontSize: 13, color: Colors.brand.primary, fontWeight: '600' },
  cameraWrap: { flex: 1, position: 'relative', backgroundColor: '#000' },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  overlayTop: { flex: 1, backgroundColor: OVERLAY_COLOR },
  overlayMid: { flexDirection: 'row', height: SCAN_BOX },
  overlayLeft: { flex: 1, backgroundColor: OVERLAY_COLOR },
  scanBox: {
    width: SCAN_BOX,
    height: SCAN_BOX,
    borderRadius: 4,
    position: 'relative',
  },
  overlayRight: { flex: 1, backgroundColor: OVERLAY_COLOR },
  overlayBottom: { flex: 1, backgroundColor: OVERLAY_COLOR, alignItems: 'center', paddingTop: 16 },
  scanHint: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: Colors.brand.primary,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 4 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 4 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 4 },
  manualWrap: { flex: 1 },
  manualInner: { flex: 1, paddingHorizontal: 24, paddingTop: 24, gap: 12 },
  permCard: { alignItems: 'center', gap: 12, backgroundColor: Colors.bg.secondary, borderRadius: 14, padding: 20, marginBottom: 12 },
  permTitle: { fontSize: 15, fontWeight: '600', color: Colors.text.primary, textAlign: 'center' },
  permBtn: { backgroundColor: Colors.brand.primary, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  permBtnText: { color: '#fff', fontWeight: '700' },
  permSub: { fontSize: 12, color: Colors.text.muted },
  manualLabel: { fontSize: 14, fontWeight: '600', color: Colors.text.secondary },
  manualInput: {
    backgroundColor: Colors.bg.secondary,
    borderWidth: 1,
    borderColor: Colors.border.strong,
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 56,
    fontSize: 18,
    color: Colors.text.primary,
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  searchBtn: {
    backgroundColor: Colors.brand.primary,
    borderRadius: 10,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resultCard: {
    margin: 16,
    borderRadius: 16,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  resultFound: {
    backgroundColor: Colors.brand.success + '15',
    borderColor: Colors.brand.success + '40',
  },
  resultNotFound: {
    backgroundColor: Colors.brand.warning + '15',
    borderColor: Colors.brand.warning + '40',
  },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultCode: { flex: 1, fontSize: 13, color: Colors.text.muted, fontFamily: 'monospace' },
  resultDescricao: { fontSize: 16, fontWeight: '700', color: Colors.text.primary },
  resultMeta: { flexDirection: 'row', gap: 16 },
  resultMetaText: { fontSize: 13, color: Colors.text.secondary },
  resultMetaVal: { fontWeight: '700', color: Colors.text.primary },
  resultNotFoundText: { fontSize: 14, color: Colors.brand.warning },
  countBtn: {
    backgroundColor: Colors.brand.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  countBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  permText: { color: Colors.text.secondary, fontSize: 15 },
});
