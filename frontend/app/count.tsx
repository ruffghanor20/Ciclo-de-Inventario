import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Save, Minus, Plus, MapPin, StickyNote } from 'lucide-react-native';
import { Colors } from '../src/theme/colors';
import { getItemByCode, StockItem } from '../src/db/itemsDB';
import { ensureOpenSession } from '../src/db/sessionsDB';
import { saveCount, getCountByCodigo } from '../src/db/countsDB';

function parseQuantidade(value: string): number {
  const normalized = value.trim().replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function CountScreen() {
  const router = useRouter();
  const { codigo, sessionId: paramSessionId } = useLocalSearchParams<{ codigo: string; sessionId?: string }>();

  const [item, setItem] = useState<StockItem | null>(null);
  const [descricao, setDescricao] = useState('');
  const [saldoSistema, setSaldoSistema] = useState(0);
  const [localizacao, setLocalizacao] = useState('');
  const [quantidadeStr, setQuantidadeStr] = useState('');
  const [observacao, setObservacao] = useState('');
  const [saving, setSaving] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const quantRef = useRef<TextInput>(null);

  const quantidade = parseQuantidade(quantidadeStr);
  const diferenca = quantidade - saldoSistema;

  useEffect(() => {
    if (!codigo) return;

    const session = ensureOpenSession();
    const sid = paramSessionId ?? session.id;
    setSessionId(sid);

    const found = getItemByCode(codigo);
    if (found) {
      setItem(found);
      setDescricao(found.descricao);
      setSaldoSistema(found.saldo_sistema);
      setLocalizacao(found.localizacao);
    } else {
      setDescricao('Item desconhecido');
      setSaldoSistema(0);
    }

    // Load existing count
    const existing = getCountByCodigo(sid, codigo);
    if (existing) {
      setQuantidadeStr(String(existing.quantidade_contada));
      setObservacao(existing.observacao);
    } else {
      setQuantidadeStr('');
    }

    // Fluxo B (scanner): ao abrir a tela, focar automaticamente o campo de quantidade.
    setTimeout(() => {
      quantRef.current?.focus();
    }, 250);

  }, [codigo, paramSessionId]);

  const adjust = (delta: number) => {
    const current = parseQuantidade(quantidadeStr);
    const next = Math.max(0, current + delta);
    setQuantidadeStr(String(next));
  };

  const handleQuantidadeChange = (value: string) => {
    const cleaned = value.replace(/[^0-9.,]/g, '');
    setQuantidadeStr(cleaned);
  };

  const handleSave = async () => {
    if (!codigo) return;
    const qtd = parseQuantidade(quantidadeStr);
    if (isNaN(qtd) || qtd < 0) {
      Alert.alert('Valor inválido', 'Informe uma quantidade válida.');
      return;
    }
    setSaving(true);
    try {
      saveCount({
        session_id: sessionId,
        item_id: item?.id ?? null,
        codigo,
        descricao,
        saldo_sistema: saldoSistema,
        quantidade_contada: qtd,
        localizacao,
        observacao,
        escaneado: true,
      });
      Alert.alert('Salvo!', `Contagem de "${descricao}" registrada com sucesso.`, [
        { text: 'Continuar', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  const difColor = diferenca === 0 ? Colors.text.muted : diferenca < 0 ? Colors.brand.error : Colors.brand.success;
  const difLabel = diferenca === 0 ? 'Sem divergência' : diferenca < 0 ? `Falta ${Math.abs(diferenca)}` : `Diferença +${diferenca}`;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Item Card */}
          <View style={styles.itemCard}>
            <Text style={styles.codigoText}>{codigo}</Text>
            <Text style={styles.descricaoText}>{descricao}</Text>
            <View style={styles.itemMeta}>
              <View style={styles.metaChip}>
                <Text style={styles.metaLabel}>Saldo sistema</Text>
                <Text style={styles.metaValue}>{saldoSistema}</Text>
              </View>
              {localizacao ? (
                <View style={styles.metaChip}>
                  <MapPin size={12} color={Colors.text.muted} />
                  <Text style={styles.metaValue}>{localizacao}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Quantity Input */}
          <View style={styles.card}>
            <Text style={styles.label}>Quantidade Contada</Text>
            <View style={styles.quantRow}>
              <TouchableOpacity
                testID="qty-minus-btn"
                style={styles.adjBtn}
                onPress={() => adjust(-1)}
              >
                <Minus size={20} color={Colors.text.primary} />
              </TouchableOpacity>
              <TextInput
                testID="quantity-input"
                ref={quantRef}
                style={styles.quantInput}
                value={quantidadeStr}
                onChangeText={handleQuantidadeChange}
                keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
                placeholder="0"
                placeholderTextColor={Colors.text.muted}
                selectTextOnFocus
                editable
                showSoftInputOnFocus
              />
              <TouchableOpacity
                testID="qty-plus-btn"
                style={styles.adjBtn}
                onPress={() => adjust(1)}
              >
                <Plus size={20} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.quickAdjustRow}>
              <TouchableOpacity style={styles.quickBtn} onPress={() => adjust(-10)}>
                <Text style={styles.quickBtnText}>-10</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickBtn} onPress={() => adjust(10)}>
                <Text style={styles.quickBtnText}>+10</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Difference */}
          {quantidadeStr !== '' && (
            <View style={[styles.difCard, { borderColor: difColor + '40', backgroundColor: difColor + '12' }]}>
              <Text style={styles.difLabel}>Diferença</Text>
              <Text style={[styles.difValue, { color: difColor }]}>
                {diferenca > 0 ? '+' : ''}{diferenca}
              </Text>
              <Text style={[styles.difStatus, { color: difColor }]}>{difLabel}</Text>
            </View>
          )}

          {/* Observation */}
          <View style={styles.card}>
            <View style={styles.labelRow}>
              <StickyNote size={14} color={Colors.text.muted} />
              <Text style={styles.label}>Observação (opcional)</Text>
            </View>
            <TextInput
              testID="observation-input"
              style={styles.obsInput}
              value={observacao}
              onChangeText={setObservacao}
              placeholder="Ex: Embalagem danificada, material em trânsito..."
              placeholderTextColor={Colors.text.muted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </ScrollView>

        {/* Save Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            testID="save-count-btn"
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Save size={20} color="#fff" />
                <Text style={styles.saveBtnText}>Salvar Contagem</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg.primary },
  flex: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 16 },
  itemCard: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: 14,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  codigoText: { fontSize: 12, color: Colors.text.muted, fontFamily: 'monospace', letterSpacing: 1 },
  descricaoText: { fontSize: 18, fontWeight: '700', color: Colors.text.primary },
  itemMeta: { flexDirection: 'row', gap: 12, marginTop: 4 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.bg.tertiary, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  metaLabel: { fontSize: 11, color: Colors.text.muted },
  metaValue: { fontSize: 13, fontWeight: '700', color: Colors.text.primary },
  card: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: 14,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text.secondary },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  quantRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  quickAdjustRow: { flexDirection: 'row', gap: 10, marginTop: 2 },
  quickBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border.strong,
    backgroundColor: Colors.bg.tertiary,
  },
  quickBtnText: { color: Colors.text.secondary, fontWeight: '700', fontSize: 13 },
  adjBtn: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: Colors.bg.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border.strong,
  },
  quantInput: {
    flex: 1,
    height: 56,
    backgroundColor: Colors.bg.primary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border.active,
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text.primary,
    letterSpacing: 1,
  },
  difCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  difLabel: { fontSize: 13, color: Colors.text.secondary, fontWeight: '600' },
  difValue: { fontSize: 26, fontWeight: '800' },
  difStatus: { fontSize: 12, fontWeight: '600' },
  obsInput: {
    backgroundColor: Colors.bg.primary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border.strong,
    padding: 12,
    color: Colors.text.primary,
    fontSize: 14,
    minHeight: 80,
  },
  footer: { padding: 16, backgroundColor: Colors.bg.primary, borderTopWidth: 1, borderTopColor: Colors.border.subtle },
  saveBtn: {
    backgroundColor: Colors.brand.primary,
    borderRadius: 12,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: Colors.brand.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
