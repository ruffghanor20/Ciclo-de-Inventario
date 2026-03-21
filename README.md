# 📦 EstoqueAudit Pro — Ciclo de Inventário

Aplicação de **contagem cíclica e auditoria de estoque** para operação local/offline, com frontend em Expo/React Native e backend em FastAPI + MongoDB.

---

## 🗂️ Estrutura do Projeto

```text
ciclo de inventario/
├── backend/               # API FastAPI + MongoDB
│   ├── server.py
│   ├── requirements.txt
│   └── .env
├── docs/                  # specs e planos de implementação
├── frontend/              # App Expo (mobile + web)
│   ├── android/
│   ├── app/
│   │   ├── (tabs)/
│   │   │   ├── dashboard.tsx
│   │   │   ├── inventory.tsx
│   │   │   ├── sessions.tsx
│   │   │   ├── schedule.tsx
│   │   │   ├── scan.tsx
│   │   │   ├── settings.tsx
│   │   │   └── export.tsx
│   │   ├── count.tsx
│   │   ├── divergences.tsx
│   │   └── _layout.tsx
│   ├── src/
│   │   ├── components/
│   │   ├── db/
│   │   ├── services/
│   │   └── utils/
│   ├── assets/
│   ├── package.json
│   ├── yarn.lock
│   └── app.json
├── memory/
│   └── PRD.md
├── tests/
├── agent.md
├── COMO_INSTALAR_O_PROJETO.txt
└── start-project.sh
```

---

## 🚀 Stack

### Frontend

| Tecnologia | Versão / Uso |
|---|---|
| Expo SDK | 55 |
| React Native | 0.83 |
| Expo Router | Navegação baseada em arquivos |
| expo-sqlite | Banco de dados local offline |
| expo-camera | Leitura de código de barras |
| react-native-gifted-charts | Gráficos |
| expo-print | Exportação PDF |
| expo-sharing | Compartilhamento de arquivos |
| xlsx | Exportação XLSX |
| @infinitered/react-native-mlkit-text-recognition | OCR via ML Kit |

### Backend

| Tecnologia | Uso |
|---|---|
| FastAPI | Framework da API REST |
| Motor / MongoDB | Banco de dados assíncrono |
| Pydantic | Validação de dados |
| Python 3 | Linguagem |

---

## 📱 Funcionalidades

### 🏠 Dashboard

- Cards com total de itens, contagens, divergências e itens OK
- Card de alerta para estoque mínimo
- Gráfico com top divergências
- Distribuição por status de contagem
- Lista de últimas contagens
- Atalhos para scanner, estoque e exportação
- Badge global de estoque mínimo no topo e no item `Dashboard` do menu

### 📋 Estoque

- Busca por código ou descrição
- Botão `Filtros` com:
  - Curva: `Todas`, `A`, `B`, `C`
  - Classificação: `Todos`, `Divergência`, `Não contados`, `OK`
  - Alerta adicional: `Estoque mínimo`
- Resumo visual dos filtros ativos
- Cadastro manual de item
- Acesso direto para tela de contagem

### 📷 Scanner

- Modo `Código` para leitura de código de barras
- Modo `Texto` com OCR via ML Kit
- Entrada manual para código ou texto
- Parser OCR refinado para:
  - priorizar campos `SKU`, `COD`, `CODIGO`, `ITEM`, `REF`
  - extrair melhor o código da etiqueta
  - sugerir a maior linha textual válida como descrição
  - aplicar fallback quando a etiqueta não vier no formato esperado
- Se o item **não existir**:
  - cadastro rápido do item direto na tela
  - formulário rolável para telas pequenas
  - campos: nome, categoria, unidade, localização, saldo, mínimo, custo de ajuste, quantidade contada e observação
  - criação do item + registro imediato da contagem
- Se o item **existir**:
  - encaminhamento para tela de contagem

> **Observação:** OCR depende de build nativo/dev build; não é fluxo completo de Expo Go.

### 📝 Contagem

- Registro e atualização de contagem por item
- Cálculo automático de diferença
- Observação opcional
- Atualização de programação futura por curva ABC

### ⚠️ Divergências

- Lista ordenada por magnitude
- Resumo de falta e sobra
- Acesso rápido para correção da contagem

### 📤 Exportação

- Exportação CSV
- Exportação XLSX
- Exportação PDF (coluna `Custo Ajuste` fecha com total geral na última linha)
- Gestão de sessões de inventário

### 🗓️ Sessões e Programação

- Criação, carregamento e exclusão de sessões
- Programação de contagem por curva ABC
- Itens atrasados, do dia e próximos

### ⚙️ Configurações e Sincronização

- Tela `Configurações` no menu superior
- Campo para informar IP/URL do servidor
- Texto de apoio para uso em rede local
- Botão `Sincronizar dados`
- Persistência local do endereço do servidor
- Sincronização manual `push + pull` entre app local e backend
- Status da última sincronização
- Operação offline contínua funcionando mesmo sem servidor

---

## ▶️ Execução Local

### Backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# Linux / macOS
source .venv/bin/activate

pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend

```bash
cd frontend
yarn install
yarn start
```

---

## 🛠️ Scripts Úteis

No diretório `frontend`:

| Comando | Descrição |
|---|---|
| `yarn start` | Inicia o servidor de desenvolvimento Expo |
| `yarn android` | Executa no Android |
| `yarn ios` | Executa no iOS |
| `yarn web` | Executa no navegador |
| `yarn lint` | Linting do projeto |
| `.\node_modules\.bin\tsc.cmd --noEmit` | Checagem de tipos TypeScript |

---

## 📦 Observações de Dependência

- O projeto frontend está padronizado em **yarn**
- O lockfile oficial do frontend é `frontend/yarn.lock`
- `node_modules`, `.expo`, logs e arquivos locais/sensíveis **não devem** ser enviados ao repositório

---

## 🔍 OCR / Leitura de Texto

Suporte preparado com ML Kit:

| Item | Detalhes |
|---|---|
| Pacote | `@infinitered/react-native-mlkit-text-recognition` |
| Serviço | `frontend/src/services/textRecognitionService.ts` |
| Parser OCR | `frontend/src/utils/ocrLabelParser.ts` |

Para funcionar em dispositivo:

1. Instalar dependências
2. Gerar prebuild/dev build nativo
3. Rodar no Android/iOS com app nativo compilado

---

## 🔄 Sincronização com Servidor

Fluxo atual:

1. Informar o endereço do servidor em `Configurações`
2. Tocar em `Sincronizar dados`
3. App envia dados locais para a API
4. App baixa itens, sessões e contagens do servidor
5. App atualiza o banco local

**Observações:**

- Se o usuário informar apenas IP, o app completa a URL com `http://<ip>:8001` — destinado exclusivamente para uso em **rede local de desenvolvimento**; em produção, prefira HTTPS
- No Android, o projeto está configurado com `usesCleartextTraffic=true` para permitir HTTP em rede local

---

## 🌐 Endpoints Principais da API

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/` | Health check |
| `GET` | `/api/items` | Listar itens |
| `GET` | `/api/items/barcode/{codigo}` | Buscar item por código |
| `POST` | `/api/items` | Criar item |
| `PUT` | `/api/items/{item_id}` | Atualizar item |
| `POST` | `/api/items/bulk` | Importação em lote |
| `GET` | `/api/sessions` | Listar sessões |
| `POST` | `/api/sessions` | Criar sessão |
| `POST` | `/api/sessions/bulk` | Importar sessões em lote |
| `PUT` | `/api/sessions/{session_id}/close` | Encerrar sessão |
| `GET` | `/api/counts` | Listar contagens |
| `GET` | `/api/sessions/{session_id}/counts` | Contagens da sessão |
| `POST` | `/api/counts` | Registrar contagem |
| `POST` | `/api/counts/bulk` | Importar contagens em lote |
| `PUT` | `/api/counts/{count_id}` | Atualizar contagem |
| `GET` | `/api/dashboard` | Estatísticas do painel |
| `GET` | `/api/export/csv/{session_id}` | Exportar CSV da sessão |

---

## 🧪 Validação Recente

**Frontend:**

```bash
yarn lint
.\node_modules\.bin\tsc.cmd --noEmit
```

**Backend:**

```bash
python -m py_compile backend/server.py
```

**Status atual:**

- ✅ Checklist funcional principal validado no dev build
- ✅ Scanner e filtros validados
- ✅ Importação validada
- ✅ Cadastro rápido de item desconhecido validado
- ✅ OCR validado com parser atualizado
- ✅ Alertas de estoque mínimo validados
- ✅ Sincronização manual com servidor validada

---

## 📄 Licença

Este projeto é de uso interno. Consulte o mantenedor para informações sobre licenciamento.
