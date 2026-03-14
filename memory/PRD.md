# EstoqueAudit Pro - PRD

## Problem Statement
Melhorar o app de contagem de estoque com dashboard com gráficos, exportação Excel/PDF, leitura de códigos de barras, busca e filtros avançados, modo offline, e tema escuro profissional.

## Architecture

### Stack
- **Frontend**: Expo React Native (SDK 54) + expo-router (file-based routing)
- **Backend**: FastAPI + MongoDB (motor async)
- **Offline Storage**: expo-sqlite (native) / In-memory WebDb (web)
- **Charts**: react-native-gifted-charts
- **Export**: expo-print (PDF), expo-file-system + expo-sharing (CSV)
- **Scanner**: expo-camera (CameraView + barcode scanner)

### File Structure
```
app/
  backend/
    server.py          # FastAPI REST API + MongoDB
  frontend/
    app/
      _layout.tsx      # Root layout (Stack navigator, DB init)
      index.tsx        # Redirect to dashboard
      count.tsx        # Count item screen (modal)
      divergences.tsx  # Divergences list screen
      (tabs)/
        _layout.tsx    # Tab bar (Dashboard, Estoque, Scanner, Exportar)
        dashboard.tsx  # Dashboard with charts and KPIs
        inventory.tsx  # Stock list with search + filters
        scan.tsx       # Barcode scanner (camera + manual fallback)
        export.tsx     # Export CSV/PDF + session management
    src/
      db/
        database.ts         # Fallback stub
        database.native.ts  # SQLite implementation (iOS/Android)
        database.web.ts     # In-memory WebDb (web preview)
        itemsDB.ts          # Stock items CRUD
        sessionsDB.ts       # Inventory sessions CRUD
        countsDB.ts         # Count entries CRUD
      services/
        exportService.ts    # PDF (expo-print) + CSV (expo-file-system)
      components/
        StatCard.tsx
        ItemRow.tsx
        SearchBar.tsx
        EmptyState.tsx
      theme/
        colors.ts           # Dark theme color constants
```

## Implemented Features

### Dashboard (2026-03-09)
- 4 stat cards: Total itens, Contagens, Divergências, OK
- BarChart: Top 5 divergências (react-native-gifted-charts)
- PieChart/Donut: Distribuição OK/Falta/Sobra
- Lista de últimas 5 contagens
- Ações rápidas (links para Scanner, Estoque, Exportar)

### Estoque/Inventory (2026-03-09)
- FlatList com todos os itens do estoque local
- Barra de busca (código ou descrição)
- Filtros por chips: Todos | Divergência | Não contados | OK
- Indicação visual de status de cada item

### Scanner (2026-03-09)
- Camera barcode scanning (expo-camera CameraView)
- Suporte a: EAN-13, EAN-8, Code128, Code39, QR, UPC-A, UPC-E, PDF417
- Fallback manual para web/sem permissão
- Resultado visual com info do item + botão "Registrar Contagem"
- Vibração ao escanear com sucesso

### Contagem (2026-03-09)
- Busca de item por código
- Input numérico com +/- buttons
- Cálculo em tempo real da diferença (saldo - contado)
- Campo de observação
- Upsert (atualiza se já contado na sessão)

### Exportar (2026-03-09)
- Seletor de sessão
- Estatísticas resumidas da sessão selecionada
- Exportar CSV (utf-8-sig, compatível Excel, com separador ;)
- Exportar PDF (expo-print, relatório formatado, compartilhável)
- Gerenciar sessões (encerrar, nova sessão)

### Divergências (2026-03-09)
- Lista ordenada por magnitude (maior divergência primeiro)
- Indicadores visuais (TrendingDown/Up por falta/sobra)
- Totais de falta e sobra no topo
- Toque no item → tela de contagem para corrigir

### Modo Offline (2026-03-09)
- expo-sqlite (iOS/Android): banco local persistente
- Dados sincronizados por sessão
- app funciona 100% sem internet
- Seed automático de dados demo (12 itens, 1 sessão demo, 5 contagens)

### Backend API (2026-03-09)
- GET/POST/PUT/DELETE /api/items
- GET /api/items/barcode/:codigo
- POST /api/items/bulk (importação em massa)
- GET/POST /api/sessions + PUT /api/sessions/:id/close
- GET /api/sessions/:id/counts + POST /api/counts
- GET /api/dashboard (stats)
- GET /api/export/csv/:session_id
- GET /api/download/project (download ZIP)
- Seed automático de dados demo no startup

## Download do Projeto
**URL de Download**: `https://stock-tracker-pro-15.preview.emergentagent.com/api/download/project`

## Prioritized Backlog

### P0 (Crítico - ainda pendente)
- [ ] Testes end-to-end com testing agent
- [ ] Leitura e importação de planilhas Excel/CSV existentes (expo-document-picker)

### P1 (Alta Prioridade)
- [ ] Alertas de estoque mínimo (badge na tab de dashboard)
- [ ] Modo multi-sessão com comparativo entre sessões
- [ ] Filtro por categoria na tela de estoque
- [ ] Zoom e lanterna no scanner
- [ ] Sincronização bidirecional com backend (push/pull de dados)

### P2 (Média Prioridade)
- [ ] Histórico de contagens por item
- [ ] Gráfico de evolução temporal de divergências
- [ ] Foto do item via câmera
- [ ] Modo de auditoria (comparativo sessão anterior vs atual)
- [ ] Relatório de divergências por categoria

## Next Tasks
1. Testar app com testing agent para garantir todos os fluxos funcionais
2. Implementar importação de planilhas (expo-document-picker + CSV parser)
3. Adicionar alertas de estoque mínimo
4. Adicionar sincronização com backend
