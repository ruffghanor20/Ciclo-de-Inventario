import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, ScrollView, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import { SearchBar } from '../../src/components/SearchBar';
import { ItemRow } from '../../src/components/ItemRow';
import { EmptyState } from '../../src/components/EmptyState';
import { createItem, getAllItems, StockItem } from '../../src/db/itemsDB';
import { getCountsBySession, CountEntry } from '../../src/db/countsDB';
import { ensureOpenSession } from '../../src/db/sessionsDB';
import { formatDateBr, normalizeCurvaABC } from '../../src/utils/countSchedule';

type FilterType = 'todos' | 'divergencia' | 'nao_contado' | 'ok';

const FILTERS: { id: FilterType; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'divergencia', label: 'Divergência' },
  { id: 'nao_contado', label: 'Não contados' },
  { id: 'ok', label: 'OK' },
];

function normalizeSearchText(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export default function InventoryScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('todos');
  const [showAddForm, setShowAddForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<StockItem[]>([]);
  const [counts, setCounts] = useState<CountEntry[]>([]);
  const [novoCodigo, setNovoCodigo] = useState('');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novaCategoria, setNovaCategoria] = useState('');
  const [novaUnidade, setNovaUnidade] = useState('UN');
  const [novaLocalizacao, setNovaLocalizacao] = useState('');
  const [novoSaldoSistema, setNovoSaldoSistema] = useState('0');
  const [novoEstoqueMinimo, setNovoEstoqueMinimo] = useState('0');
  const [novoCustoAjuste, setNovoCustoAjuste] = useState('0');

  const loadData = useCallback(() => {
    try {
      const session = ensureOpenSession();
      setItems(getAllItems());
      setCounts(getCountsBySession(session.id));
    } catch (e) {
      console.error(e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
    setRefreshing(false);
  }, [loadData]);

  const countMap = useMemo(() => {
    const map = new Map<string, CountEntry>();
    for (const c of counts) {
      map.set(c.codigo, c);
    }
    return map;
  }, [counts]);

  const filtered = useMemo(() => {
    let result = items;
    if (search.trim()) {
      const q = normalizeSearchText(search);
      result = result.filter(
        (i) =>
          normalizeSearchText(i.codigo).includes(q) ||
          normalizeSearchText(i.descricao).includes(q)
      );
    }
    switch (filter) {
      case 'divergencia':
        result = result.filter((i) => {
          const c = countMap.get(i.codigo);
          return c !== undefined && c.diferenca !== 0;
        });
        break;
      case 'nao_contado':
        result = result.filter((i) => !i.data_contado);
        break;
      case 'ok':
        result = result.filter((i) => {
          const c = countMap.get(i.codigo);
          return c !== undefined && c.diferenca === 0;
        });
        break;
    }
    return result;
  }, [items, search, filter, countMap]);

  const parseNumber = (value: string): number => {
    const normalized = value.trim().replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const clearAddForm = () => {
    setNovoCodigo('');
    setNovaDescricao('');
    setNovaCategoria('');
    setNovaUnidade('UN');
    setNovaLocalizacao('');
    setNovoSaldoSistema('0');
    setNovoEstoqueMinimo('0');
    setNovoCustoAjuste('0');
  };

  const handleCreateItem = () => {
    const codigo = novoCodigo.trim();
    const descricao = novaDescricao.trim();
    if (!codigo || !descricao) {
      Alert.alert('Campos obrigatórios', 'Informe código e descrição do item.');
      return;
    }

    try {
      createItem({
        codigo,
        descricao,
        categoria: novaCategoria.trim(),
        unidade: novaUnidade.trim() || 'UN',
        localizacao: novaLocalizacao.trim(),
        saldo_sistema: parseNumber(novoSaldoSistema),
        estoque_minimo: parseNumber(novoEstoqueMinimo),
        custo_ajuste: parseNumber(novoCustoAjuste),
      });
      clearAddForm();
      setShowAddForm(false);
      loadData();
      Alert.alert('Item adicionado', `Item ${codigo} cadastrado com sucesso.`);
    } catch (e: any) {
      Alert.alert('Erro ao cadastrar', e?.message ?? 'Não foi possível adicionar o item.');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Estoque</Text>
          <Text style={styles.subtitle}>{filtered.length} itens</Text>
        </View>
        <TouchableOpacity
          testID="add-item-toggle-btn"
          style={styles.addBtn}
          onPress={() => setShowAddForm((v) => !v)}
        >
          <Text style={styles.addBtnText}>{showAddForm ? 'Fechar' : '+ Item'}</Text>
        </TouchableOpacity>
      </View>

      {showAddForm ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={90}
        >
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Adicionar item manualmente</Text>
            <View style={styles.formRow}>
              <TextInput
                testID="new-item-codigo-input"
                style={[styles.input, styles.inputHalf]}
                value={novoCodigo}
                onChangeText={setNovoCodigo}
                placeholder="Código *"
                placeholderTextColor={Colors.text.muted}
              />
              <TextInput
                testID="new-item-unidade-input"
                style={[styles.input, styles.inputHalf]}
                value={novaUnidade}
                onChangeText={setNovaUnidade}
                placeholder="Unidade (UN)"
                placeholderTextColor={Colors.text.muted}
              />
            </View>
            <TextInput
              testID="new-item-descricao-input"
              style={styles.input}
              value={novaDescricao}
              onChangeText={setNovaDescricao}
              placeholder="Descrição *"
              placeholderTextColor={Colors.text.muted}
            />
            <View style={styles.formRow}>
              <TextInput
                testID="new-item-categoria-input"
                style={[styles.input, styles.inputHalf]}
                value={novaCategoria}
                onChangeText={setNovaCategoria}
                placeholder="Categoria"
                placeholderTextColor={Colors.text.muted}
              />
              <TextInput
                testID="new-item-localizacao-input"
                style={[styles.input, styles.inputHalf]}
                value={novaLocalizacao}
                onChangeText={setNovaLocalizacao}
                placeholder="Localização"
                placeholderTextColor={Colors.text.muted}
              />
            </View>
            <View style={styles.formRow}>
              <TextInput
                testID="new-item-saldo-input"
                style={[styles.input, styles.inputThird]}
                value={novoSaldoSistema}
                onChangeText={setNovoSaldoSistema}
                placeholder="Saldo sist."
                placeholderTextColor={Colors.text.muted}
                keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
              />
              <TextInput
                testID="new-item-minimo-input"
                style={[styles.input, styles.inputThird]}
                value={novoEstoqueMinimo}
                onChangeText={setNovoEstoqueMinimo}
                placeholder="Estoque mín."
                placeholderTextColor={Colors.text.muted}
                keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
              />
              <TextInput
                testID="new-item-custo-ajuste-input"
                style={[styles.input, styles.inputThird]}
                value={novoCustoAjuste}
                onChangeText={setNovoCustoAjuste}
                placeholder="Custo ajuste"
                placeholderTextColor={Colors.text.muted}
                keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
              />
            </View>
            <TouchableOpacity
              testID="create-item-btn"
              style={styles.saveNewBtn}
              onPress={handleCreateItem}
            >
              <Text style={styles.saveNewBtnText}>Salvar item</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      ) : null}

      <View style={styles.searchWrap}>
        <SearchBar
          testID="inventory-search"
          value={search}
          onChangeText={setSearch}
          placeholder="Digite código ou nome do item"
        />
      </View>

      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              testID={`filter-${f.id}`}
              key={f.id}
              style={[styles.filterChip, filter === f.id && styles.filterChipActive]}
              onPress={() => setFilter(f.id)}
            >
              <Text style={[styles.filterLabel, filter === f.id && styles.filterLabelActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const count = countMap.get(item.codigo);
          return (
            <ItemRow
              testID={`item-row-${item.codigo}`}
              codigo={item.codigo}
              descricao={item.descricao}
              categoria={item.categoria}
              localizacao={item.localizacao}
              saldo={item.saldo_sistema}
              contado={count?.quantidade_contada ?? null}
              diferenca={count?.diferenca ?? null}
              dataContado={formatDateBr(item.data_contado)}
              curvaAbc={normalizeCurvaABC(item.curva_abc)}
              proximaContagem={formatDateBr(item.proxima_contagem)}
              onPress={() =>
                router.push({
                  pathname: '/count',
                  params: { codigo: item.codigo },
                })
              }
            />
          );
        }}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brand.primary} />
        }
        ListEmptyComponent={
          <EmptyState
            title={search ? 'Nenhum resultado' : 'Nenhum item no estoque'}
            message={search ? `Nada encontrado para "${search}"` : 'Importe uma planilha ou adicione itens manualmente.'}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg.primary },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text.primary },
  subtitle: { fontSize: 12, color: Colors.text.muted },
  addBtn: {
    borderRadius: 10,
    backgroundColor: Colors.brand.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  formCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: Colors.bg.secondary,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    padding: 12,
    gap: 8,
  },
  formTitle: { fontSize: 14, fontWeight: '700', color: Colors.text.primary, marginBottom: 2 },
  formRow: { flexDirection: 'row', gap: 8 },
  input: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border.strong,
    backgroundColor: Colors.bg.primary,
    color: Colors.text.primary,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  inputHalf: { flex: 1 },
  inputThird: { flex: 1 },
  saveNewBtn: {
    marginTop: 4,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brand.success,
  },
  saveNewBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  searchWrap: { paddingHorizontal: 16, marginBottom: 10 },
  filterRow: { marginBottom: 8 },
  filterContent: { paddingHorizontal: 16, gap: 8 },
  filterChip: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: Colors.bg.secondary,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  filterChipActive: {
    backgroundColor: Colors.brand.primary + '22',
    borderColor: Colors.brand.primary,
  },
  filterLabel: { fontSize: 13, fontWeight: '500', color: Colors.text.secondary },
  filterLabelActive: { color: Colors.brand.primary, fontWeight: '700' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
});
