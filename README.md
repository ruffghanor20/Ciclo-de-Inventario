# 📦 EstoqueAudit Pro — Ciclo de Inventário
Aplicação completa de **contagem cíclica e auditoria de estoque** para ambientes industriais e de armazém. Permite contagem de estoque em tempo real, rastreamento de divergências, leitura de código de barras e geração de relatórios detalhados, com suporte a operação offline.
---
## 🗂️ Estrutura do Projeto
```
Ciclo-de-Inventario/
├── backend/            # API REST em FastAPI (Python)
│   ├── server.py
│   ├── requirements.txt
│   └── .env
├── frontend/           # App mobile/web em React Native + Expo
│   ├── app/
│   │   ├── (tabs)/
│   │   │   ├── dashboard.tsx     # Painel principal com estatísticas e gráficos
│   │   │   ├── inventory.tsx     # Lista de itens do estoque com filtros
│   │   │   ├── scan.tsx          # Leitor de código de barras
│   │   │   └── export.tsx        # Exportação e gerenciamento de sessões
│   │   ├── count.tsx             # Modal de registro de contagem
│   │   ├── divergences.tsx       # Lista de divergências
│   │   └── _layout.tsx
│   ├── assets/
│   ├── package.json
│   └── .env
├── memory/
│   └── PRD.md          # Documento de Requisitos do Produto
├── tests/
│   └── __init__.py
├── design_guidelines.json
└── test_result.md
```
---
## 🚀 Tecnologias
### Frontend
| Tecnologia | Uso |
|---|---|
| React Native + Expo SDK 54 | Framework do app |
| Expo Router | Navegação baseada em arquivos |
| expo-sqlite | Banco de dados local (iOS/Android) |
| react-native-gifted-charts | Gráficos de barras e pizza |
| expo-camera | Leitura de código de barras |
| expo-print + expo-sharing | Exportação PDF e CSV |
| lucide-react-native | Ícones |
| TypeScript | Tipagem estática |
### Backend
| Tecnologia | Uso |
|---|---|
| FastAPI 0.110.1 | Framework da API REST |
| Uvicorn | Servidor ASGI |
| MongoDB + Motor | Banco de dados assíncrono |
| Pydantic | Validação de dados |
| JWT + bcrypt + passlib | Autenticação |
| Python 3.x | Linguagem |
---

## 📱 Funcionalidades
### 🏠 Dashboard
- Cards de resumo: total de itens, contagens realizadas, divergências e itens OK
- Gráfico de barras com top 5 divergências
- Gráfico de pizza (OK / Falta / Sobra)
- Últimas 5 contagens realizadas
- Atalhos para Scanner, Estoque e Exportação
### 📋 Estoque (Inventory)
- Lista completa de itens com busca por código ou descrição
- Filtros: Todos | Divergência | Não contados | OK
- Indicadores visuais de status por item
- Navegação direta para registro de contagem
### 📷 Scanner
- Leitura de câmera com detecção automática de código de barras
- Formatos suportados: EAN-13, EAN-8, Code128, Code39, QR, UPC-A, UPC-E, PDF417
- Fallback por digitação manual (web / sem permissão de câmera)
- Feedback tátil (vibração) ao escanear com sucesso
### 📝 Registro de Contagem
- Busca de item por código de barras
- Entrada de quantidade com botões `+` / `−`
- Cálculo automático de diferença em tempo real
- Indicador de divergência (vermelho = falta, verde = sobra)
- Campo de observações opcional
### ⚠️ Divergências
- Resumo de faltas e sobras com totais
- Lista ordenada por magnitude
- Ícones visuais: ↓ falta / ↑ sobra
- Toque no item para corrigir a contagem
### 📤 Exportação
- Seletor de sessão de inventário
- Exportação CSV (UTF-8, delimitador `;`, compatível com Excel)
- Exportação PDF com relatório formatado
- Gerenciamento de sessões (encerrar / criar nova)
---
## 🌐 API — Principais Endpoints
**Base URL:** configurado via `EXPO_PUBLIC_BACKEND_URL`
| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/items` | Listar itens do estoque |
| `GET` | `/api/items/barcode/{codigo}` | Buscar item por código de barras |
| `POST` | `/api/items` | Criar item |
| `PUT` | `/api/items/{item_id}` | Atualizar item |
| `POST` | `/api/items/bulk` | Importação em lote |
| `GET` | `/api/sessions` | Listar sessões |
| `POST` | `/api/sessions` | Criar sessão |
| `PUT` | `/api/sessions/{session_id}/close` | Encerrar sessão |
| `GET` | `/api/sessions/{session_id}/counts` | Contagens da sessão |
| `POST` | `/api/counts` | Registrar contagem |
| `PUT` | `/api/counts/{count_id}` | Atualizar contagem |
| `GET` | `/api/dashboard` | Estatísticas do painel |
| `GET` | `/api/export/csv/{session_id}` | Exportar CSV da sessão |
---
## 🎨 Design System
**Tema:** Dark Professional (Tactical Minimalism)
| Token | Valor | Uso |
|---|---|---|
| Background primário | `#09090B` | Fundo principal |
| Background secundário | `#18181B` | Cards e containers |
| Texto primário | `#FAFAFA` | Títulos e texto principal |
| Texto secundário | `#A1A1AA` | Labels e subtítulos |
| Azul (primary) | `#3B82F6` | Botões e destaques |
| Âmbar (accent) | `#F59E0B` | Alertas e destaques |
| Verde (success) | `#10B981` | Status OK / sobra |
| Vermelho (error) | `#EF4444` | Divergências / falta |
---
## 🧪 Testes
```bash
cd tests
pytest
```
O progresso e protocolo de testes está documentado em [`test_result.md`](./test_result.md).
---
## 📄 Licença
Este projeto é de uso interno. Consulte o mantenedor para informações sobre licenciamento.
