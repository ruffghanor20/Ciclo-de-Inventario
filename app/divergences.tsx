import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react-native';
import { Colors } from '../src/theme/colors';
import { EmptyState } from '../src/components/EmptyState';
import { getDivergences, CountEntry } from '../src/db/countsDB';
import { ensureOpenSession } from '../src/db/sessionsDB';

export default function DivergencesScreen() {
  const router = useRouter();
  const { sessionId: paramId } = useLocalSearchParams<{ sessionId?: string }>();
  const [entries, setEntries] = useState<CountEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [sessionId, setSessionId] = useState('');

  const loadData = useCallback(() => {
    const sid = paramId ?? ensureOpenSession().id;
    setSessionId(sid);
    setEntries(getDivergences(sid));
  }, [paramId]);

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

  const totalFalta = entries.filter((e) => e.diferenca < 0).reduce((s, e) => s + Math.abs(e.diferenca), 0);
  const totalDiferenca = entries.filter((e) => e.diferenca > 0).reduce((s, e) => s + e.diferenca, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Summary */}
      {entries.length > 0 && (
        <View style={styles.summary}>
          <View style={[styles.sumBox, { borderColor: Colors.brand.error + '40' }]}>
            <TrendingDown size={16} color={Colors.brand.error} />
            <Text style={[styles.sumVal, { color: Colors.brand.error }]}>{entries.filter((e) => e.diferenca < 0).length}</Text>
            <Text style={styles.sumLabel}>Faltas ({totalFalta} un.)</Text>
          </View>
          <View style={[styles.sumBox, { borderColor: Colors.brand.success + '40' }]}>
            <TrendingUp size={16} color={Colors.brand.success} />
            <Text style={[styles.sumVal, { color: Colors.brand.success }]}>{entries.filter((e) => e.diferenca > 0).length}</Text>
            <Text style={styles.sumLabel}>Diferenças (+{totalDiferenca} un.)</Text>
          </View>
        </View>
      )}

      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isFalta = item.diferenca < 0;
          const color = isFalta ? Colors.brand.error : Colors.brand.success;
          const Icon = isFalta ? TrendingDown : TrendingUp;
          return (
            <TouchableOpacity
              testID={`div-row-${item.codigo}`}
              style={styles.row}
              onPress={() =>
                router.push({ pathname: '/count', params: { codigo: item.codigo, sessionId } })
              }
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: color + '20' }]}>
                <Icon size={18} color={color} />
              </View>
              <View style={styles.rowInfo}>
                <Text style={styles.rowCodigo}>{item.codigo}</Text>
                <Text style={styles.rowDescricao} numberOfLines={1}>{item.descricao}</Text>
                <View style={styles.rowMeta}>
                  <Text style={styles.rowMetaText}>Sistema: {item.saldo_sistema}</Text>
                  <Text style={styles.rowMetaText}>Contado: {item.quantidade_contada}</Text>
                  {item.localizacao ? <Text style={styles.rowMetaText}>{item.localizacao}</Text> : null}
                </View>
                {item.observacao ? (
                  <Text style={styles.rowObs} numberOfLines={1}>"{item.observacao}"</Text>
                ) : null}
              </View>
              <View style={[styles.difBadge, { backgroundColor: color + '20', borderColor: color + '50' }]}>
                <Text style={[styles.difText, { color }]}>
                  {item.diferenca > 0 ? '+' : ''}{item.diferenca}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brand.primary} />
        }
        ListEmptyComponent={
          <EmptyState
            title="Sem divergências"
            message="Todos os itens contados estão de acordo com o sistema."
            icon={<AlertTriangle size={48} color={Colors.text.muted} strokeWidth={1.5} />}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg.primary },
  summary: { flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 8 },
  sumBox: {
    flex: 1,
    backgroundColor: Colors.bg.secondary,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  sumVal: { fontSize: 20, fontWeight: '800' },
  sumLabel: { fontSize: 11, color: Colors.text.muted, textAlign: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.secondary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInfo: { flex: 1 },
  rowCodigo: { fontSize: 10, color: Colors.text.muted, fontFamily: 'monospace' },
  rowDescricao: { fontSize: 14, fontWeight: '600', color: Colors.text.primary, marginBottom: 4 },
  rowMeta: { flexDirection: 'row', gap: 10 },
  rowMetaText: { fontSize: 11, color: Colors.text.muted },
  rowObs: { fontSize: 11, color: Colors.text.secondary, fontStyle: 'italic', marginTop: 3 },
  difBadge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 48,
    alignItems: 'center',
  },
  difText: { fontSize: 14, fontWeight: '800' },
});
