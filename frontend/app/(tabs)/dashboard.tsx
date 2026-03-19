import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { BarChart, PieChart } from 'react-native-gifted-charts';
import {
  LayoutDashboard, AlertTriangle, CheckCircle, Package,
  TrendingDown, TrendingUp, ChevronRight, Calendar,
} from 'lucide-react-native';
import { Colors } from '../../src/theme/colors';
import { StatCard } from '../../src/components/StatCard';
import { ensureOpenSession, getAllSessions } from '../../src/db/sessionsDB';
import { getCountsBySession, getSessionStats, getDivergences } from '../../src/db/countsDB';
import { getTotalItems } from '../../src/db/itemsDB';

export default function DashboardScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const chartWidth = width - 64;

  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ total: 0, ok: 0, falta: 0, diferenca: 0 });
  const [totalItems, setTotalItems] = useState(0);
  const [sessionName, setSessionName] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [topDivergences, setTopDivergences] = useState<{ value: number; label: string; frontColor: string }[]>([]);
  const [recentCounts, setRecentCounts] = useState<{ codigo: string; descricao: string; diferenca: number }[]>([]);

  const loadData = useCallback(() => {
    try {
      const session = ensureOpenSession();
      setSessionId(session.id);
      setSessionName(session.nome);
      const s = getSessionStats(session.id);
      setStats(s);
      setTotalItems(getTotalItems());
      const divs = getDivergences(session.id);
      setTopDivergences(
        divs.slice(0, 5).map((d) => ({
          value: Math.abs(d.diferenca),
          label: d.descricao.length > 8 ? d.descricao.substring(0, 8) : d.descricao,
          frontColor: d.diferenca < 0 ? Colors.brand.error : Colors.brand.success,
          topLabelComponent: () => (
            <Text style={{ color: d.diferenca < 0 ? Colors.brand.error : Colors.brand.success, fontSize: 9, fontWeight: '700' }}>
              {d.diferenca > 0 ? '+' : ''}{d.diferenca}
            </Text>
          ),
        }))
      );
      const recent = getCountsBySession(session.id).slice(0, 5);
      setRecentCounts(recent.map((c) => ({ codigo: c.codigo, descricao: c.descricao, diferenca: c.diferenca })));
    } catch (e) {
      console.error('loadData error:', e);
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

  const pieData = [
    stats.ok > 0 ? { value: stats.ok, color: Colors.brand.success, text: `${stats.ok}` } : null,
    stats.falta > 0 ? { value: stats.falta, color: Colors.brand.error, text: `${stats.falta}` } : null,
    stats.diferenca > 0 ? { value: stats.diferenca, color: Colors.brand.accent, text: `${stats.diferenca}` } : null,
  ].filter(Boolean) as { value: number; color: string; text: string }[];

  const hasCounts = stats.total > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brand.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.appName}>Ciclo de Inventário</Text>
            <Text style={styles.sessionName}>{sessionName || 'Carregando...'}</Text>
          </View>
          <View style={styles.onlineDot} />
        </View>

        {/* Stat Cards */}
        <View style={styles.statsRow}>
          <StatCard
            testID="stat-total-items"
            label="Itens Cadastrados"
            value={totalItems}
            icon={<Package size={20} color={Colors.brand.primary} />}
            color={Colors.brand.primary}
          />
          <StatCard
            testID="stat-total-counted"
            label="Contagens"
            value={stats.total}
            icon={<CheckCircle size={20} color={Colors.brand.success} />}
            color={Colors.brand.success}
          />
        </View>
        <View style={styles.statsRow}>
          <StatCard
            testID="stat-divergences"
            label="Divergências"
            value={stats.falta + stats.diferenca}
            icon={<AlertTriangle size={20} color={Colors.brand.error} />}
            color={Colors.brand.error}
            onPress={() => router.push({ pathname: '/divergences', params: { sessionId } })}
          />
          <StatCard
            testID="stat-ok"
            label="OK / Corretos"
            value={stats.ok}
            icon={<CheckCircle size={20} color={Colors.brand.accent} />}
            color={Colors.brand.accent}
          />
        </View>

        {/* Divergence Chart */}
        {topDivergences.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Top Divergências</Text>
            <Text style={styles.cardSub}>Maiores variações de estoque</Text>
            <BarChart
              data={topDivergences}
              width={chartWidth}
              height={160}
              barWidth={Math.min(36, (chartWidth - 60) / topDivergences.length - 8)}
              spacing={8}
              noOfSections={4}
              yAxisTextStyle={{ color: Colors.text.muted, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: Colors.text.muted, fontSize: 9 }}
              yAxisColor={Colors.border.subtle}
              xAxisColor={Colors.border.subtle}
              backgroundColor={Colors.bg.secondary}
              rulesColor={Colors.border.subtle}
              hideRules={false}
              isAnimated
              animationDuration={800}
            />
          </View>
        )}

        {/* Pie Chart */}
        {hasCounts && pieData.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Distribuição de Contagens</Text>
            <View style={styles.pieRow}>
              <PieChart
                data={pieData}
                donut
                radius={70}
                innerRadius={42}
                innerCircleColor={Colors.bg.secondary}
                centerLabelComponent={() => (
                  <View style={styles.pieCenter}>
                    <Text style={styles.pieCenterVal}>{stats.total}</Text>
                    <Text style={styles.pieCenterLabel}>total</Text>
                  </View>
                )}
              />
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: Colors.brand.success }]} />
                  <Text style={styles.legendText}>OK: {stats.ok}</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: Colors.brand.error }]} />
                  <Text style={styles.legendText}>Falta: {stats.falta}</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: Colors.brand.accent }]} />
                  <Text style={styles.legendText}>Diferença: {stats.diferenca}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Recent Counts */}
        {recentCounts.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Últimas Contagens</Text>
              <TouchableOpacity testID="ver-divergencias-btn" onPress={() => router.push({ pathname: '/divergences', params: { sessionId } })}>
                <Text style={styles.linkText}>Ver divergências</Text>
              </TouchableOpacity>
            </View>
            {recentCounts.map((c, i) => (
              <View key={i} style={styles.recentRow}>
                <View style={styles.recentLeft}>
                  {c.diferenca < 0 ? (
                    <TrendingDown size={16} color={Colors.brand.error} />
                  ) : c.diferenca > 0 ? (
                    <TrendingUp size={16} color={Colors.brand.success} />
                  ) : (
                    <CheckCircle size={16} color={Colors.text.muted} />
                  )}
                  <View style={styles.recentInfo}>
                    <Text style={styles.recentCodigo}>{c.codigo}</Text>
                    <Text style={styles.recentDescricao} numberOfLines={1}>{c.descricao}</Text>
                  </View>
                </View>
                <Text style={[
                  styles.recentDif,
                  { color: c.diferenca === 0 ? Colors.text.muted : c.diferenca < 0 ? Colors.brand.error : Colors.brand.success }
                ]}>
                  {c.diferenca > 0 ? '+' : ''}{c.diferenca}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ações Rápidas</Text>
          <TouchableOpacity testID="quick-scan-btn" style={styles.actionBtn} onPress={() => router.push('/(tabs)/scan')}>
            <Text style={styles.actionBtnText}>Iniciar Scanner</Text>
            <ChevronRight size={18} color={Colors.brand.primary} />
          </TouchableOpacity>
          <TouchableOpacity testID="quick-inventory-btn" style={styles.actionBtn} onPress={() => router.push('/(tabs)/inventory')}>
            <Text style={styles.actionBtnText}>Ver Estoque</Text>
            <ChevronRight size={18} color={Colors.brand.primary} />
          </TouchableOpacity>
          <TouchableOpacity testID="quick-export-btn" style={styles.actionBtn} onPress={() => router.push('/(tabs)/export')}>
            <Text style={styles.actionBtnText}>Exportar Relatório</Text>
            <ChevronRight size={18} color={Colors.brand.primary} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg.primary },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 24 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  appName: { fontSize: 22, fontWeight: '800', color: Colors.text.primary, letterSpacing: -0.5 },
  sessionName: { fontSize: 12, color: Colors.text.muted, marginTop: 2 },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.brand.success,
    shadowColor: Colors.brand.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  statsRow: { flexDirection: 'row', gap: 10 },
  card: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.text.primary, marginBottom: 4 },
  cardSub: { fontSize: 12, color: Colors.text.muted, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  linkText: { fontSize: 12, color: Colors.brand.primary, fontWeight: '600' },
  pieRow: { flexDirection: 'row', alignItems: 'center', gap: 24, paddingTop: 8 },
  pieCenter: { alignItems: 'center' },
  pieCenterVal: { fontSize: 22, fontWeight: '800', color: Colors.text.primary },
  pieCenterLabel: { fontSize: 10, color: Colors.text.muted },
  legend: { gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 13, color: Colors.text.secondary },
  recentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  recentLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  recentInfo: { flex: 1 },
  recentCodigo: { fontSize: 10, color: Colors.text.muted, fontFamily: 'monospace' },
  recentDescricao: { fontSize: 13, fontWeight: '600', color: Colors.text.primary },
  recentDif: { fontSize: 14, fontWeight: '700' },
  actionBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  actionBtnText: { fontSize: 14, fontWeight: '600', color: Colors.text.primary },
});
