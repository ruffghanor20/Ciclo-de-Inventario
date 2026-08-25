import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CalendarClock,
  Check,
  Download,
  FlaskConical,
  FolderOpen,
  LayoutDashboard,
  Menu,
  Package,
  ScanLine,
  UserRound,
  X,
} from 'lucide-react-native';
import { Colors } from '../../src/theme/colors';
import { getUsername, saveUsername } from '../../src/db/settingsDB';

type MenuPath =
  | '/(tabs)/dashboard'
  | '/(tabs)/inventory'
  | '/(tabs)/sessions'
  | '/(tabs)/schedule'
  | '/(tabs)/scan'
  | '/(tabs)/blends'
  | '/(tabs)/export';

type MenuItem = {
  label: string;
  path: MenuPath;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
};

const MENU_ITEMS: MenuItem[] = [
  { label: 'Dashboard', path: '/(tabs)/dashboard', icon: LayoutDashboard },
  { label: 'Estoque', path: '/(tabs)/inventory', icon: Package },
  { label: 'Sessão de Contagem', path: '/(tabs)/sessions', icon: FolderOpen },
  { label: 'Programação', path: '/(tabs)/schedule', icon: CalendarClock },
  { label: 'Scanner', path: '/(tabs)/scan', icon: ScanLine },
  { label: 'Blends / Dosadores', path: '/(tabs)/blends', icon: FlaskConical },
  { label: 'Exportar', path: '/(tabs)/export', icon: Download },
];

export default function TabsLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const stored = getUsername();
    setUsername(stored);
    setUsernameInput(stored);
  }, []);

  const currentTitle = useMemo(() => {
    return MENU_ITEMS.find((item) => pathname?.startsWith(item.path))?.label ?? 'Ciclo de Inventário';
  }, [pathname]);

  const navigateTo = (path: MenuPath) => {
    router.push(path as any);
    setMenuOpen(false);
  };

  const handleSaveUsername = () => {
    const normalized = usernameInput.trim();
    saveUsername(normalized);
    setUsername(normalized);
    Alert.alert('Nome salvo', normalized ? `Usuário: ${normalized}` : 'Nome de usuário removido.');
  };

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable accessibilityLabel={menuOpen ? 'Fechar menu' : 'Abrir menu'} onPress={() => setMenuOpen((v) => !v)} style={styles.menuButton}>
          {menuOpen ? <X size={22} color={Colors.text.primary} /> : <Menu size={22} color={Colors.text.primary} />}
        </Pressable>
        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={1}>{currentTitle}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{username ? `Usuário: ${username}` : 'Menu de módulos'}</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      {menuOpen && (
        <View style={styles.menuPanel}>
          <View style={styles.userRow}>
            <View style={styles.userInputWrap}>
              <UserRound size={16} color={Colors.text.muted} />
              <TextInput
                value={usernameInput}
                onChangeText={setUsernameInput}
                placeholder="Nome do usuário"
                placeholderTextColor={Colors.text.muted}
                style={styles.userInput}
              />
            </View>
            <Pressable style={styles.saveUserButton} onPress={handleSaveUsername}>
              <Check size={16} color={Colors.text.primary} />
              <Text style={styles.saveUserText}>Salvar</Text>
            </Pressable>
          </View>

          {MENU_ITEMS.map(({ label, path, icon: Icon }) => {
            const active = pathname?.startsWith(path);
            return (
              <Pressable key={path} onPress={() => navigateTo(path)} style={[styles.menuItem, active && styles.menuItemActive]}>
                <Icon size={18} color={active ? Colors.brand.primary : Colors.text.primary} strokeWidth={2.1} />
                <Text style={[styles.menuItemText, active && styles.menuItemTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={styles.content}>
        <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}>
          <Tabs.Screen name="dashboard" options={{ title: 'Dashboard' }} />
          <Tabs.Screen name="inventory" options={{ title: 'Estoque' }} />
          <Tabs.Screen name="sessions" options={{ title: 'Sessão de Contagem' }} />
          <Tabs.Screen name="schedule" options={{ title: 'Programação' }} />
          <Tabs.Screen name="scan" options={{ title: 'Scanner' }} />
          <Tabs.Screen name="blends" options={{ title: 'Blends / Dosadores' }} />
          <Tabs.Screen name="export" options={{ title: 'Exportar' }} />
        </Tabs>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  topBar: {
    minHeight: 66,
    paddingBottom: 8,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
    backgroundColor: Colors.bg.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 20,
  },
  menuButton: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg.tertiary },
  placeholder: { width: 40, height: 40 },
  titleBlock: { flex: 1, paddingHorizontal: 10 },
  title: { color: Colors.text.primary, fontSize: 17, fontWeight: '700' },
  subtitle: { color: Colors.text.muted, fontSize: 11, marginTop: 1 },
  menuPanel: { borderBottomWidth: 1, borderBottomColor: Colors.border.subtle, backgroundColor: '#121214', paddingHorizontal: 14, paddingVertical: 8, gap: 8, zIndex: 30 },
  userRow: { flexDirection: 'row', gap: 8, marginBottom: 2 },
  userInputWrap: { flex: 1, height: 40, borderRadius: 10, borderWidth: 1, borderColor: Colors.border.subtle, backgroundColor: Colors.bg.secondary, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  userInput: { flex: 1, color: Colors.text.primary, fontSize: 13, paddingVertical: 0 },
  saveUserButton: { height: 40, minWidth: 86, borderRadius: 10, backgroundColor: Colors.bg.tertiary, borderWidth: 1, borderColor: Colors.border.strong, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  saveUserText: { color: Colors.text.primary, fontSize: 12, fontWeight: '700' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.bg.secondary },
  menuItemActive: { backgroundColor: Colors.brand.primary + '18', borderWidth: 1, borderColor: Colors.brand.primary + '55' },
  menuItemText: { color: Colors.text.primary, fontSize: 14, fontWeight: '600' },
  menuItemTextActive: { color: Colors.brand.primary },
  content: { flex: 1 },
});
