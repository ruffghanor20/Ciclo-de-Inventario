import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect } from 'expo-router';
import { Camera, Download, FileSpreadsheet, Save, X } from 'lucide-react-native';
import { Colors } from '../../src/theme/colors';
import {
  BlendCount,
  BlendMaterial,
  createBlendCount,
  ensureBlendSchema,
  getBlendCountsByMachine,
  getBlendCountsBySession,
  getBlendMaterialCount,
  MaterialTipo,
  searchBlendMaterials,
} from '../../src/db/blendDB';
import { getOpenSession, Session } from '../../src/db/sessionsDB';
import { getUsername } from '../../src/db/settingsDB';
import { exportBlendCountsXLSX, importBlendBaseXLSX } from '../../src/services/blendXlsxService';

const INJETORAS = Array.from({ length: 52 }, (_, i) => {
  const code = String(i + 1).padStart(2, '0');
  return { id: code, label: `Injetora ${code}`, tipo: 'Injetora' };
});

const SOPRADORAS = Array.from({ length: 8 }, (_, i) => {
  const n = 92 + i;
  const code = String(n);
  return {
    id: code,
    label: n === 97 ? 'Extrusora 97' : `Sopradora ${code}`,
    tipo: n === 97 ? 'Extrusora' : 'Sopradora',
  };
});

const MACHINES = [...INJETORAS, ...SOPRADORAS];

function parseKg(value: string): number {
  const n = Number(value.trim().replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

function CodeAutocomplete({
  label,
  tipo,
  value,
  onChange,
}: {
  label: string;
  tipo: MaterialTipo;
  value: string;
  onChange: (value: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const suggestions = useMemo(() => {
    if (!focused || !value.trim()) return [];
    return searchBlendMaterials(value, tipo, 6);
  }, [focused, tipo, value]);

  const choose = (item: BlendMaterial) => {
    onChange(item.codigo);
    setFocused(false);
  };

  return (
    <View style={styles.autoWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        autoCapitalize="characters"
        placeholder="Digite o código"
        placeholderTextColor={Colors.text.muted}
        style={styles.input}
      />
      {suggestions.length > 0 && (
        <View style={styles.suggestions}>
          {suggestions.map((item) => (
            <TouchableOpacity key={`${item.tipo}-${item.id}`} style={styles.suggestion} onPress={() => choose(item)}>
              <Text style={styles.suggestionCode}>{item.codigo}</Text>
              <Text style={styles.suggestionDesc} numberOfLines={1}>{item.descricao}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

function KgField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <View style={styles.kgWrap}>
      <Text style={styles.fieldLabel}>Quantidade</Text>
      <View style={styles.kgInputWrap}>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          placeholder="0,000"
          placeholderTextColor={Colors.text.muted}
          style={[styles.input, styles.kgInput]}
        />
        <Text style={styles.kgSuffix}>kg</Text>
      </View>
    </View>
  );
}

export default function BlendsScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [machineId, setMachineId] = useState('');
  const [mode, setMode] = useState<'BLEND' | 'DOSADOR'>('BLEND');
  const [blendCode, setBlendCode] = useState('');
  const [blendKg, setBlendKg] = useState('');
  const [components, setComponents] = useState([
    { code: '', kg: '' }, { code: '', kg: '' }, { code: '', kg: '' },
  ]);
  const [photoUri, setPhotoUri] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [counts, setCounts] = useState<BlendCount[]>([]);
  const [baseCount, setBaseCount] = useState(0);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);

  const selectedMachine = useMemo(() => MACHINES.find((m) => m.id === machineId), [machineId]);

  const refresh = useCallback(() => {
    ensureBlendSchema();
    const open = getOpenSession();
    setSession(open);
    setBaseCount(getBlendMaterialCount());
    if (open && machineId) setCounts(getBlendCountsByMachine(open.id, machineId));
    else setCounts([]);
  }, [machineId]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const updateComponent = (index: number, field: 'code' | 'kg', value: string) => {
    setComponents((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const clearForm = () => {
    setBlendCode('');
    setBlendKg('');
    setComponents([{ code: '', kg: '' }, { code: '', kg: '' }, { code: '', kg: '' }]);
    setPhotoUri('');
    setCameraOpen(false);
  };

  const handleImportBase = async () => {
    try {
      const result = await importBlendBaseXLSX();
      if (!result) return;
      setBaseCount(getBlendMaterialCount());
      Alert.alert('Base importada', `${result.createdOrUpdated} códigos processados.\n${result.ignored} linhas ignoradas.`);
    } catch (error) {
      Alert.alert('Erro na importação', error instanceof Error ? error.message : 'Não foi possível importar a base.');
    }
  };

  const handleExport = async () => {
    if (!session) return Alert.alert('Sem sessão', 'Inicie ou carregue uma sessão antes de exportar.');
    const all = getBlendCountsBySession(session.id);
    if (!all.length) return Alert.alert('Sem contagens', 'Não existem contagens de blend nesta sessão.');
    try {
      await exportBlendCountsXLSX(all, session);
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Falha ao gerar o Excel.');
    }
  };

  const openCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) return Alert.alert('Câmera', 'Permissão de câmera necessária para anexar a foto da contagem.');
    }
    setCameraOpen(true);
  };

  const takePhoto = async () => {
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.6, skipProcessing: false });
      if (photo?.uri) {
        setPhotoUri(photo.uri);
        setCameraOpen(false);
      }
    } catch {
      Alert.alert('Câmera', 'Não foi possível capturar a foto.');
    }
  };

  const handleSave = () => {
    if (!session) return Alert.alert('Sessão obrigatória', 'Inicie uma sessão e selecione o depósito 1020 ou 1023.');
    if (!selectedMachine) return Alert.alert('Máquina obrigatória', 'Selecione uma injetora, sopradora ou a extrusora.');

    let payload;
    if (mode === 'BLEND') {
      const kg = parseKg(blendKg);
      if (!blendCode.trim() || !Number.isFinite(kg) || kg <= 0) {
        return Alert.alert('Dados incompletos', 'Informe o código da blend e uma quantidade em kg maior que zero.');
      }
      payload = {
        blend_codigo: blendCode.trim().toUpperCase(), blend_kg: kg,
        comp1_codigo: '', comp1_kg: 0, comp2_codigo: '', comp2_kg: 0, comp3_codigo: '', comp3_kg: 0,
      };
    } else {
      const parsed = components.map((c) => ({ code: c.code.trim().toUpperCase(), kg: parseKg(c.kg) }));
      if (parsed.some((c) => !c.code || !Number.isFinite(c.kg) || c.kg <= 0)) {
        return Alert.alert('Dados incompletos', 'No dosador, informe os 3 componentes e a quantidade em kg de cada um.');
      }
      payload = {
        blend_codigo: '', blend_kg: 0,
        comp1_codigo: parsed[0].code, comp1_kg: parsed[0].kg,
        comp2_codigo: parsed[1].code, comp2_kg: parsed[1].kg,
        comp3_codigo: parsed[2].code, comp3_kg: parsed[2].kg,
      };
    }

    createBlendCount({
      session_id: session.id,
      deposito: session.deposito || '1023',
      maquina: selectedMachine.id,
      tipo_maquina: selectedMachine.tipo,
      modo: mode,
      ...payload,
      foto_uri: photoUri,
      observacao: '',
      responsavel: getUsername() || session.responsavel || 'Operador',
    });
    clearForm();
    refresh();
    Alert.alert('Contagem salva', `${selectedMachine.label} registrada com sucesso.`);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.summaryCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Contagem de Blend</Text>
            <Text style={styles.subtitle}>
              {session ? `Sessão: ${session.nome} · Depósito ${session.deposito}` : 'Nenhuma sessão aberta'}
            </Text>
            <Text style={styles.baseText}>Base cadastrada: {baseCount} códigos</Text>
          </View>
          <View style={styles.topActions}>
            <TouchableOpacity style={styles.iconBtn} onPress={handleImportBase}>
              <FileSpreadsheet size={18} color={Colors.text.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={handleExport}>
              <Download size={18} color={Colors.text.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionTitle}>1. Selecione a máquina</Text>
        <Text style={styles.groupLabel}>Injetoras 01–52</Text>
        <View style={styles.machineGrid}>
          {INJETORAS.map((m) => (
            <TouchableOpacity key={m.id} style={[styles.machineBtn, machineId === m.id && styles.machineBtnActive]} onPress={() => setMachineId(m.id)}>
              <Text style={[styles.machineText, machineId === m.id && styles.machineTextActive]}>{m.id}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.groupLabel}>Sopradoras 92–99 · 97 = Extrusora</Text>
        <View style={styles.machineGrid}>
          {SOPRADORAS.map((m) => (
            <TouchableOpacity key={m.id} style={[styles.machineBtnWide, machineId === m.id && styles.machineBtnActive]} onPress={() => setMachineId(m.id)}>
              <Text style={[styles.machineText, machineId === m.id && styles.machineTextActive]}>{m.id === '97' ? '97 EXT' : m.id}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {selectedMachine && <Text style={styles.selectedMachine}>Selecionada: {selectedMachine.label}</Text>}

        <Text style={styles.sectionTitle}>2. Tipo de alimentação</Text>
        <View style={styles.modeRow}>
          {(['BLEND', 'DOSADOR'] as const).map((item) => (
            <TouchableOpacity key={item} style={[styles.modeBtn, mode === item && styles.modeBtnActive]} onPress={() => setMode(item)}>
              <View style={[styles.radio, mode === item && styles.radioActive]} />
              <Text style={[styles.modeText, mode === item && styles.modeTextActive]}>{item === 'BLEND' ? 'Blend' : 'Dosador'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>3. Materiais e peso</Text>
        {mode === 'BLEND' ? (
          <View style={styles.materialRow}>
            <CodeAutocomplete label="Código da blend" tipo="BLEND" value={blendCode} onChange={setBlendCode} />
            <KgField value={blendKg} onChange={setBlendKg} />
          </View>
        ) : (
          <View style={styles.componentList}>
            {components.map((component, index) => (
              <View style={styles.materialRow} key={index}>
                <CodeAutocomplete label={`Componente ${index + 1}`} tipo="DOSADOR" value={component.code} onChange={(v) => updateComponent(index, 'code', v)} />
                <KgField value={component.kg} onChange={(v) => updateComponent(index, 'kg', v)} />
              </View>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>4. Foto da contagem</Text>
        {cameraOpen ? (
          <View style={styles.cameraWrap}>
            <CameraView ref={cameraRef} style={styles.camera} facing="back" />
            <View style={styles.cameraActions}>
              <TouchableOpacity style={styles.cameraAction} onPress={() => setCameraOpen(false)}><X size={20} color="#fff" /><Text style={styles.cameraActionText}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.cameraAction, styles.capture]} onPress={takePhoto}><Camera size={20} color="#fff" /><Text style={styles.cameraActionText}>Fotografar</Text></TouchableOpacity>
            </View>
          </View>
        ) : photoUri ? (
          <View style={styles.photoWrap}>
            <Image source={{ uri: photoUri }} style={styles.photo} />
            <TouchableOpacity style={styles.secondaryBtn} onPress={openCamera}><Camera size={17} color={Colors.text.primary} /><Text style={styles.secondaryBtnText}>Refazer foto</Text></TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.secondaryBtn} onPress={openCamera}><Camera size={18} color={Colors.text.primary} /><Text style={styles.secondaryBtnText}>Adicionar foto</Text></TouchableOpacity>
        )}

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Save size={19} color="#fff" />
          <Text style={styles.saveText}>Salvar contagem</Text>
        </TouchableOpacity>

        {selectedMachine && (
          <View style={styles.history}>
            <Text style={styles.sectionTitle}>Contagens da {selectedMachine.label}</Text>
            {counts.length === 0 ? <Text style={styles.emptyText}>Nenhuma contagem registrada nesta sessão.</Text> : counts.map((item) => {
              const total = item.modo === 'BLEND' ? item.blend_kg : item.comp1_kg + item.comp2_kg + item.comp3_kg;
              return (
                <View style={styles.historyCard} key={item.id}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyTitle}>{item.modo} · {total.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg</Text>
                    <Text style={styles.historyText}>{item.modo === 'BLEND' ? item.blend_codigo : `${item.comp1_codigo} + ${item.comp2_codigo} + ${item.comp3_codigo}`}</Text>
                    <Text style={styles.historyText}>{new Date(item.created_at).toLocaleString('pt-BR')} · Dep. {item.deposito}</Text>
                  </View>
                  {item.foto_uri ? <Image source={{ uri: item.foto_uri }} style={styles.historyPhoto} /> : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg.primary },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  summaryCard: { backgroundColor: Colors.bg.secondary, borderWidth: 1, borderColor: Colors.border.subtle, borderRadius: 14, padding: 14, flexDirection: 'row', gap: 10 },
  title: { color: Colors.text.primary, fontSize: 21, fontWeight: '800' },
  subtitle: { color: Colors.text.secondary, fontSize: 12, marginTop: 3 },
  baseText: { color: Colors.brand.primary, fontSize: 11, marginTop: 5, fontWeight: '700' },
  topActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.bg.tertiary, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { color: Colors.text.primary, fontSize: 15, fontWeight: '800', marginTop: 6 },
  groupLabel: { color: Colors.text.muted, fontSize: 11, marginTop: 2 },
  machineGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  machineBtn: { width: 42, height: 38, borderRadius: 8, backgroundColor: Colors.bg.secondary, borderWidth: 1, borderColor: Colors.border.subtle, alignItems: 'center', justifyContent: 'center' },
  machineBtnWide: { minWidth: 58, height: 38, paddingHorizontal: 8, borderRadius: 8, backgroundColor: Colors.bg.secondary, borderWidth: 1, borderColor: Colors.border.subtle, alignItems: 'center', justifyContent: 'center' },
  machineBtnActive: { borderColor: Colors.brand.primary, backgroundColor: Colors.brand.primary + '22' },
  machineText: { color: Colors.text.secondary, fontSize: 12, fontWeight: '700' },
  machineTextActive: { color: Colors.brand.primary },
  selectedMachine: { color: Colors.brand.primary, fontSize: 12, fontWeight: '700' },
  modeRow: { flexDirection: 'row', gap: 10 },
  modeBtn: { flex: 1, height: 46, borderRadius: 10, borderWidth: 1, borderColor: Colors.border.subtle, backgroundColor: Colors.bg.secondary, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  modeBtnActive: { borderColor: Colors.brand.primary, backgroundColor: Colors.brand.primary + '18' },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: Colors.text.muted },
  radioActive: { borderColor: Colors.brand.primary, backgroundColor: Colors.brand.primary },
  modeText: { color: Colors.text.secondary, fontWeight: '700' },
  modeTextActive: { color: Colors.text.primary },
  componentList: { gap: 10 },
  materialRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', zIndex: 5 },
  autoWrap: { flex: 1, position: 'relative' },
  kgWrap: { width: 116 },
  fieldLabel: { color: Colors.text.secondary, fontSize: 11, marginBottom: 5 },
  input: { height: 43, borderRadius: 9, borderWidth: 1, borderColor: Colors.border.subtle, backgroundColor: Colors.bg.secondary, color: Colors.text.primary, paddingHorizontal: 11, fontSize: 13 },
  kgInputWrap: { position: 'relative' },
  kgInput: { paddingRight: 30 },
  kgSuffix: { position: 'absolute', right: 9, top: 13, color: Colors.text.muted, fontSize: 12 },
  suggestions: { marginTop: 3, borderRadius: 9, borderWidth: 1, borderColor: Colors.border.strong, backgroundColor: '#18181B', overflow: 'hidden' },
  suggestion: { paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border.subtle },
  suggestionCode: { color: Colors.brand.primary, fontSize: 12, fontWeight: '800' },
  suggestionDesc: { color: Colors.text.secondary, fontSize: 11, marginTop: 2 },
  secondaryBtn: { minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: Colors.border.strong, backgroundColor: Colors.bg.secondary, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  secondaryBtnText: { color: Colors.text.primary, fontSize: 13, fontWeight: '700' },
  cameraWrap: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border.strong },
  camera: { height: 300 },
  cameraActions: { flexDirection: 'row', gap: 8, padding: 8, backgroundColor: Colors.bg.secondary },
  cameraAction: { flex: 1, height: 42, borderRadius: 9, backgroundColor: '#3f3f46', flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  capture: { backgroundColor: Colors.brand.primary },
  cameraActionText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  photoWrap: { gap: 8 },
  photo: { width: '100%', height: 220, borderRadius: 12, backgroundColor: Colors.bg.secondary },
  saveBtn: { height: 50, borderRadius: 12, backgroundColor: Colors.brand.primary, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  saveText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  history: { gap: 8, marginTop: 8 },
  emptyText: { color: Colors.text.muted, fontSize: 12 },
  historyCard: { minHeight: 74, borderRadius: 11, padding: 11, backgroundColor: Colors.bg.secondary, borderWidth: 1, borderColor: Colors.border.subtle, flexDirection: 'row', gap: 10 },
  historyTitle: { color: Colors.text.primary, fontSize: 13, fontWeight: '800' },
  historyText: { color: Colors.text.secondary, fontSize: 11, marginTop: 3 },
  historyPhoto: { width: 62, height: 62, borderRadius: 8 },
});
