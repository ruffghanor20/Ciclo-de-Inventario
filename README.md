# Ciclo de Inventario

Aplicativo mobile/web para contagem ciclica de estoque com leitura de codigo de barras, contagem manual, controle por sessao, programacao por curva ABC e exportacao de relatorios.

O projeto foi construido com Expo + React Native e usa `expo-router` para navegacao. Em Android/iOS os dados ficam em SQLite local; na web o app roda com uma base em memoria para preview.

## Principais recursos

- Dashboard com indicadores da sessao atual, top divergencias e ultimas contagens.
- Cadastro e consulta de itens de estoque com filtros por status da contagem.
- Scanner de codigo de barras com fallback para digitacao manual.
- Registro de contagem por item, inclusive para codigos ainda nao cadastrados.
- Programacao de recontagem com base em data da ultima contagem e curva ABC.
- Gestao de sessoes de inventario: abrir, encerrar, selecionar e exportar.
- Importacao de itens por planilha XLSX.
- Exportacao de relatorios em XLSX, CSV e PDF.

## Stack

- Expo 54
- React Native 0.81
- React 19
- Expo Router
- Expo SQLite
- Expo Camera
- `xlsx` para importacao/exportacao de planilhas

## Estrutura

```text
app/
  (tabs)/
    dashboard.tsx   -> resumo da operacao
    inventory.tsx   -> estoque, busca e cadastro manual
    scan.tsx        -> leitura de codigo de barras
    schedule.tsx    -> programacao de contagem
    export.tsx      -> importacao/exportacao e sessoes
  count.tsx         -> registro de contagem
  divergences.tsx   -> consulta de divergencias
src/
  db/               -> persistencia local e queries
  services/         -> importacao/exportacao
  components/       -> componentes reutilizaveis
  utils/            -> regras de agenda e datas
scripts/
  gerar_layout_importacao.js
```

## Como executar

### Requisitos

- Node.js 18+
- npm ou yarn
- Expo CLI via `npx expo`

### Instalacao

```bash
npm install
```

ou

```bash
yarn install
```

### Desenvolvimento

```bash
npm run start
```

Comandos adicionais:

```bash
npm run android
npm run ios
npm run web
npm run lint
```

## Fluxo operacional

1. Importe a planilha de estoque na aba de exportacao/importacao ou cadastre itens manualmente.
2. O app garante que sempre exista uma sessao aberta para receber as contagens.
3. Use o scanner ou acesse um item pela lista de estoque.
4. Registre a quantidade contada e acompanhe divergencias no dashboard.
5. Exporte os resultados da sessao em XLSX, CSV ou PDF.

## Persistencia de dados

### Android e iOS

- Banco local SQLite: `estoqueaudit.db`
- Tabelas principais:
  - `stock_items`
  - `inventory_sessions`
  - `count_entries`
  - `app_settings`

### Web

- Base em memoria, inicializada em runtime.
- Os dados de preview nao persistem entre reinicios da aplicacao web.

## Importacao de planilha

O app importa a primeira aba do arquivo XLSX e aceita aliases de cabecalho para localizar as colunas. O arquivo de exemplo do projeto esta em:

- `layout_importacao_estoqueaudit.xlsx`

Colunas recomendadas:

```text
codigo
descricao
categoria
unidade
localizacao
saldo_sistema
estoque_minimo
custo_ajuste
contado
curva_abc
proxima_contagem
```

Regras da importacao:

- `codigo` e obrigatorio; linhas sem codigo sao ignoradas.
- Se `descricao` estiver vazia, o app cria uma descricao padrao.
- `curva_abc` aceita `A`, `B` ou `C`.
- `contado` aceita `dd/mm/aaaa`, `yyyy-mm-dd` ou serial de data do Excel.
- Se `proxima_contagem` estiver vazia, o app calcula automaticamente a partir da ultima contagem e da curva ABC.
- Se o item ja existir, ele e atualizado; caso contrario, e criado.

Para regenerar o layout de importacao:

```bash
node scripts/gerar_layout_importacao.js
```

Observacao: esse script contem caminhos absolutos voltados ao ambiente original de desenvolvimento e pode precisar de ajuste antes de ser executado em outra maquina.

## Exportacao

Formatos disponiveis por sessao:

- XLSX
- CSV
- PDF

Os relatorios incluem, entre outros campos:

- codigo
- descricao
- saldo do sistema
- quantidade contada
- diferenca
- custo do ajuste
- localizacao
- observacao
- responsavel
- data/hora do registro

## Permissoes e comportamento por plataforma

- Camera: necessaria para leitura de codigo de barras em dispositivos nativos.
- Web: o scanner funciona em modo manual por padrao.
- Compartilhamento/arquivos: usado para exportar relatorios em plataformas nativas.

## Configuracao

O repositorio possui um arquivo `.env` com configuracoes de desenvolvimento do Expo/Metro. No estado atual do frontend, nao ha consumo relevante de backend dentro de `src/` ou `app/`; o fluxo principal funciona localmente com persistencia no dispositivo.

## Observacoes tecnicas

- O projeto faz seed de dados de demonstracao quando a base local esta vazia.
- A rota inicial redireciona para `/(tabs)/dashboard`.
- A navegacao e baseada em arquivos com `expo-router`.

## Licenca

Defina a licenca do projeto conforme a necessidade do time.
