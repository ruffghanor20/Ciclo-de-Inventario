import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { CalendarClock, FolderOpen, Trash2 } from 'lucide-react-native';
import { Colors } from '../../src/theme/colors';
import {
  createSession,
  deleteSession,
  ensureOpenSession,
  getAllSessionsWithStats,
  getOpenSession,
  loadSession,
  SessionWithStats,
} from '../../src/db/sessionsDB';
import { EmptyState } from '../../src/components/EmptyState';
import { getUsername } from '../../src/db/settingsDB';

function formatDateTime(value: string): string {
  try {
    return new Date(value).toLocaleString('pt-BR');
  } catch {
    return value;
  }
}

export default function SessionsScreen() {
  const [sessions, setSessions] = useState<SessionWithStats[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(() => {
    setSessions(getAllSessionsWithStats());
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

  const handleLoadSession = (session: SessionWithStats) => {
    Alert.alert(
      'Carregar sessão',
      `Deseja carregar a sessão "${session.nome}" para continuar as contagens?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Carregar',
          onPress: () => {
            loadSession(session.id);
            loadData();
          },
        },
      ]
    );
  };

  const handleDeleteSession = (session: SessionWithStats) => {
    Alert.alert(
      'Excluir sessão',
      `Excluir "${session.nome}" e ${session.total_contagens} contagem(ns) vinculada(s)?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            const wasOpen = getOpenSession()?.id === session.id;
            deleteSession(session.id);
            if (wasOpen) ensureOpenSession();
            loadData();
          },
        },
      ]
    );
  };

  const handleNewSession = () => {
    const now = new Date();
    const nome = `Contagem ${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
    const responsavel = getUsername() || 'Operador';
    const created = createSession(nome, responsavel);
    loadSession(created.id);
    loadData();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Sessão de Contagem</Text>
          <Text style={styles.subtitle}>{sessions.length} sessões registradas</Text>
        </View>
        <TouchableOpacity style={styles.newBtn} onPress={handleNewSession}>
          <Text style={styles.newBtnText}>+ Nova</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brand.primary} />
        }
        renderItem={({ item }) => {
          const isOpen = item.status === 'aberta';
          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.name} numberOfLines={1}>{item.nome}</Text>
                <View style={[styles.statusBadge, isOpen ? styles.badgeOpen : styles.badgeClosed]}>
                  <Text style={[styles.statusText, isOpen ? styles.statusTextOpen : styles.statusTextClosed]}>
                    {isOpen ? 'Aberta' : 'Fechada'}
                  </Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <CalendarClock size={14} color={Colors.text.muted} />
                <Text style={styles.metaText}>Início: {formatDateTime(item.data_inicio)}</Text>
              </View>
              <Text style={styles.metaText}>Responsável: {item.responsavel || 'Operador'}</Text>
              <Text style={styles.metaText}>Contagens: {item.total_contagens}</Text>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.loadBtn]}
                  onPress={() => handleLoadSession(item)}
                >
                  <FolderOpen size={15} color={Colors.text.primary} />
                  <Text style={styles.actionText}>Carregar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.deleteBtn]}
                  onPress={() => handleDeleteSession(item)}
                >
                  <Trash2 size={15} color={Colors.brand.error} />
                  <Text style={styles.deleteText}>Excluir</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            title="Sem sessões cadastradas"
            message="Crie uma nova sessão para começar a registrar contagens."
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg.primary },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  title: { fontSize: 21, fontWeight: '800', color: Colors.text.primary },
  subtitle: { fontSize: 12, color: Colors.text.muted, marginTop: 2 },
  newBtn: {
    backgroundColor: Colors.brand.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  newBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  listContent: { padding: 16, gap: 10, paddingBottom: 24 },
  card: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    padding: 12,
    gap: 6,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 14, fontWeight: '700', color: Colors.text.primary },
  statusBadge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  badgeOpen: { borderColor: Colors.brand.success + '80', backgroundColor: Colors.brand.success + '20' },
  badgeClosed: { borderColor: Colors.border.strong, backgroundColor: Colors.bg.tertiary },
  statusText: { fontSize: 11, fontWeight: '700' },
  statusTextOpen: { color: Colors.brand.success },
  statusTextClosed: { color: Colors.text.secondary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12, color: Colors.text.secondary },
  actions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  actionBtn: {
    height: 36,
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  loadBtn: {
    backgroundColor: Colors.brand.primary + '22',
    borderWidth: 1,
    borderColor: Colors.brand.primary + '55',
  },
  deleteBtn: {
    backgroundColor: Colors.brand.error + '12',
    borderWidth: 1,
    borderColor: Colors.brand.error + '40',
  },
  actionText: { color: Colors.text.primary, fontSize: 12, fontWeight: '700' },
  deleteText: { color: Colors.brand.error, fontSize: 12, fontWeight: '700' },
});
