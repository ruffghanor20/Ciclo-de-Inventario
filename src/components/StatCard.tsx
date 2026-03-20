import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../theme/colors';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: string;
  onPress?: () => void;
  testID?: string;
}

export function StatCard({ label, value, icon, color = Colors.brand.primary, onPress, testID }: StatCardProps) {
  const Container = onPress ? TouchableOpacity : View;
  return (
    <Container
      testID={testID}
      onPress={onPress}
      style={[styles.card, { borderLeftColor: color }]}
      activeOpacity={0.7}
    >
      <View style={[styles.iconWrap, { backgroundColor: color + '20' }]}>{icon}</View>
      <View style={styles.info}>
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.label}>{label}</Text>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: 12,
    borderLeftWidth: 3,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  value: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  label: {
    fontSize: 11,
    color: Colors.text.secondary,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
