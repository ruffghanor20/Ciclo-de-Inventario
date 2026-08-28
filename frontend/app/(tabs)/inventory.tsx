import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, ScrollView, Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Filter, X } from 'lucide-react-native';
import { Colors } from '../../src/theme/colors';
import { SearchBar } from '../../src/components/SearchBar';
import { ItemRow } from '../../src/components/ItemRow';
import { EmptyState } from '../../src/components/EmptyState';
import { getAllItems, StockItem } from '../../src/db/itemsDB';
import { getCountsBySession, CountEntry } from '../../src/db/countsDB';
import { ensureOpenSession } from '../../src/db/sessionsDB';
import { formatDateBr, normalizeCurvaABC } from '../../src/utils/countSchedule';

type FilterType = 'todos' | 'divergencia' | 'nao_contado' | 'ok';
type CurvaFilter = 'todas' | 'A' | 'B' | 'C';

const CLASSIFICATION_FILTERS: { id: FilterType; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'divergencia', label: 'Divergencia' },
  { id: 'nao_contado', label: 'Nao contados' },
  { id: 'ok', label: 'OK' },
];

const CURVA_FILTERS: { id: CurvaFilter; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'A', label: 'A' },
  { id: 'B', label: 'B' },
  { id: 'C', label: 'C' },
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
  const [classificationFilter, setClassificationFilter] = useState<FilterType>('todos');
  const [curvaFilter, setCurvaFilter] = useState<CurvaFilter>('todas');
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<StockItem[]>([]);
  const [counts, setCounts] = useState<CountEntry[]>([]);

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

    if (curvaFilter !== 'todas') {
      result = result.filter((item) => normalizeCurvaABC(item.curva_abc) === curvaFilter);
    }

    switch (classificationFilter) {
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
  }, [items, search, curvaFilter, classificationFilter, countMap]);

  const activeFilterCount = useMemo(() => {
    let total = 0;
    if (curvaFilter !== 'todas') total += 1;
    if (classificationFilter !== 'todos') total += 1;
    return total;
  }, [curvaFilter, classificationFilter]);

  const resetFilters = () => {
    setCurvaFilter('todas');
    setClassificationFilter('todos');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Estoque</Text>
          <Text style={styles.subtitle}>{filtered.length} itens</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <SearchBar
          testID="inventory-search"
          value={search}
          onChangeText={setSearch}
          placeholder="Digite codigo ou nome do item"
        />
      </View>

      <View style={styles.filterBar}>
        <TouchableOpacity
          testID="filters-toggle-btn"
          style={[styles.filtersButton, activeFilterCount > 0 && styles.filtersButtonActive]}
          onPress={() => setShowFilters(true)}
        >
          <Filter size={16} color={activeFilterCount > 0 ? '#fff' : Colors.text.primary} />
          <Text style={[styles.filtersButtonText, activeFilterCount > 0 && styles.filtersButtonTextActive]}>
            Filtros
          </Text>
          {activeFilterCount > 0 ? (
            <View style={styles.filterCountBadge}>
              <Text style={styles.filterCountText}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </TouchableOpacity>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterSummaryContent}>
          {curvaFilter !== 'todas' ? (
            <View style={styles.summaryChip}>
              <Text style={styles.summaryChipText}>Curva: {curvaFilter}</Text>
            </View>
          ) : null}
          {classificationFilter !== 'todos' ? (
            <View style={styles.summaryChip}>
              <Text style={styles.summaryChipText}>
                Classificacao: {CLASSIFICATION_FILTERS.find((f) => f.id === classificationFilter)?.label}
              </Text>
            </View>
          ) : null}
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
            message={search ? `Nada encontrado para "${search}"` : 'Cadastre ou importe os itens pela aba Cadastros.'}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      <Modal
        visible={showFilters}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFilters(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowFilters(false)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtros</Text>
              <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowFilters(false)}>
                <X size={18} color={Colors.text.muted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSectionTitle}>Curva</Text>
            <View style={styles.modalChipWrap}>
              {CURVA_FILTERS.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.filterChip, curvaFilter === option.id && styles.filterChipActive]}
                  onPress={() => setCurvaFilter(option.id)}
                >
                  <Text style={[styles.filterLabel, curvaFilter === option.id && styles.filterLabelActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalSectionTitle}>Classificacao</Text>
            <View style={styles.modalChipWrap}>
              {CLASSIFICATION_FILTERS.map((option) => (
                <TouchableOpacity
                  testID={`filter-${option.id}`}
                  key={option.id}
                  style={[styles.filterChip, classificationFilter === option.id && styles.filterChipActive]}
                  onPress={() => setClassificationFilter(option.id)}
                >
                  <Text style={[styles.filterLabel, classificationFilter === option.id && styles.filterLabelActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.resetFiltersBtn} onPress={resetFilters}>
                <Text style={styles.resetFiltersText}>Limpar filtros</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyFiltersBtn} onPress={() => setShowFilters(false)}>
                <Text style={styles.applyFiltersText}>Aplicar</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg.primary },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text.primary },
  subtitle: { fontSize: 12, color: Colors.text.muted },
  searchWrap: { paddingHorizontal: 16, marginBottom: 10 },
  filterBar: { paddingHorizontal: 16, marginBottom: 8, gap: 10 },
  filtersButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    backgroundColor: Colors.bg.secondary,
  },
  filtersButtonActive: {
    backgroundColor: Colors.brand.primary,
    borderColor: Colors.brand.primary,
  },
  filtersButtonText: {
    color: Colors.text.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  filtersButtonTextActive: {
    color: '#fff',
  },
  filterCountBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterCountText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  filterSummaryContent: { gap: 8, paddingRight: 16 },
  summaryChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: Colors.bg.secondary,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  summaryChipText: {
    color: Colors.text.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.bg.secondary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    gap: 14,
    borderTopWidth: 1,
    borderColor: Colors.border.subtle,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    color: Colors.text.primary,
    fontSize: 18,
    fontWeight: '800',
  },
  closeModalBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg.tertiary,
  },
  modalSectionTitle: {
    color: Colors.text.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  modalChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
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
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  resetFiltersBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg.primary,
  },
  resetFiltersText: {
    color: Colors.text.secondary,
    fontSize: 13,
    fontWeight: '700',
  },
  applyFiltersBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brand.primary,
  },
  applyFiltersText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
});
