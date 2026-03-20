import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../theme/colors';
import { ChevronRight } from 'lucide-react-native';

interface ItemRowProps {
  codigo: string;
  descricao: string;
  categoria?: string;
  localizacao?: string;
  saldo?: number;
  contado?: number | null;
  diferenca?: number | null;
  dataContado?: string | null;
  curvaAbc?: string | null;
  proximaContagem?: string | null;
  onPress?: () => void;
  testID?: string;
}

export function ItemRow({
  codigo,
  descricao,
  categoria,
  localizacao,
  saldo,
  contado,
  diferenca,
  dataContado,
  curvaAbc,
  proximaContagem,
  onPress,
  testID,
}: ItemRowProps) {
  const hasDivergence = diferenca !== null && diferenca !== undefined && diferenca !== 0;
  const badgeColor =
    diferenca === null || diferenca === undefined
      ? Colors.text.muted
      : diferenca === 0
      ? Colors.status.ok
      : diferenca < 0
      ? Colors.status.falta
      : Colors.status.diferenca;

  const badgeLabel =
    diferenca === null || diferenca === undefined
      ? '—'
      : diferenca === 0
      ? 'OK'
      : diferenca < 0
      ? `${diferenca}`
      : `+${diferenca}`;

  return (
    <TouchableOpacity
      testID={testID}
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.left}>
        <Text style={styles.codigo} numberOfLines={1}>{codigo}</Text>
        <Text style={styles.descricao} numberOfLines={2}>{descricao}</Text>
        <View style={styles.metaRow}>
          {categoria ? (
            <View style={styles.chip}>
              <Text style={styles.chipText}>{categoria}</Text>
            </View>
          ) : null}
          {localizacao ? (
            <View style={[styles.chip, styles.chipLoc]}>
              <Text style={styles.chipText}>{localizacao}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.scheduleRow}>
          <Text style={styles.scheduleText}>Contado: <Text style={styles.scheduleValue}>{dataContado ?? '-'}</Text></Text>
          <Text style={styles.scheduleText}>Curva-ABC: <Text style={styles.scheduleValue}>{curvaAbc ?? 'C'}</Text></Text>
          <Text style={styles.scheduleText}>Próx.: <Text style={styles.scheduleValue}>{proximaContagem ?? '-'}</Text></Text>
        </View>
      </View>
      <View style={styles.right}>
        {saldo !== undefined && (
          <Text style={styles.saldo}>Saldo: {saldo}</Text>
        )}
        <View style={[styles.badge, { backgroundColor: badgeColor + '22', borderColor: badgeColor + '60' }]}>
          <Text style={[styles.badgeText, { color: badgeColor }]}>{badgeLabel}</Text>
        </View>
        <ChevronRight size={16} color={Colors.text.muted} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.secondary,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  left: { flex: 1, marginRight: 10 },
  codigo: { fontSize: 11, color: Colors.text.muted, fontFamily: 'monospace', marginBottom: 2 },
  descricao: { fontSize: 14, fontWeight: '600', color: Colors.text.primary, lineHeight: 18 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  scheduleRow: { marginTop: 8, gap: 2 },
  scheduleText: { fontSize: 11, color: Colors.text.secondary },
  scheduleValue: { color: Colors.text.primary, fontWeight: '700' },
  chip: {
    backgroundColor: Colors.brand.primary + '20',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  chipLoc: { backgroundColor: Colors.bg.tertiary },
  chipText: { fontSize: 10, color: Colors.text.secondary, fontWeight: '500' },
  right: { alignItems: 'flex-end', gap: 6 },
  saldo: { fontSize: 11, color: Colors.text.muted },
  badge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minWidth: 44,
    alignItems: 'center',
  },
  badgeText: { fontSize: 12, fontWeight: '700' },
});
