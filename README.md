# 📦 EstoqueAudit Pro — Ciclo de Inventário
Aplicação completa de **contagem cíclica e auditoria de estoque** para ambientes industriais e de armazém. Permite contagem de estoque em tempo real, rastreamento de divergências, leitura de código de barras, contagem de blends em kg por máquina e geração de relatórios detalhados, com suporte a operação offline.

---
## 🗂️ Estrutura do Projeto
```text
Ciclo-de-Inventario/
├── backend/            # API REST em FastAPI (Python)
├── frontend/           # App mobile/web em React Native + Expo
│   ├── app/
│   │   ├── (tabs)/
│   │   │   ├── dashboard.tsx
│   │   │   ├── inventory.tsx
│   │   │   ├── sessions.tsx
│   │   │   ├── schedule.tsx
│   │   │   ├── scan.tsx
│   │   │   ├── blends.tsx        # Contagem de blend/dosador em kg por máquina
│   │   │   └── export.tsx
│   │   ├── count.tsx
│   │   └── divergences.tsx
│   ├── src/
│   │   ├── db/
│   │   │   ├── blendDB.ts        # Base de materiais e contagens de blend
│   │   │   └── sessionsDB.ts
│   │   └── services/
│   │       └── blendXlsxService.ts
│   └── package.json
├── tests/
├── design_guidelines.json
└── test_result.md
```

---
## 🚀 Tecnologias
### Frontend
| Tecnologia | Uso |
|---|---|
| React Native + Expo SDK 55 | Framework do app |
| Expo Router | Navegação baseada em arquivos |
| expo-sqlite | Banco de dados local (iOS/Android) |
| react-native-gifted-charts | Gráficos de barras e pizza |
| expo-camera | Scanner e fotos das contagens |
| xlsx | Importação/exportação Excel |
| expo-print + expo-sharing | Exportação e compartilhamento |
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
- Últimas contagens realizadas

### 📋 Estoque
- Lista completa de itens com busca por código ou descrição
- Filtros por status
- Indicadores visuais por item
- Navegação direta para registro de contagem

### 📷 Scanner
- Leitura automática de código de barras
- EAN-13, EAN-8, Code128, Code39, QR, UPC-A, UPC-E e PDF417
- Digitação manual como fallback
- Deduplicação e normalização de leituras

### 📝 Sessões de contagem
- Criação, carregamento e exclusão de sessões
- Persistência do responsável
- Seleção obrigatória de depósito ao iniciar nova sessão:
  - `1020`
  - `1023`

### 🧪 Contagem de Blend / Dosador em kg
Nova aba dedicada para contagem de materiais nas máquinas de processo.

#### Máquinas disponíveis
- **Injetoras:** `01` até `52`
- **Sopradoras:** `92` até `99`
- **Máquina 97:** identificada como **Extrusora 97**

#### Tipos de contagem
**Blend**
- código da blend
- quantidade em kg
- autocomplete conforme base importada

**Dosador**
- 3 componentes obrigatórios
- quantidade em kg para cada componente
- autocomplete conforme base importada
- total em kg calculado para exportação

#### Base de códigos
A base pode ser importada em XLSX. O importador aceita:

| Coluna | Obrigatória | Exemplo |
|---|---|---|
| `codigo` | Sim | `3000001234` |
| `descricao` | Não | `MASTER AZUL` |
| `tipo` | Recomendado | `BLEND` ou `DOSADOR` |

Também é possível usar abas separadas. Abas cujo nome contenha `DOS` são tratadas como materiais de **DOSADOR**; as demais usam **BLEND** como padrão.

#### Fotos
- permite fotografar a contagem diretamente no app
- foto vinculada à máquina, sessão e registro de contagem
- histórico por máquina mostra a foto quando disponível

#### Exportação Excel
As contagens de blend/dosador podem ser exportadas em `.xlsx` com:
- sessão
- depósito
- máquina
- tipo de máquina
- Blend/Dosador
- códigos dos materiais
- peso individual
- peso total
- referência da foto
- responsável
- data/hora

### ⚠️ Divergências
- Resumo de faltas e sobras
- Lista ordenada por magnitude
- Correção da contagem pelo item

### 📤 Exportação
- CSV
- PDF
- XLSX
- exportação específica das contagens de Blend/Dosador

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

> A contagem de Blend/Dosador desta versão usa persistência local do app, seguindo o modelo offline-first do frontend.

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
