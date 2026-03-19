import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { CalendarClock, ClockAlert } from 'lucide-react-native';
import { Colors } from '../../src/theme/colors';
import { EmptyState } from '../../src/components/EmptyState';
import { getScheduledItems, StockItem } from '../../src/db/itemsDB';
import { formatDateBr, todayIsoDate } from '../../src/utils/countSchedule';

type ScheduleStatus = 'atrasado' | 'hoje' | 'proximo';
type ScheduleFilter = 'pendentes' | 'todos';

function getStatus(dateIso: string): ScheduleStatus {
  const today = todayIsoDate();
  if (dateIso < today) return 'atrasado';
  if (dateIso === today) return 'hoje';
  return 'proximo';
}

function getStatusColor(status: ScheduleStatus): string {
  if (status === 'atrasado') return Colors.brand.error;
  if (status === 'hoje') return Colors.brand.warning;
  return Colors.brand.success;
}

function getStatusLabel(status: ScheduleStatus): string {
  if (status === 'atrasado') return 'Atrasado';
  if (status === 'hoje') return 'Hoje';
  return 'Programado';
}

export default function ScheduleScreen() {
  const router = useRouter();
  const [items, setItems] = useState<StockItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<ScheduleFilter>('pendentes');

  const loadData = useCallback(() => {
    setItems(getScheduledItems());
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

  const stats = useMemo(() => {
    let atrasado = 0;
    let hoje = 0;
    let proximo = 0;
    for (const item of items) {
      if (!item.proxima_contagem) continue;
      const status = getStatus(item.proxima_contagem);
      if (status === 'atrasado') atrasado += 1;
      else if (status === 'hoje') hoje += 1;
      else proximo += 1;
    }
    return { atrasado, hoje, proximo };
  }, [items]);

  const visibleItems = useMemo(() => {
    if (filter === 'todos') return items;
    return items.filter((item) => {
      if (!item.proxima_contagem) return false;
      const status = getStatus(item.proxima_contagem);
      return status === 'atrasado' || status === 'hoje';
    });
  }, [items, filter]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Programação de Contagem</Text>
        <Text style={styles.subtitle}>{items.length} itens com data programada</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statBox, { borderColor: Colors.brand.error + '40' }]}>
          <Text style={[styles.statValue, { color: Colors.brand.error }]}>{stats.atrasado}</Text>
          <Text style={styles.statLabel}>Atrasados</Text>
        </View>
        <View style={[styles.statBox, { borderColor: Colors.brand.warning + '40' }]}>
          <Text style={[styles.statValue, { color: Colors.brand.warning }]}>{stats.hoje}</Text>
          <Text style={styles.statLabel}>Hoje</Text>
        </View>
        <View style={[styles.statBox, { borderColor: Colors.brand.success + '40' }]}>
          <Text style={[styles.statValue, { color: Colors.brand.success }]}>{stats.proximo}</Text>
          <Text style={styles.statLabel}>Próximos</Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'pendentes' && styles.filterChipActive]}
          onPress={() => setFilter('pendentes')}
        >
          <Text style={[styles.filterChipText, filter === 'pendentes' && styles.filterChipTextActive]}>
            Pendentes
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'todos' && styles.filterChipActive]}
          onPress={() => setFilter('todos')}
        >
          <Text style={[styles.filterChipText, filter === 'todos' && styles.filterChipTextActive]}>
            Todos
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={visibleItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brand.primary} />
        }
        renderItem={({ item }) => {
          const status = item.proxima_contagem ? getStatus(item.proxima_contagem) : 'proximo';
          const color = getStatusColor(status);
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: '/count',
                  params: { codigo: item.codigo },
                })
              }
              activeOpacity={0.75}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.code}>{item.codigo}</Text>
                <View style={[styles.badge, { borderColor: color + '55', backgroundColor: color + '22' }]}>
                  <Text style={[styles.badgeText, { color }]}>{getStatusLabel(status)}</Text>
                </View>
              </View>
              <Text style={styles.description} numberOfLines={1}>{item.descricao}</Text>
              <View style={styles.infoRow}>
                <CalendarClock size={15} color={Colors.text.muted} />
                <Text style={styles.infoText}>
                  Última: <Text style={styles.infoValue}>{formatDateBr(item.data_contado)}</Text>
                </Text>
                <Text style={styles.infoText}>
                  Próxima: <Text style={styles.infoValue}>{formatDateBr(item.proxima_contagem)}</Text>
                </Text>
              </View>
              <Text style={styles.curvaText}>Curva-ABC: {item.curva_abc}</Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            title="Sem programação de contagem"
            message="Importe a planilha com as colunas de contado e Curva-ABC para montar a programação."
            icon={<ClockAlert size={42} color={Colors.text.muted} />}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg.primary },
  header: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 },
  title: { color: Colors.text.primary, fontSize: 21, fontWeight: '800' },
  subtitle: { color: Colors.text.muted, fontSize: 12, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 10 },
  statBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: Colors.bg.secondary,
    paddingVertical: 10,
    alignItems: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { color: Colors.text.muted, fontSize: 11, marginTop: 2 },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 10 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: Colors.bg.secondary,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  filterChipActive: {
    backgroundColor: Colors.brand.primary + '22',
    borderColor: Colors.brand.primary + '55',
  },
  filterChipText: { color: Colors.text.secondary, fontSize: 12, fontWeight: '700' },
  filterChipTextActive: { color: Colors.brand.primary },
  listContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 8 },
  card: {
    backgroundColor: Colors.bg.secondary,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { fontSize: 12, color: Colors.text.muted, fontFamily: 'monospace' },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  description: { color: Colors.text.primary, fontSize: 14, fontWeight: '700' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  infoText: { color: Colors.text.secondary, fontSize: 12 },
  infoValue: { color: Colors.text.primary, fontWeight: '700' },
  curvaText: { color: Colors.brand.primary, fontSize: 12, fontWeight: '700' },
});
