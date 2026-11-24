import { useEffect, useState } from 'react';
import Constants from 'expo-constants';
import { initPalletCounts } from '../src/db/palletDB';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { openDatabase, initDatabase, seedDemoData } from '../src/db/database';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const database = openDatabase();
    initDatabase(database);
    initPalletCounts(database);
    if (!Constants.expoConfig?.extra?.inventarioGeral) seedDemoData(database);
    setReady(true);
  }, []);
  if (!ready) return null;

  return (
    <>
      <StatusBar style="light" backgroundColor="#09090B" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#09090B' } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="coletor" options={{ headerShown: false }} />
        <Stack.Screen
          name="count"
          options={{
            presentation: 'modal',
            headerShown: true,
            headerTitle: 'Registrar Contagem',
            headerStyle: { backgroundColor: '#18181B' },
            headerTintColor: '#FAFAFA',
            headerTitleStyle: { fontWeight: '700', fontSize: 17 },
          }}
        />
        <Stack.Screen
          name="divergences"
          options={{
            headerShown: true,
            headerTitle: 'Divergências',
            headerStyle: { backgroundColor: '#18181B' },
            headerTintColor: '#FAFAFA',
            headerTitleStyle: { fontWeight: '700', fontSize: 17 },
          }}
        />
      </Stack>
    </>
  );
}
