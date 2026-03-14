import { Tabs } from 'expo-router';
import { LayoutDashboard, Package, ScanLine, Download } from 'lucide-react-native';
import { Colors } from '../../src/theme/colors';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#18181B',
          borderTopColor: '#27272A',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Colors.brand.primary,
        tabBarInactiveTintColor: Colors.text.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Estoque',
          tabBarIcon: ({ color, size }) => <Package size={size} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scanner',
          tabBarIcon: ({ color, size }) => <ScanLine size={size} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="export"
        options={{
          title: 'Exportar',
          tabBarIcon: ({ color, size }) => <Download size={size} color={color} strokeWidth={2} />,
        }}
      />
    </Tabs>
  );
}
