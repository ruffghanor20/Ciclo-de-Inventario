import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { FileText, FileSpreadsheet, FolderOpen, X, ChevronDown, CheckCircle } from 'lucide-react-native';
import { Colors } from '../../src/theme/colors';
import { getAllSessions, Session, ensureOpenSession, closeSession, createSession } from '../../src/db/sessionsDB';
import { getCountsBySession, getSessionStats } from '../../src/db/countsDB';
import { exportCSV, exportPDF } from '../../src/services/exportService';

export default function ExportScreen() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [stats, setStats] = useState({ total: 0, ok: 0, falta: 0, sobra: 0 });
  const [loading, setLoading] = useState<'csv' | 'pdf' | null>(null);
  const [showSessions, setShowSessions] = useState(false);

  const loadData = useCallback(() => {
    const all = getAllSessions();
    setSessions(all);
    const open = ensureOpenSession();
    const sel = all.find((s) => s.id === open.id) ?? all[0] ?? null;
    setSelectedSession(sel);
    if (sel) {
      setStats(getSessionStats(sel.id));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const selectSession = (s: Session) => {
    setSelectedSession(s);
    setStats(getSessionStats(s.id));
    setShowSessions(false);
  };

  const handleExportCSV = async () => {
    if (!selectedSession) return;
    const entries = getCountsBySession(selectedSession.id);
    if (entries.length === 0) {
      Alert.alert('Atenção', 'Nenhuma contagem registrada nesta sessão.');
      return;
    }
    setLoading('csv');
    try {
      await exportCSV(entries, selectedSession);
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Falha ao exportar CSV.');
    } finally {
      setLoading(null);
    }
  };

  const handleExportPDF = async () => {
    if (!selectedSession) return;
    const entries = getCountsBySession(selectedSession.id);
    if (entries.length === 0) {
      Alert.alert('Atenção', 'Nenhuma contagem registrada nesta sessão.');
      return;
    }
    setLoading('pdf');
    try {
      await exportPDF(entries, selectedSession);
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Falha ao gerar PDF.');
    } finally {
      setLoading(null);
    }
  };

  const handleCloseSession = () => {
    if (!selectedSession || selectedSession.status === 'fechada') return;
    Alert.alert(
      'Encerrar Sessão',
      `Encerrar "${selectedSession.nome}"? Isso bloqueia novas contagens nesta sessão.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Encerrar',
          style: 'destructive',
          onPress: () => {
            closeSession(selectedSession.id);
            loadData();
          },
        },
      ]
    );
  };

  const handleNewSession = () => {
    const now = new Date();
    const nome = `Contagem ${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    const s = createSession(nome);
    loadData();
    setSelectedSession(s);
    setStats(getSessionStats(s.id));
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Exportar</Text>

        {/* Session Selector */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sessão de Contagem</Text>
          <TouchableOpacity
            testID="session-selector"
            style={styles.sessionBtn}
            onPress={() => setShowSessions(!showSessions)}
          >
            <View style={styles.sessionBtnLeft}>
              <FolderOpen size={18} color={Colors.brand.primary} />
              <View>
                <Text style={styles.sessionBtnName} numberOfLines={1}>
                  {selectedSession?.nome ?? 'Selecionar sessão'}
                </Text>
                {selectedSession && (
                  <Text style={styles.sessionBtnMeta}>
                    {selectedSession.status === 'aberta' ? '🟢 Aberta' : '🔴 Encerrada'} · {stats.total} contagens
                  </Text>
                )}
              </View>
            </View>
            <ChevronDown size={18} color={Colors.text.muted} />
          </TouchableOpacity>

          {showSessions && (
            <View style={styles.sessionList}>
              {sessions.map((s) => (
                <TouchableOpacity
                  testID={`session-item-${s.id}`}
                  key={s.id}
                  style={[styles.sessionItem, s.id === selectedSession?.id && styles.sessionItemActive]}
                  onPress={() => selectSession(s)}
                >
                  <Text style={[styles.sessionItemName, s.id === selectedSession?.id && styles.sessionItemNameActive]}>
                    {s.nome}
                  </Text>
                  <Text style={styles.sessionItemMeta}>{s.status === 'aberta' ? 'Aberta' : 'Encerrada'}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity testID="new-session-btn" style={styles.newSessionBtn} onPress={handleNewSession}>
                <Text style={styles.newSessionText}>+ Nova sessão</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Stats for selected session */}
        {selectedSession && (
          <View style={styles.statsRow}>
            <View style={[styles.statBox, { borderColor: Colors.brand.primary + '40' }]}>
              <Text style={[styles.statVal, { color: Colors.brand.primary }]}>{stats.total}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={[styles.statBox, { borderColor: Colors.brand.success + '40' }]}>
              <Text style={[styles.statVal, { color: Colors.brand.success }]}>{stats.ok}</Text>
              <Text style={styles.statLabel}>OK</Text>
            </View>
            <View style={[styles.statBox, { borderColor: Colors.brand.error + '40' }]}>
              <Text style={[styles.statVal, { color: Colors.brand.error }]}>{stats.falta}</Text>
              <Text style={styles.statLabel}>Falta</Text>
            </View>
            <View style={[styles.statBox, { borderColor: Colors.brand.accent + '40' }]}>
              <Text style={[styles.statVal, { color: Colors.brand.accent }]}>{stats.sobra}</Text>
              <Text style={styles.statLabel}>Sobra</Text>
            </View>
          </View>
        )}

        {/* Export Buttons */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Formatos de Exportação</Text>

          <TouchableOpacity
            testID="export-csv-btn"
            style={[styles.exportBtn, styles.exportCsvBtn]}
            onPress={handleExportCSV}
            disabled={loading !== null}
          >
            {loading === 'csv' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <FileSpreadsheet size={24} color="#fff" />
            )}
            <View style={styles.exportBtnInfo}>
              <Text style={styles.exportBtnTitle}>Exportar CSV</Text>
              <Text style={styles.exportBtnSub}>Compatível com Excel, Google Sheets</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            testID="export-pdf-btn"
            style={[styles.exportBtn, styles.exportPdfBtn]}
            onPress={handleExportPDF}
            disabled={loading !== null}
          >
            {loading === 'pdf' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <FileText size={24} color="#fff" />
            )}
            <View style={styles.exportBtnInfo}>
              <Text style={styles.exportBtnTitle}>Exportar PDF</Text>
              <Text style={styles.exportBtnSub}>Relatório formatado para impressão</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Session Actions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Gerenciar Sessão</Text>
          {selectedSession?.status === 'aberta' && (
            <TouchableOpacity testID="close-session-btn" style={styles.actionRow} onPress={handleCloseSession}>
              <X size={18} color={Colors.brand.error} />
              <Text style={[styles.actionText, { color: Colors.brand.error }]}>Encerrar sessão atual</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity testID="new-session-action-btn" style={styles.actionRow} onPress={handleNewSession}>
            <CheckCircle size={18} color={Colors.brand.success} />
            <Text style={[styles.actionText, { color: Colors.brand.success }]}>Iniciar nova sessão</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg.primary },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text.primary, marginBottom: 4 },
  card: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    gap: 12,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.text.primary },
  sessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bg.tertiary,
    borderRadius: 10,
    padding: 14,
  },
  sessionBtnLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  sessionBtnName: { fontSize: 14, fontWeight: '600', color: Colors.text.primary },
  sessionBtnMeta: { fontSize: 12, color: Colors.text.muted, marginTop: 2 },
  sessionList: {
    backgroundColor: Colors.bg.primary,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  sessionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  sessionItemActive: { backgroundColor: Colors.brand.primary + '15' },
  sessionItemName: { fontSize: 13, color: Colors.text.secondary },
  sessionItemNameActive: { color: Colors.brand.primary, fontWeight: '600' },
  sessionItemMeta: { fontSize: 11, color: Colors.text.muted },
  newSessionBtn: { padding: 14, alignItems: 'center' },
  newSessionText: { color: Colors.brand.primary, fontWeight: '600', fontSize: 14 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statBox: {
    flex: 1,
    backgroundColor: Colors.bg.secondary,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
  },
  statVal: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 10, color: Colors.text.muted, marginTop: 2, textTransform: 'uppercase' },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    gap: 14,
  },
  exportCsvBtn: { backgroundColor: '#059669' },
  exportPdfBtn: { backgroundColor: '#DC2626' },
  exportBtnInfo: { flex: 1 },
  exportBtnTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  exportBtnSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  actionText: { fontSize: 14, fontWeight: '600' },
});
