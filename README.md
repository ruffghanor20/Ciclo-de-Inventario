# 📦 EstoqueAudit Pro — Ciclo de Inventário
Aplicação completa de **contagem cíclica e auditoria de estoque** para ambientes industriais e de armazém. Permite contagem de estoque em tempo real, rastreamento de divergências, leitura de código de barras e geração de relatórios detalhados, com suporte a operação offline.
---
## Inventário geral para carga inicial do SAP

No Android, abra **Inventário geral por UC**. O APK dedicado **Inventário Geral** abre direto nessa tela e mantém sua própria base SQLite. O catálogo começa vazio. Importe uma planilha com `Material` e `Descrição` na primeira linha da primeira aba. A coluna `Unidade` é opcional. Use o tipo Texto para códigos com zeros à esquerda. Também é possível cadastrar um material no menu do coletor.

1. Leia o QR da posição, por exemplo `R.13.11.D`. Aplique a etiqueta de UC inicial no pallet e leia seus dez dígitos. Os dois campos permitem digitação e leitores que funcionam como teclado.
2. Digite o início do código, toque no material e confira a descrição e a unidade. Informe a quantidade, por exemplo `12,5`, e toque em **Finalizar contagem**.
3. Para imprimir em cada finalização, ative **Imprimir etiqueta ao finalizar**. Em **Configurar impressora**, use o serviço de impressão cadastrado no Android ou selecione a Zebra já pareada por Bluetooth clássico. Na ZQ510 de 203 dpi, monte a bobina com 60 mm de largura e 90 mm no sentido do avanço. Pelo serviço de impressão, selecione essa mídia e tamanho real. A conexão Bluetooth direta envia uma etiqueta ZPL de 480 × 720 pontos.
4. Em **Histórico**, filtre por UC, posição ou material, corrija uma contagem da sessão aberta ou reimprima a etiqueta. A impressão usa o registro salvo. Cancelar a impressão ou reimprimir conserva a quantidade.
5. Toque em **Salvar contagem em XLSX** e escolha uma pasta. O arquivo contém uma linha por material e UC, com as colunas `Material`, `Descrição`, `Quantidade`, `Endereço` e `UC`. Na aba **Exportar** do app-base, selecione a sessão e abra **Inventário geral · XLSX por UC** para consultar também sessões encerradas.

Cada coletor mantém sua própria sessão. Um material pode ocupar várias UCs, e materiais diferentes podem compartilhar uma UC na mesma posição. O coletor impede a duplicação do par material/UC e a atribuição da mesma UC a posições distintas dentro da sessão local. O QR da etiqueta de contagem guarda os cinco campos em JSON UTF-8. A UC é texto do início ao fim. Para trabalhar com vários coletores offline, distribua as posições entre os operadores e confira a unicidade das UCs ao consolidar os arquivos. A correspondência com o programa de carga SAP depende do leiaute usado pela implantação.

### Compilar o APK no Windows

Use Node 22.13 ou superior, Yarn 1.22, JDK 17, Android SDK e Build Tools 35 e 36, NDK 27.1.12297006 e CMake 3.22.1. Execute os comandos no PowerShell dentro de `frontend`.

```powershell
$env:COLETOR_APK = "1"
$env:NODE_ENV = "production"
corepack yarn install --frozen-lockfile --production=false
node --test tests/pallets.test.cjs
npx expo prebuild --platform android --no-install
Set-Location android
.\gradlew.bat :app:assembleRelease :inventory-label:testReleaseUnitTest "-PreactNativeArchitectures=arm64-v8a,armeabi-v7a"
```

APK em `frontend/android/app/build/outputs/apk/release/app-release.apk`. O pacote dedicado é `com.ruffghanor20.inventariogeral`. O modelo local de compilação Expo assina o APK de piloto com chave de testes. Para distribuir atualizações de produção, configure e conserve a chave de assinatura da empresa. A aplicação de contagem cíclica continua usando `com.ruffghanor20.estoqueaudit`.

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
