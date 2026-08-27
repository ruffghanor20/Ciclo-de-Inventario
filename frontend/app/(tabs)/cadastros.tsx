import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import {
  Boxes,
  Factory,
  FileSpreadsheet,
  FlaskConical,
  PackagePlus,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react-native';
import { Colors } from '../../src/theme/colors';
import {
  StockItem,
  clearAllItems,
  createItem,
  deleteItem,
  getAllItems,
  getItemByCode,
  getTotalItems,
} from '../../src/db/itemsDB';
import {
  BlendMachine,
  MachineTipo,
  MaterialTipo,
  clearBlendMaterials,
  createBlendMachine,
  ensureBlendSchema,
  getBlendMachines,
  getBlendMaterialCount,
  searchBlendMaterials,
  upsertBlendMaterial,
} from '../../src/db/blendDB';
import { importBlendBaseXLSX } from '../../src/services/blendXlsxService';

const MACHINE_TYPES: MachineTipo[] = ['Injetora', 'Sopradora', 'Extrusora', 'Outro'];
const MATERIAL_TYPES: MaterialTipo[] = ['BLEND', 'DOSADOR'];

function parseNumber(value: string): number {
  const normalized = value.trim().replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function CadastrosScreen() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [itemSearch, setItemSearch] = useState('');
  const [itemCount, setItemCount] = useState(0);
  const [blendCount, setBlendCount] = useState(0);
  const [blendOnlyCount, setBlendOnlyCount] = useState(0);
  const [dosadorCount, setDosadorCount] = useState(0);
  const [machines, setMachines] = useState<BlendMachine[]>([]);

  const [codigo, setCodigo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('');
  const [unidade, setUnidade] = useState('UN');
  const [localizacao, setLocalizacao] = useState('');
  const [saldoSistema, setSaldoSistema] = useState('0');
  const [estoqueMinimo, setEstoqueMinimo] = useState('0');
  const [custoAjuste, setCustoAjuste] = useState('0');

  const [materialCodigo, setMaterialCodigo] = useState('');
  const [materialDescricao, setMaterialDescricao] = useState('');
  const [materialTipo, setMaterialTipo] = useState<MaterialTipo>('BLEND');

  const [machineCode, setMachineCode] = useState('');
  const [machineLabel, setMachineLabel] = useState('');
  const [machineType, setMachineType] = useState<MachineTipo>('Injetora');

  const refresh = useCallback(() => {
    ensureBlendSchema();
    setItemCount(getTotalItems());
    setItems(getAllItems(itemSearch || undefined).slice(0, 50));
    setBlendCount(getBlendMaterialCount());
    setBlendOnlyCount(searchBlendMaterials('', 'BLEND', 5000).length);
    setDosadorCount(searchBlendMaterials('', 'DOSADOR', 5000).length);
    setMachines(getBlendMachines());
  }, [itemSearch]);

  useFocusEffect(useCallback(() => {
    refresh();
  }, [refresh]));

  const machineGroups = useMemo(() => ({
    injetoras: machines.filter((machine) => machine.tipo === 'Injetora'),
    outras: machines.filter((machine) => machine.tipo !== 'Injetora'),
  }), [machines]);

  const clearItemForm = () => {
    setCodigo('');
    setDescricao('');
    setCategoria('');
    setUnidade('UN');
    setLocalizacao('');
    setSaldoSistema('0');
    setEstoqueMinimo('0');
    setCustoAjuste('0');
  };

  const handleCreateItem = () => {
    const normalizedCode = codigo.trim();
    const normalizedDescription = descricao.trim();
    if (!normalizedCode || !normalizedDescription) {
      Alert.alert('Campos obrigatórios', 'Informe o código e a descrição do item.');
      return;
    }
    if (getItemByCode(normalizedCode)) {
      Alert.alert('Item já cadastrado', `Já existe um item ativo com o código ${normalizedCode}.`);
      return;
    }

    try {
      createItem({
        codigo: normalizedCode,
        descricao: normalizedDescription,
        categoria: categoria.trim(),
        unidade: unidade.trim() || 'UN',
        localizacao: localizacao.trim(),
        saldo_sistema: parseNumber(saldoSistema),
        estoque_minimo: parseNumber(estoqueMinimo),
        custo_ajuste: parseNumber(custoAjuste),
      });
      clearItemForm();
      refresh();
      Alert.alert('Item cadastrado', `O item ${normalizedCode} foi adicionado ao estoque.`);
    } catch (error) {
      Alert.alert('Cadastro de item', error instanceof Error ? error.message : 'Não foi possível cadastrar o item.');
    }
  };

  const handleDeleteItem = (item: StockItem) => {
    Alert.alert(
      'Remover item?',
      `${item.codigo} — ${item.descricao}\n\nO histórico de contagens será preservado.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () => {
            deleteItem(item.id);
            refresh();
          },
        },
      ]
    );
  };

  const handleClearItems = () => {
    Alert.alert(
      'Zerar cadastro de itens?',
      'Todos os itens ativos serão removidos. Sessões e histórico de contagens serão preservados.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Zerar itens',
          style: 'destructive',
          onPress: () => {
            const total = clearAllItems();
            refresh();
            Alert.alert('Cadastro zerado', `${total} item(ns) removido(s).`);
          },
        },
      ]
    );
  };

  const handleImportBlendBase = async () => {
    try {
      const result = await importBlendBaseXLSX();
      if (!result) return;
      refresh();
      Alert.alert(
        'Base importada',
        `${result.createdOrUpdated} código(s) processado(s).\n${result.ignored} linha(s) ignorada(s).`
      );
    } catch (error) {
      Alert.alert('Importação', error instanceof Error ? error.message : 'Não foi possível importar a base.');
    }
  };

  const handleCreateMaterial = () => {
    const code = materialCodigo.trim();
    if (!code) {
      Alert.alert('Código obrigatório', 'Informe o código do Blend ou material de Dosador.');
      return;
    }
    try {
      upsertBlendMaterial(code, materialDescricao.trim(), materialTipo);
      setMaterialCodigo('');
      setMaterialDescricao('');
      refresh();
      Alert.alert('Material cadastrado', `${code.toUpperCase()} adicionado como ${materialTipo}.`);
    } catch (error) {
      Alert.alert('Cadastro', error instanceof Error ? error.message : 'Não foi possível cadastrar o material.');
    }
  };

  const handleClearBlendBase = () => {
    Alert.alert(
      'Zerar base de Blend/Dosador?',
      'Os códigos cadastrados serão removidos. As contagens já realizadas serão mantidas.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Zerar base',
          style: 'destructive',
          onPress: () => {
            clearBlendMaterials();
            refresh();
          },
        },
      ]
    );
  };

  const handleCreateMachine = () => {
    try {
      const machine = createBlendMachine(machineCode, machineLabel, machineType);
      setMachineCode('');
      setMachineLabel('');
      setMachineType('Injetora');
      refresh();
      Alert.alert('Máquina cadastrada', `${machine.label} adicionada com sucesso.`);
    } catch (error) {
      Alert.alert('Cadastro de máquina', error instanceof Error ? error.message : 'Não foi possível cadastrar a máquina.');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Boxes size={24} color={Colors.brand.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Cadastros</Text>
            <Text style={styles.subtitle}>Base mestre de itens, blends/dosadores e máquinas.</Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={refresh}>
            <RefreshCw size={18} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{itemCount}</Text>
            <Text style={styles.metricLabel}>Itens</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{blendCount}</Text>
            <Text style={styles.metricLabel}>Blend/Dosador</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{machines.length}</Text>
            <Text style={styles.metricLabel}>Máquinas</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <PackagePlus size={19} color={Colors.brand.primary} />
              <Text style={styles.sectionTitle}>Itens de estoque</Text>
            </View>
            <Text style={styles.sectionCount}>{itemCount} ativos</Text>
          </View>
          <Text style={styles.sectionDescription}>Cadastro mestre utilizado no estoque, scanner, programação e inventário cíclico.</Text>

          <View style={styles.twoColumns}>
            <TextInput value={codigo} onChangeText={setCodigo} placeholder="Código *" placeholderTextColor={Colors.text.muted} style={[styles.input, styles.flexInput]} autoCapitalize="characters" />
            <TextInput value={unidade} onChangeText={setUnidade} placeholder="Unidade" placeholderTextColor={Colors.text.muted} style={[styles.input, styles.smallInput]} autoCapitalize="characters" />
          </View>
          <TextInput value={descricao} onChangeText={setDescricao} placeholder="Descrição *" placeholderTextColor={Colors.text.muted} style={styles.input} />
          <View style={styles.twoColumns}>
            <TextInput value={categoria} onChangeText={setCategoria} placeholder="Categoria" placeholderTextColor={Colors.text.muted} style={[styles.input, styles.flexInput]} />
            <TextInput value={localizacao} onChangeText={setLocalizacao} placeholder="Localização" placeholderTextColor={Colors.text.muted} style={[styles.input, styles.flexInput]} />
          </View>
          <View style={styles.threeColumns}>
            <TextInput value={saldoSistema} onChangeText={setSaldoSistema} placeholder="Saldo" placeholderTextColor={Colors.text.muted} style={[styles.input, styles.thirdInput]} keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'} />
            <TextInput value={estoqueMinimo} onChangeText={setEstoqueMinimo} placeholder="Est. mínimo" placeholderTextColor={Colors.text.muted} style={[styles.input, styles.thirdInput]} keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'} />
            <TextInput value={custoAjuste} onChangeText={setCustoAjuste} placeholder="Custo ajuste" placeholderTextColor={Colors.text.muted} style={[styles.input, styles.thirdInput]} keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'} />
          </View>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleCreateItem}>
            <Plus size={17} color="#fff" />
            <Text style={styles.primaryBtnText}>Cadastrar item</Text>
          </TouchableOpacity>

          <View style={styles.divider} />
          <View style={styles.searchWrap}>
            <Search size={16} color={Colors.text.muted} />
            <TextInput value={itemSearch} onChangeText={setItemSearch} onSubmitEditing={refresh} placeholder="Pesquisar item cadastrado" placeholderTextColor={Colors.text.muted} style={styles.searchInput} />
          </View>
          <Text style={styles.previewHint}>Mostrando até 50 registros.</Text>
          {items.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum item encontrado.</Text>
          ) : items.map((item) => (
            <View key={item.id} style={styles.listRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.listCode}>{item.codigo}</Text>
                <Text style={styles.listDescription} numberOfLines={1}>{item.descricao}</Text>
                <Text style={styles.listMeta}>{item.unidade || 'UN'}{item.localizacao ? ` · ${item.localizacao}` : ''}{item.categoria ? ` · ${item.categoria}` : ''}</Text>
              </View>
              <TouchableOpacity style={styles.rowDangerBtn} onPress={() => handleDeleteItem(item)}>
                <Trash2 size={16} color={Colors.status.danger} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.dangerBtn} onPress={handleClearItems}>
            <Trash2 size={16} color={Colors.status.danger} />
            <Text style={styles.dangerBtnText}>Zerar cadastro de itens</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <FlaskConical size={19} color={Colors.brand.accent} />
              <Text style={styles.sectionTitle}>Blends / Dosadores</Text>
            </View>
            <Text style={styles.sectionCount}>{blendCount} códigos</Text>
          </View>
          <Text style={styles.sectionDescription}>Base usada no autocomplete durante a contagem de materiais por máquina.</Text>

          <View style={styles.typeRow}>
            {MATERIAL_TYPES.map((type) => (
              <TouchableOpacity key={type} style={[styles.typeBtn, materialTipo === type && styles.typeBtnActive]} onPress={() => setMaterialTipo(type)}>
                <Text style={[styles.typeBtnText, materialTipo === type && styles.typeBtnTextActive]}>{type === 'BLEND' ? 'Blend' : 'Dosador'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput value={materialCodigo} onChangeText={setMaterialCodigo} placeholder="Código do material *" placeholderTextColor={Colors.text.muted} style={styles.input} autoCapitalize="characters" />
          <TextInput value={materialDescricao} onChangeText={setMaterialDescricao} placeholder="Descrição" placeholderTextColor={Colors.text.muted} style={styles.input} />
          <TouchableOpacity style={styles.primaryBtn} onPress={handleCreateMaterial}>
            <Plus size={17} color="#fff" />
            <Text style={styles.primaryBtnText}>Cadastrar código</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleImportBlendBase}>
            <FileSpreadsheet size={17} color={Colors.text.primary} />
            <Text style={styles.secondaryBtnText}>Importar base XLSX</Text>
          </TouchableOpacity>

          <View style={styles.inlineStats}>
            <Text style={styles.inlineStat}>Blends: <Text style={styles.inlineStatValue}>{blendOnlyCount}</Text></Text>
            <Text style={styles.inlineStat}>Dosadores: <Text style={styles.inlineStatValue}>{dosadorCount}</Text></Text>
          </View>
          <TouchableOpacity style={styles.dangerBtn} onPress={handleClearBlendBase}>
            <Trash2 size={16} color={Colors.status.danger} />
            <Text style={styles.dangerBtnText}>Zerar base Blend/Dosador</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Factory size={19} color={Colors.brand.success} />
              <Text style={styles.sectionTitle}>Máquinas / Injetoras</Text>
            </View>
            <Text style={styles.sectionCount}>{machines.length} máquinas</Text>
          </View>
          <Text style={styles.sectionDescription}>As Injetoras 01–52 e máquinas 92–99 continuam cadastradas por padrão. Novas máquinas podem ser adicionadas aqui.</Text>

          <View style={styles.twoColumns}>
            <TextInput value={machineCode} onChangeText={setMachineCode} placeholder="Código *" placeholderTextColor={Colors.text.muted} style={[styles.input, styles.smallInput]} autoCapitalize="characters" />
            <TextInput value={machineLabel} onChangeText={setMachineLabel} placeholder="Nome da máquina *" placeholderTextColor={Colors.text.muted} style={[styles.input, styles.flexInput]} />
          </View>
          <View style={styles.typeWrap}>
            {MACHINE_TYPES.map((type) => (
              <TouchableOpacity key={type} style={[styles.machineTypeBtn, machineType === type && styles.machineTypeBtnActive]} onPress={() => setMachineType(type)}>
                <Text style={[styles.machineTypeText, machineType === type && styles.machineTypeTextActive]}>{type}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleCreateMachine}>
            <Plus size={17} color="#fff" />
            <Text style={styles.primaryBtnText}>Cadastrar máquina</Text>
          </TouchableOpacity>

          <View style={styles.divider} />
          <Text style={styles.groupTitle}>Injetoras ({machineGroups.injetoras.length})</Text>
          <View style={styles.machineGrid}>
            {machineGroups.injetoras.map((machine) => (
              <View key={machine.id} style={styles.machineChip}>
                <Text style={styles.machineChipCode}>{machine.codigo}</Text>
                <Text style={styles.machineChipLabel} numberOfLines={1}>{machine.label}</Text>
              </View>
            ))}
          </View>

          {machineGroups.outras.length > 0 && (
            <>
              <Text style={styles.groupTitle}>Outras máquinas ({machineGroups.outras.length})</Text>
              {machineGroups.outras.map((machine) => (
                <View key={machine.id} style={styles.listRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listCode}>{machine.codigo} · {machine.label}</Text>
                    <Text style={styles.listMeta}>{machine.tipo}</Text>
                  </View>
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg.primary },
  content: { padding: 16, paddingBottom: 42, gap: 14 },
  heroCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: Colors.bg.secondary, borderWidth: 1, borderColor: Colors.border.subtle },
  heroIcon: { width: 46, height: 46, borderRadius: 12, backgroundColor: Colors.brand.primary + '18', alignItems: 'center', justifyContent: 'center' },
  title: { color: Colors.text.primary, fontSize: 22, fontWeight: '800' },
  subtitle: { color: Colors.text.secondary, fontSize: 12, marginTop: 3 },
  refreshBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.bg.tertiary, alignItems: 'center', justifyContent: 'center' },
  metricsRow: { flexDirection: 'row', gap: 8 },
  metricCard: { flex: 1, minHeight: 70, borderRadius: 12, padding: 11, backgroundColor: Colors.bg.secondary, borderWidth: 1, borderColor: Colors.border.subtle, justifyContent: 'center' },
  metricValue: { color: Colors.text.primary, fontSize: 20, fontWeight: '800' },
  metricLabel: { color: Colors.text.muted, fontSize: 10, marginTop: 2 },
  sectionCard: { borderRadius: 14, padding: 14, gap: 10, backgroundColor: Colors.bg.secondary, borderWidth: 1, borderColor: Colors.border.subtle },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  sectionTitle: { color: Colors.text.primary, fontSize: 16, fontWeight: '800' },
  sectionCount: { color: Colors.brand.primary, fontSize: 11, fontWeight: '700' },
  sectionDescription: { color: Colors.text.muted, fontSize: 11, lineHeight: 16 },
  input: { height: 43, borderRadius: 9, borderWidth: 1, borderColor: Colors.border.strong, backgroundColor: Colors.bg.primary, color: Colors.text.primary, paddingHorizontal: 11, fontSize: 13 },
  twoColumns: { flexDirection: 'row', gap: 8 },
  threeColumns: { flexDirection: 'row', gap: 7 },
  flexInput: { flex: 1 },
  smallInput: { width: 110 },
  thirdInput: { flex: 1, minWidth: 0 },
  primaryBtn: { minHeight: 44, borderRadius: 10, backgroundColor: Colors.brand.primary, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  primaryBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  secondaryBtn: { minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: Colors.border.strong, backgroundColor: Colors.bg.tertiary, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  secondaryBtnText: { color: Colors.text.primary, fontSize: 13, fontWeight: '700' },
  dangerBtn: { minHeight: 42, borderRadius: 10, borderWidth: 1, borderColor: Colors.status.danger + '55', backgroundColor: Colors.status.danger + '10', flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  dangerBtnText: { color: Colors.status.danger, fontSize: 12, fontWeight: '700' },
  divider: { height: 1, backgroundColor: Colors.border.subtle, marginVertical: 2 },
  searchWrap: { height: 42, borderRadius: 10, borderWidth: 1, borderColor: Colors.border.subtle, backgroundColor: Colors.bg.primary, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, gap: 8 },
  searchInput: { flex: 1, color: Colors.text.primary, fontSize: 13, paddingVertical: 0 },
  previewHint: { color: Colors.text.muted, fontSize: 10 },
  emptyText: { color: Colors.text.muted, fontSize: 12, paddingVertical: 6 },
  listRow: { minHeight: 58, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border.subtle, backgroundColor: Colors.bg.primary, flexDirection: 'row', alignItems: 'center', gap: 8 },
  listCode: { color: Colors.text.primary, fontSize: 12, fontWeight: '800' },
  listDescription: { color: Colors.text.secondary, fontSize: 11, marginTop: 2 },
  listMeta: { color: Colors.text.muted, fontSize: 10, marginTop: 2 },
  rowDangerBtn: { width: 36, height: 36, borderRadius: 9, borderWidth: 1, borderColor: Colors.status.danger + '44', backgroundColor: Colors.status.danger + '0F', alignItems: 'center', justifyContent: 'center' },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: { flex: 1, minHeight: 40, borderRadius: 9, borderWidth: 1, borderColor: Colors.border.subtle, backgroundColor: Colors.bg.primary, alignItems: 'center', justifyContent: 'center' },
  typeBtnActive: { borderColor: Colors.brand.primary, backgroundColor: Colors.brand.primary + '18' },
  typeBtnText: { color: Colors.text.secondary, fontSize: 12, fontWeight: '700' },
  typeBtnTextActive: { color: Colors.brand.primary },
  inlineStats: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  inlineStat: { color: Colors.text.secondary, fontSize: 11 },
  inlineStatValue: { color: Colors.text.primary, fontWeight: '800' },
  typeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  machineTypeBtn: { minHeight: 36, borderRadius: 9, borderWidth: 1, borderColor: Colors.border.subtle, backgroundColor: Colors.bg.primary, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' },
  machineTypeBtnActive: { borderColor: Colors.brand.success, backgroundColor: Colors.brand.success + '16' },
  machineTypeText: { color: Colors.text.secondary, fontSize: 11, fontWeight: '700' },
  machineTypeTextActive: { color: Colors.brand.success },
  groupTitle: { color: Colors.text.secondary, fontSize: 12, fontWeight: '800', marginTop: 2 },
  machineGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  machineChip: { minWidth: 74, maxWidth: 112, minHeight: 48, borderRadius: 9, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: Colors.bg.primary, borderWidth: 1, borderColor: Colors.border.subtle },
  machineChipCode: { color: Colors.brand.success, fontSize: 12, fontWeight: '800' },
  machineChipLabel: { color: Colors.text.muted, fontSize: 9, marginTop: 2 },
});
