import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { Colors } from '../theme/colors';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  testID?: string;
}

export function SearchBar({ value, onChangeText, placeholder = 'Buscar código ou descrição...', testID }: SearchBarProps) {
  return (
    <View style={styles.container}>
      <Search size={18} color={Colors.text.muted} />
      <TextInput
        testID={testID}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.text.muted}
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="never"
        returnKeyType="search"
        editable
      />
      {value.length > 0 && (
        <TouchableOpacity testID="search-clear-btn" onPress={() => onChangeText('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <X size={16} color={Colors.text.muted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.secondary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: Colors.text.primary,
  },
});
