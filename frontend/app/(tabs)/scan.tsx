import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
  TextInput, Alert, KeyboardAvoidingView, Vibration, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { ScanLine, Keyboard, X, CheckCircle2, AlertCircle, Type, Camera, Search } from 'lucide-react-native';
import { Colors } from '../../src/theme/colors';
import { createItem, getItemByCode } from '../../src/db/itemsDB';
import { ensureOpenSession } from '../../src/db/sessionsDB';
import { saveCount } from '../../src/db/countsDB';
import { recognizeTextFromImage } from '../../src/services/textRecognitionService';

type DetectionMode = 'barcode' | 'text';

function normalizeNumericCode(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const onlyDigits = trimmed.replace(/\D/g, '');
  if (!onlyDigits) return '';
  const preferredMatch = onlyDigits.match(/\d{8,14}/);
  return preferredMatch ? preferredMatch[0] : onlyDigits;
}

function parseNumber(value: string): number {
  const normalized = value.trim().replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getFirstMeaningfulLine(value: string): string {
  return value
    .split(/\n+/)
    .map((part) => part.trim())
    .find(Boolean) ?? '';
}

function getTextLookupPayload(rawText: string): { code: string; fallbackDescription: string } {
  const lines = rawText
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const code = normalizeNumericCode(rawText);
  const fallbackDescription =
    lines.find((line) => normalizeNumericCode(line) !== line.replace(/\D/g, '') || !normalizeNumericCode(line))
    ?? lines.find((line) => line !== code)
    ?? getFirstMeaningfulLine(rawText);

  return { code, fallbackDescription };
}

export default function ScanScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [manualMode, setManualMode] = useState(Platform.OS === 'web');
  const [detectionMode, setDetectionMode] = useState<DetectionMode>('barcode');
  const [cameraReady, setCameraReady] = useState(Platform.OS === 'web');
  const [manualCode, setManualCode] = useState('');
  const [lastCode, setLastCode] = useState('');
  const [ocrText, setOcrText] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [foundItem, setFoundItem] = useState<{ descricao: string; saldo: number; localizacao: string } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newUnit, setNewUnit] = useState('UN');
  const [newLocation, setNewLocation] = useState('');
  const [newSystemBalance, setNewSystemBalance] = useState('0');
  const [newMinimumStock, setNewMinimumStock] = useState('0');
  const [newAdjustmentCost, setNewAdjustmentCost] = useState('0');
  const [newCountQuantity, setNewCountQuantity] = useState('');
  const [newObservation, setNewObservation] = useState('');
  const [creatingItem, setCreatingItem] = useState(false);
  const lastScanAtRef = useRef(0);
  const lastScanValueRef = useRef<string>('');
  const cooldownRef = useRef(false);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function sanitizeBarcodeInput(value: string): string {
    return normalizeNumericCode(value);
  }

  function resetNewItemForm() {
    setNewDescription('');
    setNewCategory('');
    setNewUnit('UN');
    setNewLocation('');
    setNewSystemBalance('0');
    setNewMinimumStock('0');
    setNewAdjustmentCost('0');
    setNewCountQuantity('');
    setNewObservation('');
  }

  const applyLookupResult = useCallback((value: string, fallbackDescription?: string) => {
    const normalized = value.trim();
    setScanned(true);
    setLastCode(normalized);

    const item = normalized ? getItemByCode(normalized) : null;
    if (item) {
      setFoundItem({ descricao: item.descricao, saldo: item.saldo_sistema, localizacao: item.localizacao });
      setNotFound(false);
      resetNewItemForm();
      if (Platform.OS !== 'web') Vibration.vibrate(80);
      return;
    }

    setFoundItem(null);
    setNotFound(true);
    resetNewItemForm();
    if (fallbackDescription?.trim()) {
      setNewDescription(fallbackDescription.trim());
    }
    if (Platform.OS !== 'web') Vibration.vibrate([0, 80, 80, 80]);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' && !permission?.granted) {
      requestPermission();
    }
    return () => {
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
      }
    };
  }, [permission?.granted, requestPermission]);

  const handleCodeDetected = useCallback(
    (codigo: string) => {
      const value = normalizeNumericCode(codigo);
      if (!value) return;

      const now = Date.now();
      const lastValue = lastScanValueRef.current;
      const lastAt = lastScanAtRef.current;
      if (lastValue === value && now - lastAt < 1500) return;
      if (cooldownRef.current) return;
      cooldownRef.current = true;

      lastScanValueRef.current = value;
      lastScanAtRef.current = now;
      setOcrText('');
      applyLookupResult(value);

      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
      }
      cooldownTimerRef.current = setTimeout(() => {
        cooldownRef.current = false;
      }, 350);
    },
    [applyLookupResult]
  );

  const handleManualSubmit = () => {
    if (detectionMode === 'barcode') {
      const sanitized = sanitizeBarcodeInput(manualCode);
      if (!sanitized) return;
      setManualCode(sanitized);
      handleCodeDetected(sanitized);
      return;
    }

    const rawText = manualCode.trim();
    if (!rawText) return;
    setOcrText(rawText);
    const payload = getTextLookupPayload(rawText);
    applyLookupResult(payload.code, payload.fallbackDescription);
  };

  const handleTextCapture = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('OCR no navegador', 'Use o modo Manual > Texto para colar ou digitar o texto reconhecido.');
      return;
    }

    if (!cameraReady) {
      Alert.alert('Camera inicializando', 'Aguarde a camera ficar pronta antes de capturar o texto.');
      return;
    }

    if (!cameraRef.current?.takePictureAsync) {
      Alert.alert('Camera indisponivel', 'Nao foi possivel capturar a imagem para OCR.');
      return;
    }

    setOcrLoading(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        skipProcessing: true,
      });
      const imagePath = photo?.uri;
      if (!imagePath) {
        throw new Error('Falha ao capturar imagem.');
      }

      const recognized = await recognizeTextFromImage(imagePath);
      const rawText = recognized.text?.trim() ?? '';
      if (!rawText) {
        throw new Error('Nenhum texto reconhecido.');
      }

      setOcrText(rawText);
      const payload = getTextLookupPayload(rawText);
      applyLookupResult(payload.code, payload.fallbackDescription);
    } catch (e: any) {
      Alert.alert('Falha no OCR', e?.message ?? 'Nao foi possivel reconhecer o texto da imagem.');
    } finally {
      setOcrLoading(false);
    }
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
    setLastCode('');
    setOcrText('');
    resetNewItemForm();
    setCreatingItem(false);
    setOcrLoading(false);
    setCameraReady(Platform.OS === 'web');
    cooldownRef.current = false;
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
  };

  const handleCreateItemAndCount = async () => {
    const codigo = lastCode.trim();
    const descricao = newDescription.trim();
    const quantidadeContada = parseNumber(newCountQuantity);

    if (!codigo) {
      Alert.alert('Codigo obrigatorio', 'Informe um codigo para cadastrar o item.');
      return;
    }

    if (!descricao) {
      Alert.alert('Descricao obrigatoria', 'Informe o nome do item para salvar o cadastro.');
      return;
    }

    if (newCountQuantity.trim() === '' || quantidadeContada < 0) {
      Alert.alert('Quantidade invalida', 'Informe uma quantidade contada valida.');
      return;
    }

    setCreatingItem(true);
    try {
      const created = createItem({
        codigo,
        descricao,
        categoria: newCategory.trim(),
        unidade: newUnit.trim() || 'UN',
        localizacao: newLocation.trim(),
        saldo_sistema: parseNumber(newSystemBalance),
        estoque_minimo: parseNumber(newMinimumStock),
        custo_ajuste: parseNumber(newAdjustmentCost),
      });

      const session = ensureOpenSession();
      saveCount({
        session_id: session.id,
        item_id: created.id,
        codigo: created.codigo,
        descricao: created.descricao,
        saldo_sistema: created.saldo_sistema,
        quantidade_contada: quantidadeContada,
        localizacao: created.localizacao,
        observacao: newObservation.trim(),
        escaneado: true,
      });

      Alert.alert('Item cadastrado', `O item ${created.codigo} foi criado e a contagem registrada.`);
      resetScan();
    } catch (e: any) {
      Alert.alert('Erro ao cadastrar item', e?.message ?? 'Nao foi possivel cadastrar o item a partir do scanner.');
    } finally {
      setCreatingItem(false);
    }
  };

  if (!permission && Platform.OS !== 'web') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.permText}>Solicitando permissao de camera...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
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
          {manualMode ? <Camera size={20} color={Colors.brand.primary} /> : <Keyboard size={20} color={Colors.brand.primary} />}
          <Text style={styles.modeBtnText}>{manualMode ? 'Camera' : 'Manual'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.detectRow}>
        <TouchableOpacity
          style={[styles.detectChip, detectionMode === 'barcode' && styles.detectChipActive]}
          onPress={() => {
            setDetectionMode('barcode');
            resetScan();
          }}
        >
          <ScanLine size={16} color={detectionMode === 'barcode' ? '#fff' : Colors.text.secondary} />
          <Text style={[styles.detectChipText, detectionMode === 'barcode' && styles.detectChipTextActive]}>Codigo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.detectChip, detectionMode === 'text' && styles.detectChipActive]}
          onPress={() => {
            setDetectionMode('text');
            resetScan();
          }}
        >
          <Type size={16} color={detectionMode === 'text' ? '#fff' : Colors.text.secondary} />
          <Text style={[styles.detectChipText, detectionMode === 'text' && styles.detectChipTextActive]}>Texto</Text>
        </TouchableOpacity>
      </View>

      {!manualMode && Platform.OS !== 'web' && permission?.granted ? (
        <View style={styles.cameraWrap}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFillObject}
            facing="back"
            onCameraReady={() => setCameraReady(true)}
            onMountError={() => setCameraReady(false)}
            onBarcodeScanned={
              detectionMode === 'barcode' && !scanned
                ? ({ data }) => handleCodeDetected(data)
                : undefined
            }
          />
          <View style={styles.overlay}>
            <View style={styles.overlayTop} />
            <View style={styles.overlayMid}>
              <View style={styles.overlayLeft} />
              <View style={styles.scanBox}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
              </View>
              <View style={styles.overlayRight} />
            </View>
            <View style={styles.overlayBottom}>
              <Text style={styles.scanHint}>
                {detectionMode === 'barcode' ? 'Aponte para o codigo de barras' : 'Centralize o texto da etiqueta'}
              </Text>
              {detectionMode === 'text' ? (
                <TouchableOpacity style={[styles.ocrCaptureBtn, (!cameraReady || ocrLoading) && styles.ocrCaptureBtnDisabled]} onPress={handleTextCapture} disabled={!cameraReady || ocrLoading}>
                  {ocrLoading ? <ActivityIndicator color="#fff" /> : <Search size={18} color="#fff" />}
                  <Text style={styles.ocrCaptureText}>
                    {ocrLoading ? 'Lendo texto...' : cameraReady ? 'Capturar texto' : 'Inicializando camera...'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.manualWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView contentContainerStyle={styles.manualInner} keyboardShouldPersistTaps="handled">
            {!permission?.granted && Platform.OS !== 'web' && (
              <View style={styles.permCard}>
                <AlertCircle size={32} color={Colors.brand.warning} />
                <Text style={styles.permTitle}>Permissao de camera necessaria</Text>
                <TouchableOpacity testID="grant-perm-btn" style={styles.permBtn} onPress={requestPermission}>
                  <Text style={styles.permBtnText}>Conceder permissao</Text>
                </TouchableOpacity>
                <Text style={styles.permSub}>ou use entrada manual abaixo</Text>
              </View>
            )}
            <Text style={styles.manualLabel}>
              {detectionMode === 'barcode' ? 'Codigo de barras / EAN' : 'Texto reconhecido / digitado'}
            </Text>
            <TextInput
              testID="manual-barcode-input"
              style={[styles.manualInput, detectionMode === 'text' && styles.manualTextArea]}
              value={manualCode}
              onChangeText={(value) => setManualCode(detectionMode === 'barcode' ? sanitizeBarcodeInput(value) : value)}
              placeholder={detectionMode === 'barcode' ? 'Ex: 7891234567890' : 'Cole aqui o texto da etiqueta'}
              placeholderTextColor={Colors.text.muted}
              keyboardType={detectionMode === 'barcode' ? 'number-pad' : 'default'}
              autoFocus={manualMode}
              onSubmitEditing={handleManualSubmit}
              returnKeyType="search"
              multiline={detectionMode === 'text'}
              numberOfLines={detectionMode === 'text' ? 5 : 1}
              textAlignVertical={detectionMode === 'text' ? 'top' : 'center'}
            />
            <TouchableOpacity
              testID="manual-search-btn"
              style={styles.searchBtn}
              onPress={handleManualSubmit}
            >
              <Text style={styles.searchBtnText}>
                {detectionMode === 'barcode' ? 'Buscar item' : 'Ler texto'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {(foundItem || notFound || scanned) && (
        <View style={[styles.resultCard, foundItem ? styles.resultFound : styles.resultNotFound]}>
          <View style={styles.resultHeader}>
            {foundItem ? (
              <CheckCircle2 size={20} color={Colors.brand.success} />
            ) : (
              <AlertCircle size={20} color={Colors.brand.warning} />
            )}
            <Text style={styles.resultCode}>{lastCode || 'Sem codigo reconhecido'}</Text>
            <TouchableOpacity testID="close-result-btn" onPress={resetScan} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={18} color={Colors.text.muted} />
            </TouchableOpacity>
          </View>

          {ocrText ? (
            <View style={styles.ocrBlock}>
              <Text style={styles.ocrLabel}>Texto lido</Text>
              <Text style={styles.ocrValue}>{ocrText}</Text>
            </View>
          ) : null}

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
              <Text style={styles.resultNotFoundText}>Item nao encontrado no estoque local</Text>
              <View style={styles.newItemForm}>
                <TextInput
                  style={styles.newItemInput}
                  value={lastCode}
                  onChangeText={setLastCode}
                  placeholder="Codigo *"
                  placeholderTextColor={Colors.text.muted}
                />
                <TextInput
                  style={styles.newItemInput}
                  value={newDescription}
                  onChangeText={setNewDescription}
                  placeholder="Nome do item *"
                  placeholderTextColor={Colors.text.muted}
                />
                <View style={styles.newItemRow}>
                  <TextInput
                    style={[styles.newItemInput, styles.newItemHalf]}
                    value={newCategory}
                    onChangeText={setNewCategory}
                    placeholder="Categoria"
                    placeholderTextColor={Colors.text.muted}
                  />
                  <TextInput
                    style={[styles.newItemInput, styles.newItemHalf]}
                    value={newUnit}
                    onChangeText={setNewUnit}
                    placeholder="Unidade"
                    placeholderTextColor={Colors.text.muted}
                  />
                </View>
                <TextInput
                  style={styles.newItemInput}
                  value={newLocation}
                  onChangeText={setNewLocation}
                  placeholder="Localizacao"
                  placeholderTextColor={Colors.text.muted}
                />
                <View style={styles.newItemRow}>
                  <TextInput
                    style={[styles.newItemInput, styles.newItemThird]}
                    value={newSystemBalance}
                    onChangeText={setNewSystemBalance}
                    placeholder="Saldo"
                    placeholderTextColor={Colors.text.muted}
                    keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
                  />
                  <TextInput
                    style={[styles.newItemInput, styles.newItemThird]}
                    value={newMinimumStock}
                    onChangeText={setNewMinimumStock}
                    placeholder="Minimo"
                    placeholderTextColor={Colors.text.muted}
                    keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
                  />
                  <TextInput
                    style={[styles.newItemInput, styles.newItemThird]}
                    value={newAdjustmentCost}
                    onChangeText={setNewAdjustmentCost}
                    placeholder="Custo"
                    placeholderTextColor={Colors.text.muted}
                    keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
                  />
                </View>
                <TextInput
                  style={styles.newItemInput}
                  value={newCountQuantity}
                  onChangeText={setNewCountQuantity}
                  placeholder="Quantidade contada *"
                  placeholderTextColor={Colors.text.muted}
                  keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
                />
                <TextInput
                  style={[styles.newItemInput, styles.newItemTextarea]}
                  value={newObservation}
                  onChangeText={setNewObservation}
                  placeholder="Observacao"
                  placeholderTextColor={Colors.text.muted}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
              <TouchableOpacity testID="count-new-btn" style={styles.countBtn} onPress={handleCreateItemAndCount} disabled={creatingItem}>
                <Text style={styles.countBtnText}>{creatingItem ? 'Salvando...' : 'Cadastrar item e registrar contagem'}</Text>
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
  detectRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  detectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    backgroundColor: Colors.bg.secondary,
  },
  detectChipActive: {
    backgroundColor: Colors.brand.primary,
    borderColor: Colors.brand.primary,
  },
  detectChipText: {
    color: Colors.text.secondary,
    fontSize: 12,
    fontWeight: '700',
  },
  detectChipTextActive: {
    color: '#fff',
  },
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
  ocrCaptureBtn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.brand.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  ocrCaptureBtnDisabled: {
    opacity: 0.65,
  },
  ocrCaptureText: { color: '#fff', fontWeight: '700', fontSize: 14 },
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
  manualInner: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32, gap: 12 },
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
  manualTextArea: {
    minHeight: 140,
    paddingTop: 16,
    letterSpacing: 0,
    fontFamily: undefined,
    fontSize: 15,
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
  ocrBlock: {
    borderRadius: 10,
    backgroundColor: Colors.bg.primary,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    padding: 10,
    gap: 4,
  },
  ocrLabel: { fontSize: 11, color: Colors.text.muted, textTransform: 'uppercase' },
  ocrValue: { fontSize: 13, color: Colors.text.primary, lineHeight: 18 },
  resultDescricao: { fontSize: 16, fontWeight: '700', color: Colors.text.primary },
  resultMeta: { flexDirection: 'row', gap: 16 },
  resultMetaText: { fontSize: 13, color: Colors.text.secondary },
  resultMetaVal: { fontWeight: '700', color: Colors.text.primary },
  resultNotFoundText: { fontSize: 14, color: Colors.brand.warning, marginBottom: 4 },
  newItemForm: { gap: 10 },
  newItemRow: { flexDirection: 'row', gap: 8 },
  newItemInput: {
    backgroundColor: Colors.bg.primary,
    borderWidth: 1,
    borderColor: Colors.border.strong,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    color: Colors.text.primary,
    fontSize: 13,
  },
  newItemHalf: { flex: 1 },
  newItemThird: { flex: 1 },
  newItemTextarea: {
    minHeight: 78,
    paddingTop: 12,
  },
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
