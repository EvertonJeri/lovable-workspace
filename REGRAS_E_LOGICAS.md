# 📋 REGRAS E LÓGICAS — Dashboard "Desempenho Oficial"

> **Propósito:** Documentação completa de todas as lógicas, regras de negócio, mapeamento de colunas, cálculos e comportamentos do dashboard executivo baseado no board "Desempenho Oficial". Use este documento como referência canônica para replicar ou integrar qualquer outro módulo com este dashboard.

---

## 1. ESTRUTURA DO BANCO DE DADOS (Supabase)

```
boards           → Quadros (cada "Desempenho Oficial" é um board)
board_columns    → Colunas do quadro (título, tipo, unidade, fórmula)
task_groups      → Grupos de tarefas (cada projeto/contrato = um grupo)
tasks            → Tarefas (linhas dentro de cada grupo)
task_values      → Valores EAV (task_id, column_id → valor JSONB)
monthly_goals    → Metas mensais (month_idx 0-11, year, value, include_saturdays)
team_members     → Membros da equipe
```

### Como o board é carregado (`fetchBoards` em `src/lib/supabase.ts`)

```
boards
  └─ board_columns (ordenado por position)
  └─ task_groups (ordenado por position)
       └─ tasks (ordenado por position)
            └─ task_values → { column_id: value } (montado em columnValues)
```

Os valores das colunas ficam em `task.columnValues[column_id]`.

---

## 2. ESTRUTURA DOS GRUPOS (HIERARQUIA DE DADOS)

### Grupos Normais (Projetos Ativos)
- Cada grupo **= um projeto/contrato**.
- Cada tarefa dentro do grupo **= uma linha de produção** (subitem/setor).

### Grupo Histórico
- Identificado pelo título que contem `'historico'` (normalizado, sem acentos).
- **Linhas Pai:** representam um mês fechado (ex: `"Março / 2026"` ou `"março 2026"`).
- **Sub-linhas:** criadas automaticamente dentro do grupo histórico:
  - `"Produção - março/2026"` → valores semanais da Fábrica
  - `"Montagem - março/2026"` → valores semanais da Montagem

```
Grupo: Histórico de Desempenho  (isHistoryGroup = true)
  ├─ "Março / 2026"               (linha pai — isHistorySubrow = false)
  ├─ "Produção - março/2026"      (sub-linha — isHistorySubrow = true, isMontagem = false)
  └─ "Montagem - março/2026"      (sub-linha — isHistorySubrow = true, isMontagem = true)
```

---

## 3. MAPEAMENTO DE COLUNAS CRÍTICAS

O dashboard usa `findColId()` e `val()` para encontrar colunas por nome normalizado.
Abaixo estão os aliases reconhecidos para cada campo:

| Campo Interno       | Aliases Aceitos nas Colunas do Board |
|---------------------|--------------------------------------|
| `dataEntrega`       | `entrega`, `data de entrega`, `prazo`, `DATA DE ENTREGA`, `delivery`, `Data Entrega` |
| `status`            | `status`, `STATUS` |
| `orado`             | `orcado`, `budget`, `orçamento`, `orcamento`, `valor`, `valor orçado`, `valor orcado`, `Valor Orçado` |
| `percentual`        | `conclusao`, `%`, `progress`, `progresso`, `Percentual` |
| `semana01`          | `sem01`, `s1`, `semana01`, `semana 01`, `Semana 01` |
| `semana02`          | `sem02`, `s2`, `semana02`, `semana 02`, `Semana 02` |
| `semana03`          | `sem03`, `s3`, `semana03`, `semana 03`, `Semana 03` |
| `semana04`          | `sem04`, `s4`, `semana04`, `semana 04`, `Semana 04` |
| `semana05`          | `sem05`, `s5`, `semana05`, `semana 05`, `Semana 05` |
| `subitemName`       | `setor`, `subitem`, `subitem name`, `responsável`, `assignee`, `Setor` |
| `mes_fechado`       | `mês anterior`, `Mês anterior`, `Mês Formula`, `formula`, `mesanterior`, `mesformula` |
| `fabricaTotal`      | `fabricaTotal` |
| `montagemTotal`     | `montagemTotal` |

> **Regra de busca:** Primeiro tenta acessar `task.columnValues[key]` diretamente. Se não encontrar, normaliza o título da coluna e compara com os aliases.

---

## 4. FUNÇÃO `parseNum` — ENGINE DE PARSING NUMÉRICO

Usada em todo o dashboard para converter qualquer valor em número confiável.

```
Entrada: qualquer valor (string, number, null, undefined)
Saída: number (nunca NaN)
```

**Passos:**
1. Se `null/undefined` → retorna `0`
2. Se já é `number` → retorna direto
3. Remove `R$`, espaços e `%`
4. Detecta sufixos `M` (milhão) ou `K` (mil)
5. **Parsing inteligente de separadores:**
   - Se tem vírgula E ponto → assume BR: `1.234,56` → remove pontos, troca vírgula por ponto
   - Se só tem vírgula → decimal: `1234,56` → troca vírgula por ponto
   - Se só tem ponto:
     - Se parte após o ponto tem 3 dígitos e sem sufixo M/K → separador de milhar (remove)
     - Caso contrário → decimal normal
6. Aplica `parseFloat`
7. Multiplica por 1.000.000 se tinha `M`, por 1.000 se tinha `K`

---

## 5. REGRAS DE CLASSIFICAÇÃO: PRODUÇÃO vs. MONTAGEM

| Contexto | Regra |
|----------|-------|
| **Grupos Ativos** | Se o grupo tem **apenas 1 tarefa** → é Montagem. Se tem **2+ tarefas** → é Produção (Fábrica) |
| **Grupo Histórico (linha pai)** | Classificado pelo nome: começa com `montagem` → Montagem |
| **Grupo Histórico (sub-linha)** | `isHistorySubrow = true` + nome começa com `montagem` → Montagem; nome começa com `producao` → Fábrica |

```typescript
const isMontagem = !isHistoryGroup 
  ? (groupTaskCount[g.id] === 1)          // Grupos ativos: 1 tarefa = montagem
  : tNameNorm.startsWith('montagem');      // Histórico: lê do nome
```

---

## 6. FILTROS DE ITENS — `workItems` (O que o Dashboard enxerga)

A lista `workItems` (usada por todos os cálculos) filtra `allItems` pelas seguintes regras:

### Itens do Grupo Histórico:
- Se mês selecionado = `'all'` → inclui tudo
- Se mês específico → inclui apenas se `dataEntrega` bate com o mês selecionado E o ano corrente

### Itens de Grupos Normais (Ativos):
1. **Deve ter nome ou setor** (não vazio)
2. **Filtro de Setor** (se `selectedSector !== 'all'`): `subitemName` deve bater com o setor selecionado (normalizado)
3. **Filtro de Data:**
   - `'all'` → data de entrega deve ser >= início do mês corrente
   - Mês específico → data de entrega deve estar no mês/ano selecionado
4. **Regra de Adiantamento:** Item com data futura entra no mês corrente SE:
   - Tem progresso semanal (semanas > 0), OU
   - Tem percentual > 0, OU
   - Tem status diferente de `"nao iniciado"` / `"pendente"` / vazio

---

## 7. CÁLCULOS DOS KPI CARDS

### 7.1 Projetos (`uniqueProjects`)
Conta grupos únicos (`groupId`) nos `metaMonthItems` (itens do mês com orçamento > 0, excluindo histórico).

### 7.2 Conclusão Geral (`conclusaoGeral`)
```
conclusaoGeral = (totalProducedInScope / totalBudgetInScope) * 100
```
Para cada item com `orado > 0`:
- Se concluído (`done`/`feito`/`pago`/`concluido`) e sem semanas preenchidas → `producedValue = orado`
- Caso contrário → `producedValue = (somaSemanas% × orado) / 100`

### 7.3 Produção Real (`breakdownTotals.displayProduction`)
Soma de todos `valor` por semana (`valueByWeek`) calculado abaixo (seção 8).

### 7.4 Saldo a Produzir (`breakdownTotals.saldoProduzir`)
```
saldoProduzir = max(0, valorProjetadoMes - displayTotalFilteredValue)
```

### 7.5 Orçado (`valorProjetadoMes`)
Soma de `orado` de todos os itens ativos com data de entrega estritamente no mês selecionado.

### 7.6 Fechado (Mês Anterior) (`valueMesAnterior`)
1. **Prioridade 1:** Busca linha pai no grupo Histórico cujo **nome** contém o mês anterior (ex: `"março"`)
   → usa `item.mes_fechado || item.orado`
2. **Fallback:** Se não encontrou, busca por `dataEntrega.month === prevMonthIdx` no histórico

### 7.7 MoM (Month-over-Month)
```
MoM = ((displayProduction - valueMesAnterior) / valueMesAnterior) × 100
// Se valueMesAnterior = 0 → exibe 100%
```

### 7.8 Atingimento
```
Atingimento = (displayProduction / monthlyGoal) × 100
```

---

## 8. CÁLCULO DE PRODUÇÃO POR SEMANA (`totalValueByWeek`)

Para cada item em `dashboardItems`:

### Itens do Histórico:
- **Evita duplicidade:** Se o mês já tem sub-linhas, ignora a linha pai
- Se tem valores semanais preenchidos → usa diretamente como valores absolutos (R$)
- Se não tem semanas mas tem `orado` → distribui uniformemente pelas semanas:
  - Jan/Fev/Mar de 2026 → força 4 semanas
  - Outros → usa `getWeeksInMonth()`

### Itens Ativos — Concluídos:
- Se tem semanas preenchidas → `valor_semana = (semanaX% × orado) / 100`
- Se não tem semanas → lança o valor restante (`orado - produção_acumulada_mes_anterior`) na última semana com valor ou fallback em `semana01`
- Isso evita que o dashboard infle o valor do mês atual com o que já foi faturado anteriormente.

### Itens Ativos — Em Progresso:
- `valor_semana = (semanaX% × orado) / 100`

### Limite de Semanas:
- Jan/Fev/Mar 2026 → máximo 4 semanas exibidas no gráfico
- Outros meses → máximo 5 semanas

---

## 9. CÁLCULO DA META SEMANAL (`metas`)

```
meta_semanaX = (monthlyGoal × diasUteisNaSemanaX) / totalDiasUteisNoMes
```

**Dias úteis calculados dinamicamente** baseado no calendário real do mês:
- Por padrão: exclui sábados e domingos (`includeSaturdays = false`)
- Se `includeSaturdays = true`: conta sábados, exclui apenas domingos
- As semanas são alinhadas por domingo (mudança de semana = domingo)

---

## 10. HISTÓRICO DE PRODUÇÃO MENSAL (`historicalData`)

Alimenta o gráfico "Histórico de Produção Mensal":
- Para cada mês (0–11) verifica se existe linha no Grupo Histórico
- **Anti-duplicidade:** Se mês tem sub-linhas → usa sub-linhas; se não tem → usa linha pai
- Valor usado: `weeklySumValue || item.orado` (soma das semanas ou orçado como fallback)
- `fabricaTotal` e `montagemTotal` lidos das colunas salvas no fechamento automático
- Meta lida de `yearlyGoals[monthIdx]`

---

## 11. STATUS DOS PROJETOS (`groupSummaries`)

Para cada grupo ativo no mês selecionado:
```
totalProduced = histSum + producedSum
avgPercent = (totalProduced / oradoSum) × 100
```

Onde:
- `histSum` = produção acumulada vinda do Grupo Histórico (pai, pelo nome do grupo normalizado)
- `producedSum` = `prevMonthProduced + currentWeeksProduced`
  - `prevMonthProduced = (mes_fechado% × orado) / 100` (para itens ativos)
  - `currentWeeksProduced = (somaSemanas% × orado) / 100`
- `pendentes` = itens com percentual de conclusão < 99%

---

## 12. CONCLUSÃO POR SETOR (`sectorSummaries`)

Agrupa `metaMonthItems` por `subitemName` (campo "Setor"):
```
avgPercent = (produced / budget) × 100
produced = semanas% × orado / 100  (ou orado se concluído sem semanas)
```

---

## 13. FECHAMENTO DE MÊS — `closeMonthToHistory`

Disparado pelo botão "Fechar Mês" (fecha o mês anterior automaticamente).

**Passos:**
1. Identifica o Grupo Histórico (título contém `'historico'`)
2. Verifica se já existe linha para o mês (por `dataEntrega`) → bloqueia se já `Concluído`
3. Calcula totais por semana para Fábrica e Montagem com base nos itens ativos do mês
4. Cria/Atualiza linha pai no histórico:
   - Nome: `"março 2026"` (formato `MMMM yyyy`)
   - `dataEntrega` = último dia do mês
   - Valores semanais (semana01..05): soma Fábrica + Montagem
   - `fabricaTotal` e `montagemTotal` salvos
   - Status = `Concluído`
5. Cria/Atualiza sub-linhas:
   - `"Produção - março/2026"` → semanas de Fábrica
   - `"Montagem - março/2026"` → semanas de Montagem

**Lógica de produção por semana (fechamento):**
- Item **Concluído** com semanas preenchidas → `semanaX_valor = (semanaX% × orado) / 100`
- Item **Concluído** sem semanas → Lança o valor restante (`orado - produção_acumulada_mes_anterior`) na última semana com valor (fallback: `semana01`)
- Item **Em progresso** → `semanaX_valor = (semanaX% × orado) / 100`

---

## 14. ORDENAÇÃO DA TABELA (TableView)

### Grupos Normais:
- Mantém ordem original de `position` do banco de dados
- Grupo Histórico sempre aparece **primeiro** (`isHistoryGroup → sort -1`)

### Grupo Histórico — Ordenação das linhas:
```
Chave de ordenação: YYYYMM (ex: 202603 para março/2026)
Obtida de: dataEntrega (campo data) ou do nome da tarefa
```

Desempate para mesma data:
1. Linha Pai → primeiro
2. Sub-linha Produção → segundo
3. Sub-linha Montagem → terceiro

**Função `parseMonthCode`:**
- Tenta parse da `dataEntrega`:
  - Formato `dd/mm/yyyy` → parsing manual
  - Formato ISO → `parseISO`
- Fallback: extrai mês do nome da tarefa (ex: `"abril"` → índice 3)
- Se nada funcionar → 999999 (joga para o fim)

---

## 15. EXPORTAÇÃO CSV — `handleExportCSV` (BoardHeader)

### Headers (15 colunas, separador `;`, UTF-8 com BOM):
```
Grupo | Tarefa | % Peso | Orçamento Líquido | Semana 01 (%) | Semana 02 (%) | Semana 03 (%) | Semana 04 (%) | Semana 05 (%) | Mês Anterior (%) | Status | Mês Fórmula | Data de Entrega | Mês | Ano
```

### Mapeamento de dados:
| CSV           | Fonte no board |
|---------------|----------------|
| Grupo         | `group.title` |
| Tarefa        | `task.name` |
| % Peso        | `percentual / progresso / % / peso` |
| Orçamento Líquido | `orado / orcado / budget / liquido` |
| Semana 01-05  | `semana 01..05 / s01..05 / sem 01..05 / semana 1..5` |
| Mês Anterior (%) | `mês anterior / mes anterior / ant. (%)` |
| Status        | status normalizado (ver tabela abaixo) |
| Mês Fórmula   | `mês formula / formula` (fallback: Mês Anterior) |
| Data de Entrega | `entrega / data de entrega / prazo` (formato `yyyy-MM-dd`) |
| Mês           | mês numérico da data de entrega (1-12) |
| Ano           | ano da data de entrega |

### Normalização de Status no CSV:
| Valor no Board | Valor no CSV |
|----------------|--------------|
| `done`, `concluido`, `concluído` | `Concluído` |
| `working`, `em andamento` | `Em andamento` |
| `stuck`, `travado` | `Travado` |
| `nao iniciado`, `não iniciado`, `pendente`, vazio | `Pendente` |
| Outros | Traduzido por `STATUS_LABELS` ou mantido como está |

### Ordenação no CSV:
1. Grupos: Histórico primeiro
2. Tarefas dentro de cada grupo: por data de entrega crescente
3. Desempate: Pai → Produção → Montagem

### Formatação dos números:
- `número.toFixed(2).replace('.', ',')` → ex: `1234,56`
- Remove `;` dos strings (substitui por `,`)

---

## 16. METAS MENSAIS (`monthly_goals`)

- Carregadas do Supabase via `fetchMonthlyGoals(year)`
- Fallback para `localStorage` key `'executive_monthly_goals_v2'`
- Estrutura: `{ month_idx: 0-11, year: 2026, value: 300000, include_saturdays: false }`
- Atualização via `updateMonthlyGoals()` com upsert em `(month_idx, year)`

---

## 17. FILTROS DO DASHBOARD

| Filtro | Valores | Efeito |
|--------|---------|--------|
| Mês | `'all'` ou `'0'`..`'11'` | Filtra `workItems` por mês da `dataEntrega` |
| Semana | `'all'` ou `'semana01'`..`'semana05'` | Filtra gráfico semanal; afeta `activePercentual` |
| Setor | `'all'` ou nome do setor | Filtra `workItems` por `subitemName` normalizado |
| Projeto | `'all'` ou ID do grupo | Filtra `dashboardItems` (cálculos principais) |

---

## 18. TIPOS DE DADOS (TypeScript)

```typescript
interface Board {
  id: string;
  title: string;
  workspaceId: string;
  columns: BoardColumn[];
  groups: TaskGroup[];
}

interface BoardColumn {
  id: string;
  type: 'status'|'text'|'number'|'person'|'date'|'timeline'|'checkbox'|'tags'|'link'|'files'|'formula'|'progress'|'priority'|'chat'|'time';
  title: string;
  width?: number;
  summaryType?: 'sum'|'avg'|'min'|'max'|'count'|'none';
  formulaExpr?: string;
  unit?: string;             // 'R$', '%', '$', '€', '£' ou customizado
  position: number;
}

interface TaskGroup {
  id: string;
  title: string;
  color: 'blue'|'green'|'purple'|'orange'|'red'|'teal'|'indigo'|'pink'|'grey';
  tasks: Task[];
  budget?: number;           // Orçamento fixo do grupo (rateio)
  archived?: boolean;
}

interface Task {
  id: string;
  name: string;
  groupId: string;
  columnValues: Record<string, any>;  // colId → valor
  orderIndex: number;
  archived?: boolean;
}
```

---

## 19. STATUS LABELS (Tradução EN → PT)

```typescript
STATUS_LABELS = {
  done:    'Concluído',
  working: 'Em progresso',
  stuck:   'Travado',
  default: 'Não iniciado',
}
```

---

## 20. NORMALIZAÇÃO DE STRINGS

Função `normalizeSearch` usada em todo o sistema para comparações case-insensitive sem acentos:
```typescript
const normalizeSearch = (s: string) =>
  (s || '').toLowerCase()
           .normalize('NFD')
           .replace(/[\u0300-\u036f]/g, '')   // remove acentos
           .replace(/[^a-z0-9]/g, '');        // mantém só alfanumérico
```

---

## 21. LINHA DO TEMPO — INICIALIZAÇÃO AUTOMÁTICA

Ao carregar o board, se o Grupo Histórico tiver linhas pai mas **nenhuma sub-linha**, o sistema chama automaticamente `initializeHistorySubRows()` após 1.5s.

Esse processo:
1. Varre as linhas pai do Histórico
2. Extrai o mês da data de entrega ou do nome
3. Cria `"Produção - mês/ano"` e `"Montagem - mês/ano"` se ainda não existirem
4. Define `dataEntrega` = último dia do mês, `status` = Concluído

---

## 22. TENDÊNCIA LINEAR (Linha de Regressão)

Aplicada sobre os dados do gráfico semanal e histórico:
```
slope = (n×ΣXY - ΣX×ΣY) / (n×ΣX² - (ΣX)²)
intercept = (ΣY - slope×ΣX) / n
trend[i] = slope × i + intercept
```
Exibida como linha vermelha tracejada (`stroke="#ef4444"`, `strokeDasharray="5 5"`).

---

## 23. RESUMO: FLUXO DE DADOS DO DASHBOARD

```
Supabase DB
  ↓ fetchBoards()
Board (grupos + colunas + tasks + columnValues)
  ↓ allItems (useMemo)
  Normalização de todos os campos, classificação Fábrica/Montagem
  ↓ workItems (useMemo)
  Filtros: mês, setor, regra de adiantamento
  ↓ dashboardItems (filtro de projeto)
  ↓ Cálculos principais (useMemo)
     ├─ uniqueProjects
     ├─ conclusaoGeral
     ├─ totalValueByWeek → weeklyChartData → tendência
     ├─ weeklyBreakdown (Fábrica vs Montagem por semana)
     ├─ breakdownTotals (totais gerais)
     ├─ valorProjetadoMes
     ├─ valueMesAnterior → MoM, Atingimento
     ├─ groupSummaries (Status dos Projetos)
     ├─ sectorSummaries (Conclusão por Setor)
     └─ historicalData → historicalChartData → tendência
```

---

*Documento gerado automaticamente em 2026-04-18. Fonte: `ExecDashboard.tsx`, `TableView.tsx`, `BoardHeader.tsx`, `src/lib/supabase.ts`, `src/types/board.ts`, `supabase_schema.sql`.*
