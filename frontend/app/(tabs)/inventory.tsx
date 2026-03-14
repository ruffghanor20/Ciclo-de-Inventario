import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import { SearchBar } from '../../src/components/SearchBar';
import { ItemRow } from '../../src/components/ItemRow';
import { EmptyState } from '../../src/components/EmptyState';
import { getAllItems, StockItem } from '../../src/db/itemsDB';
import { getCountsBySession, CountEntry } from '../../src/db/countsDB';
import { ensureOpenSession } from '../../src/db/sessionsDB';

type FilterType = 'todos' | 'divergencia' | 'nao_contado' | 'ok';

const FILTERS: { id: FilterType; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'divergencia', label: 'Divergência' },
  { id: 'nao_contado', label: 'Não contados' },
  { id: 'ok', label: 'OK' },
];

export default function InventoryScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('todos');
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
      const q = search.trim().toUpperCase();
      result = result.filter(
        (i) => i.codigo.toUpperCase().includes(q) || i.descricao.toUpperCase().includes(q)
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
        result = result.filter((i) => !countMap.has(i.codigo));
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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Estoque</Text>
        <Text style={styles.subtitle}>{filtered.length} itens</Text>
      </View>

      <View style={styles.searchWrap}>
        <SearchBar testID="inventory-search" value={search} onChangeText={setSearch} />
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text.primary },
  subtitle: { fontSize: 12, color: Colors.text.muted },
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
