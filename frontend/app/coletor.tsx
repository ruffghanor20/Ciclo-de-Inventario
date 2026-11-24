import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Archive, Check, ClipboardList, FileSpreadsheet, History, MapPin, Pencil, Printer as PrinterIcon, ScanLine, Settings2, Upload } from 'lucide-react-native';
import { getItemByCode, type StockItem } from '../src/db/itemsDB';
import { ensureOpenSession, getSessionById, type Session } from '../src/db/sessionsDB';
import { getPalletTotal, listPalletCounts, savePalletCount, suggestMaterials, type PalletCount } from '../src/db/palletDB';
import { exportPalletXLSX, importItemsFromXLSX } from '../src/services/xlsxService';
import { preferredPrinter, printPallet, setPreferredPrinter, type Printer } from '../src/services/labelPrinter';
import { CollectorPrinter } from '../src/components/CollectorPrinter';
import { PalletScanner } from '../src/components/PalletScanner';
import { type ScanField } from '../src/utils/palletRules';

const muted = '#a5b5c9';
const accent = '#85caff';
const format = (q: number) => q.toLocaleString('pt-BR', { maximumSignificantDigits: 15 });
function errorText(e: unknown) { return e instanceof Error ? e.message : String(e); }

export default function Coletor() {
  const router = useRouter();
  const { sessionId, modo } = useLocalSearchParams<{ sessionId?: string; modo?: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<'count' | 'history'>(modo === 'historico' ? 'history' : 'count');
  const [toolsOpen, setToolsOpen] = useState(false);
  const [total, setTotal] = useState(0);
  const [address, setAddress] = useState('');
  const [uc, setUC] = useState('');
  const [query, setQuery] = useState('');
  const [item, setItem] = useState<StockItem | null>(null);
  const [quantity, setQuantity] = useState('');
  const [editing, setEditing] = useState<string>();
  const [scanner, setScanner] = useState<ScanField | null>(null);
  const [printerOpen, setPrinterOpen] = useState(false);
  const [printer, setPrinter] = useState<Printer | null>(null);
  const [autoPrint, setAutoPrint] = useState(false);
  const [last, setLast] = useState<PalletCount | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const activeSession = useRef('');
  const [history, setHistory] = useState<PalletCount[]>([]);
  const [filter, setFilter] = useState('');
  const [revision, setRevision] = useState(0);
  const addressInput = useRef<TextInput>(null);
  const ucInput = useRef<TextInput>(null);
  const materialInput = useRef<TextInput>(null);
  const qtyInput = useRef<TextInput>(null);
  const formScroll = useRef<ScrollView>(null);
  const isOpen = session?.status === 'aberta';
  const clearForm = useCallback(() => {
    setAddress(''); setUC(''); setQuery(''); setItem(null); setQuantity(''); setEditing(undefined);
    formScroll.current?.scrollTo({ y: 0, animated: false });
  }, []);

  useFocusEffect(useCallback(() => {
    const current = sessionId ? getSessionById(sessionId) : ensureOpenSession();
    if (!current) { setSession(null); setError('Sessão não encontrada.'); return; }
    if (activeSession.current !== current.id) {
      clearForm(); setLast(null); setError(''); setMessage(''); setFilter('');
      activeSession.current = current.id;
    }
    setSession(current); setTotal(getPalletTotal(current.id)); setPrinter(preferredPrinter());
    setRevision((n) => n + 1);
    if (view === 'history' || current.status !== 'aberta') setHistory(listPalletCounts(current.id));
    if (current.status !== 'aberta') setView('history');
  }, [clearForm, sessionId, view]));

  const suggestions = useMemo(() => {
    // A nova importação pode atualizar o catálogo mantendo o prefixo digitado.
    if (!revision || item || !query.trim()) return [];
    return suggestMaterials(query);
  }, [query, item, revision]);

  const visible = useMemo(() => {
    const key = filter.trim().toUpperCase();
    return key ? history.filter(e => [e.codigo, e.descricao, e.endereco, e.uc].some(v => v.toUpperCase().includes(key))) : history;
  }, [filter, history]);

  const run = async (fn: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setMessage('');
    try { await fn(); } catch (e) { setError(errorText(e)); }
    finally { lock.current = false; setBusy(false); }
  };
  function selectItem(found: StockItem) {
    setItem(found); setQuery(found.codigo); setError(''); qtyInput.current?.focus();
  }
  function read(field: ScanField, value: string) {
    setScanner(null);
    setError('');
    if (field === 'endereco') { setAddress(value); ucInput.current?.focus(); }
    else { setUC(value); materialInput.current?.focus(); }
  }
  async function print(entry: PalletCount) {
    await printPallet(entry, printer);
    setMessage(printer ? `Etiqueta enviada para ${printer.name}.` : 'Etiqueta preparada para o serviço de impressão.');
  }
  const save = () => run(async () => {
    if (!session) throw new Error('Selecione uma sessão de contagem.');
    const selected = item ?? getItemByCode(query.trim());
    if (!selected) throw new Error('Digite o código e selecione o material cadastrado.');
    const entry = savePalletCount({ sessionId: session.id, codigo: selected.codigo, endereco: address, uc, quantidade: quantity, editingId: editing });
    Keyboard.dismiss(); clearForm(); setLast(entry); setTotal(getPalletTotal(session.id));
    setMessage(`Contagem salva para a UC ${entry.uc}.`);
    if (autoPrint) {
      try { await print(entry); }
      catch (e) { setError(`Contagem salva. Impressão pendente: ${errorText(e)}`); }
    }
  });
  function edit(entry: PalletCount) {
    setView('count'); setEditing(entry.id); setAddress(entry.endereco); setUC(entry.uc);
    setItem(getItemByCode(entry.codigo)); setQuery(entry.codigo); setQuantity(String(entry.quantidade).replace('.', ','));
    setError(''); setMessage(''); setLast(null);
  }
  const exportFile = () => run(async () => {
    if (!session) throw new Error('Selecione uma sessão.');
    const name = await exportPalletXLSX(session);
    if (name) setMessage(`XLSX salvo: ${name}`);
  });
  const importFile = () => run(async () => {
    const result = await importItemsFromXLSX('catalogo');
    if (result) {
      setRevision(n => n + 1); setItem(null);
      setMessage(`Catálogo: ${result.created} novos, ${result.updated} atualizados e ${result.ignored} ignorados.`);
    }
  });

  function field(name: ScanField) {
    const isAddress = name === 'endereco';
    return <View style={s.field}>
      <Text style={s.caption}>{isAddress ? 'Endereço da posição' : 'UC do pallet'}</Text>
      <View style={s.row}>
        <TextInput ref={isAddress ? addressInput : ucInput} testID={'field-' + name}
          style={[s.input, s.grow]} value={isAddress ? address : uc} onChangeText={isAddress ? setAddress : setUC}
          accessibilityLabel={isAddress ? 'Endereço da posição' : 'UC do pallet'} autoCapitalize={isAddress ? 'characters' : 'none'}
          autoCorrect={false} keyboardType={isAddress ? 'default' : 'number-pad'}
          placeholder={isAddress ? 'R.13.11.D' : '10 dígitos'} placeholderTextColor={muted}
          returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => (isAddress ? ucInput : materialInput).current?.focus()} />
        <Pressable accessibilityRole="button" accessibilityLabel={isAddress ? 'Escanear endereço' : 'Escanear UC'} testID={'scan-' + name}
          style={s.scan} onPress={() => { Keyboard.dismiss(); setScanner(name); }}><ScanLine color={accent} size={23} /></Pressable>
      </View>
    </View>;
  }

  return <SafeAreaView style={s.safe}>
    <KeyboardAvoidingView style={s.grow} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.header}>
        <View style={s.row}><View style={s.logo}><Archive size={22} color="#0a1c2b" /></View>
          <View style={s.grow}><Text style={s.title}>Inventário geral</Text>
            <Text style={s.subtitle} numberOfLines={1}>{session?.nome ?? 'Abrindo sessão…'}{session?.status === 'fechada' ? ' · encerrada' : ''}</Text>
          </View>
          <Pressable accessibilityLabel="Catálogo, sessões e impressora" testID="collector-menu" style={s.icon} onPress={() => setToolsOpen(!toolsOpen)}><Settings2 color={accent} /></Pressable>
        </View>
        {toolsOpen && <View style={s.tools}>
          <Pressable style={s.tool} disabled={busy} onPress={importFile}><Upload size={17} color={accent} /><Text style={s.link}>Importar catálogo XLSX</Text></Pressable>
          <Pressable style={s.tool} onPress={() => router.push('/(tabs)/inventory')}><Archive size={17} color={accent} /><Text style={s.link}>Cadastrar material</Text></Pressable>
          <Pressable style={s.tool} onPress={() => router.push('/(tabs)/sessions')}><History size={17} color={accent} /><Text style={s.link}>Sessões</Text></Pressable>
          <Pressable style={s.tool} onPress={() => setPrinterOpen(true)}><PrinterIcon size={17} color={accent} /><Text style={s.link}>{printer?.name ?? 'Configurar impressora'}</Text></Pressable>
        </View>}
        <View style={s.tabs}>
          <Pressable testID="collector-count" disabled={!isOpen} style={[s.tab, view === 'count' && s.tabActive]} onPress={() => setView('count')}><ClipboardList size={17} color={view === 'count' ? accent : muted} /><Text style={s.tabText}>Contar</Text></Pressable>
          <Pressable testID="collector-history" style={[s.tab, view === 'history' && s.tabActive]} onPress={() => setView('history')}><History size={17} color={view === 'history' ? accent : muted} /><Text style={s.tabText}>Histórico ({total})</Text></Pressable>
        </View>
      </View>
      {!!(message || error) && <Text accessibilityLiveRegion="polite" style={[s.notice, error ? s.error : s.success]}>{error || message}</Text>}
      {view === 'count' ? <ScrollView ref={formScroll} keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
        {editing && <View style={s.between}><Text style={s.label}>Corrigir contagem</Text><Pressable onPress={clearForm}><Text style={s.link}>Cancelar edição</Text></Pressable></View>}
        <View style={s.card}>
          <View style={s.section}><MapPin size={18} color={accent} /><Text style={s.label}>Identificação do pallet</Text></View>
          {field('endereco')}{field('uc')}
        </View>
        <View style={s.card}>
          <View style={s.section}><Archive size={18} color={accent} /><Text style={s.label}>Material e quantidade</Text></View>
          <View style={s.field}><Text style={s.caption}>Código do material</Text>
            <TextInput ref={materialInput} testID="collector-material" style={s.input} value={query} placeholder="Digite o início do código" placeholderTextColor={muted}
              autoCapitalize="characters" autoCorrect={false} returnKeyType="next" submitBehavior="submit" accessibilityLabel="Código do material"
              onChangeText={value => { setQuery(value); setItem(null); }} onSubmitEditing={() => {
                const match = getItemByCode(query);
                if (match) selectItem(match); else setError('Selecione o material na lista de sugestões.');
              }} />
            {item ? <Text testID="selected-description" style={s.selected}>{item.descricao}</Text> : suggestions.map(found => <Pressable testID={'suggest-' + found.codigo}
              key={found.id} onPress={() => selectItem(found)} style={s.suggestion}><Text style={s.code}>{found.codigo}</Text><Text style={s.secondary}>{found.descricao}</Text></Pressable>)}
            {!item && query.trim() !== '' && !suggestions.length && <Text style={s.secondary}>Nenhum material encontrado. Confira o código ou importe o catálogo.</Text>}
          </View>
          <View style={s.field}><Text style={s.caption}>Quantidade contada{item?.unidade ? ` (${item.unidade})` : ''}</Text>
            <TextInput ref={qtyInput} testID="collector-quantity" style={[s.input, s.quantity]} value={quantity} onChangeText={setQuantity} placeholder="0" placeholderTextColor={muted} keyboardType="decimal-pad" accessibilityLabel="Quantidade contada" returnKeyType="done" />
          </View>
          <View style={s.between}><Text style={s.caption}>Imprimir etiqueta ao finalizar</Text><Switch accessibilityLabel="Imprimir etiqueta ao finalizar" value={autoPrint} onValueChange={setAutoPrint} /></View>
        </View>
        <Pressable testID="collector-save" accessibilityRole="button" disabled={busy || !isOpen} style={[s.primary, (busy || !isOpen) && s.disabled]} onPress={save}>
          {busy ? <ActivityIndicator color="#0a1b28" /> : <Check color="#0a1b28" size={22} />}<Text style={s.primaryText}>{editing ? 'Salvar correção' : 'Finalizar contagem'}</Text>
        </Pressable>
        {last && <Pressable style={s.outline} disabled={busy} onPress={() => run(() => print(last))}><PrinterIcon size={17} color={accent} /><Text style={s.link}>Imprimir etiqueta · {last.uc}</Text></Pressable>}
        {!total && !last && <Pressable style={s.outline} disabled={busy} onPress={importFile}><Upload size={17} color={accent} /><Text style={s.link}>Importar catálogo de materiais</Text></Pressable>}
      </ScrollView> : <FlatList style={s.grow} keyboardShouldPersistTaps="handled" data={visible} keyExtractor={e => e.id} contentContainerStyle={s.content}
        ListHeaderComponent={<View style={s.field}><Pressable testID="collector-export" disabled={busy || !total} style={[s.primary, !total && s.disabled]} onPress={exportFile}>
          <FileSpreadsheet color="#0a1b28" size={20} /><Text style={s.primaryText}>Salvar contagem em XLSX</Text></Pressable>
          <TextInput style={s.input} testID="collector-filter" accessibilityLabel="Filtrar histórico" value={filter} onChangeText={setFilter} placeholder="Buscar UC, posição ou material" placeholderTextColor={muted} /></View>}
        ListEmptyComponent={<Text style={s.secondary}>{total ? 'Nenhuma contagem corresponde à busca.' : 'As contagens finalizadas aparecem aqui.'}</Text>}
        renderItem={({ item: entry }) => <View style={s.card}>
          <View style={s.between}><Text style={[s.code, s.grow]}>{entry.codigo}</Text><Text style={s.amount}>{format(entry.quantidade)}</Text></View>
          <Text style={s.caption}>{entry.descricao}</Text>
          <Text style={s.secondary}>{entry.endereco}   ·   UC {entry.uc}</Text>
          <View style={s.row}>
            <Pressable style={s.tool} disabled={busy} onPress={() => run(() => print(entry))}><PrinterIcon size={16} color={accent} /><Text style={s.link}>Imprimir</Text></Pressable>
            {isOpen && <Pressable style={s.tool} disabled={busy} onPress={() => edit(entry)}><Pencil size={16} color={accent} /><Text style={s.link}>Corrigir</Text></Pressable>}
          </View>
        </View>} />}
      {scanner && <PalletScanner field={scanner} onClose={() => setScanner(null)} onRead={value => read(scanner, value)} />}
      {printerOpen && <CollectorPrinter current={printer} close={() => setPrinterOpen(false)} choose={device => {
        setPreferredPrinter(device); setPrinter(device); setPrinterOpen(false); setMessage(`Impressora: ${device?.name ?? 'serviço do Android'}.`);
      }} />}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#101722' }, grow: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 10, gap: 13, borderBottomWidth: 1, borderColor: '#304054' },
  logo: { width: 39, height: 39, backgroundColor: '#85caff', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { color: '#f4f7fb', fontSize: 23, fontWeight: '700' }, subtitle: { color: muted, fontSize: 12, marginTop: 2 },
  icon: { minWidth: 46, minHeight: 46, justifyContent: 'center', alignItems: 'center' },
  tools: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tool: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 },
  tabs: { flexDirection: 'row', borderRadius: 10, padding: 3, backgroundColor: '#1b2736' },
  tab: { flex: 1, height: 39, justifyContent: 'center', alignItems: 'center', gap: 8, flexDirection: 'row', borderRadius: 8 },
  tabActive: { backgroundColor: '#30465b' }, tabText: { color: '#edf4fb', fontSize: 14, fontWeight: '600' },
  content: { padding: 14, paddingBottom: 32, gap: 12 }, card: { backgroundColor: '#192432', borderColor: '#304054', borderWidth: 1, borderRadius: 12, padding: 14, gap: 12 },
  section: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  label: { fontSize: 17, fontWeight: '700', color: '#eef3fa' }, field: { gap: 7 },
  caption: { color: '#d4deea', fontSize: 14, fontWeight: '500', flexShrink: 1 },
  input: { minHeight: 47, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#101a27', borderColor: '#52657a', borderRadius: 8, borderWidth: 1, color: '#f4f7fb', fontSize: 16 },
  scan: { borderRadius: 8, width: 48, height: 48, backgroundColor: '#263c52', alignItems: 'center', justifyContent: 'center' },
  suggestion: { minHeight: 48, paddingHorizontal: 10, paddingVertical: 5, justifyContent: 'center', gap: 2, borderBottomWidth: 1, borderColor: '#3c5063' },
  code: { fontFamily: Platform.OS === 'android' ? 'monospace' : undefined, fontWeight: '700', fontSize: 16, color: '#eef4fb' },
  secondary: { color: muted, fontSize: 14 }, selected: { color: '#92dfbe', fontSize: 15 },
  quantity: { fontSize: 22, fontWeight: '600' }, amount: { color: '#92dfbe', fontWeight: '700', fontSize: 19 },
  primary: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: '#85caff', borderRadius: 10 },
  primaryText: { color: '#0b1d2b', fontWeight: '700', fontSize: 16 }, disabled: { opacity: 0.45 },
  outline: { minHeight: 45, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderColor: '#354c63', borderWidth: 1, borderRadius: 9 },
  link: { color: accent, fontWeight: '600', fontSize: 14, flexShrink: 1 },
  notice: { paddingHorizontal: 16, paddingVertical: 9, fontSize: 14 },
  success: { color: '#98e7c7', backgroundColor: '#17352e' }, error: { color: '#ffd4ca', backgroundColor: '#442823' },
});
