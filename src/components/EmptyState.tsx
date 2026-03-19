import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PackageSearch } from 'lucide-react-native';
import { Colors } from '../theme/colors';

interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
}

export function EmptyState({
  title = 'Nenhum item encontrado',
  message = 'Tente ajustar os filtros ou adicionar novos itens.',
  icon,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        {icon ?? <PackageSearch size={48} color={Colors.text.muted} strokeWidth={1.5} />}
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  iconWrap: {
    marginBottom: 16,
    opacity: 0.5,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: Colors.text.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
