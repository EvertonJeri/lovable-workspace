import { Board, BoardColumn } from '@/types/board';

// Colunas padrão originais do PCP, mas com os totalizadores ativados
const defaultColumns: BoardColumn[] = [
  { id: 'assignee', type: 'person', title: 'Responsável', width: 140, position: 0 },
  { id: 'status', type: 'status', title: 'Status', width: 140, position: 1 },
  { id: 'deliveryDate', type: 'date', title: 'Data de Entr.', width: 120, position: 2 },
  { id: 'timeline', type: 'timeline', title: 'Cronograma', width: 160, position: 3 },
  { id: 'percentage', type: 'number', title: '%', unit: '%', width: 80, summaryType: 'avg', position: 4 },
  { id: 'budget', type: 'number', title: 'Orçamento Job', unit: 'R$', width: 140, summaryType: 'sum', position: 5 },
  { id: 'materialCost', type: 'number', title: 'Custo Material', unit: 'R$', width: 140, summaryType: 'sum', position: 6 },
  { id: 'moCost', type: 'number', title: 'Custo M.O', unit: 'R$', width: 140, summaryType: 'sum', position: 7 },
  { id: 'finalCost', type: 'formula', title: 'Saldo a Executar', formulaExpr: '{Orçamento Job} - ({Orçamento Job} * ({%} / 100))', width: 140, position: 8 },
];

export const sampleBoards: Board[] = [
  // ========== PPCP - Cronograma de Produção ==========
  {
    id: 'ppcp-cronograma',
    title: 'PPCP - Cronograma de Produção (MODELO)',
    workspaceId: 'ws-1',
    columns: [...defaultColumns],
    groups: [
      {
        id: 'g-pirulito',
        title: 'PIRULITO - 3 UN 2569C',
        color: 'orange',
        tasks: [
          {
            id: 'p1', name: '3D modeling', groupId: 'g-pirulito', orderIndex: 0,
            columnValues: {
              status: 'done', priority: 'high',
              assignee: [{ id: 'u1', name: 'Gustavo Lima', avatar: 'https://i.pravatar.cc/150?u=gustavo' }],
              timeline: { start: '2026-03-25', end: '2026-03-28' },
              budget: 433.16, percentage: 100
            }
          },
          {
            id: 'p2', name: 'IMPRESSÃO 3D', groupId: 'g-pirulito', orderIndex: 1,
            columnValues: {
              status: 'working', priority: 'medium',
              assignee: [{ id: 'u2', name: 'Maria Costa', avatar: 'https://i.pravatar.cc/150?u=maria' }],
              timeline: { start: '2026-03-28', end: '2026-04-03' },
              budget: 216.58, percentage: 45
            }
          },
          {
            id: 'p3', name: 'ROUTER', groupId: 'g-pirulito', orderIndex: 2,
            columnValues: {
              status: 'stuck', priority: 'high',
              assignee: [{ id: 'u3', name: 'Ana Santos', avatar: 'https://i.pravatar.cc/150?u=ana' }],
              timeline: { start: '2026-03-30', end: '2026-04-05' },
              budget: 1516.06, percentage: 10
            }
          },
        ]
      },
      {
        id: 'g-esculturas',
        title: 'ESCULTURAS - LACOSTE 2569B',
        color: 'green',
        tasks: [
          {
            id: 'e1', name: 'LAMINAÇÃO', groupId: 'g-esculturas', orderIndex: 0,
            columnValues: {
              status: 'working', priority: 'high',
              assignee: [{ id: 'u4', name: 'Carlos Pereira', avatar: 'https://i.pravatar.cc/150?u=carlos' }],
              timeline: { start: '2026-03-24', end: '2026-03-27' },
              budget: 3248.70, percentage: 60
            }
          },
        ]
      }
    ]
  },

  // ========== Desempenho Oficial ==========
  {
    id: 'desempenho-oficial',
    title: 'Desempenho Oficial (MODELO)',
    workspaceId: 'ws-1',
    columns: [
      { id: 'c3', type: 'number', title: 'Percentual (%)', unit: '%', width: 120, summaryType: 'avg', position: 0 },
      { id: 'c4', type: 'number', title: 'Orçado', unit: 'R$', width: 140, summaryType: 'sum', position: 1 },
      { id: 'c5', type: 'number', title: 'Semana 01 (%)', unit: '%', width: 120, summaryType: 'avg', position: 2 },
      { id: 'c6', type: 'number', title: 'Semana 02 (%)', unit: '%', width: 120, summaryType: 'avg', position: 3 },
      { id: 'c7', type: 'number', title: 'Semana 03 (%)', unit: '%', width: 120, summaryType: 'avg', position: 4 },
      { id: 'c10', type: 'number', title: 'Semana 04 (%)', unit: '%', width: 120, summaryType: 'avg', position: 5 },
      { id: 'c11', type: 'number', title: 'Semana 05 (%)', unit: '%', width: 120, summaryType: 'avg', position: 6 },
      { id: 'c8', type: 'status', title: 'Status', width: 140, position: 7 },
      { id: 'c9', type: 'formula', title: 'Saldo a Executar', formulaExpr: '{Orçado} - ({Orçado} * ({Percentual (%)}) / 100)', width: 140, position: 8 },
    ],
    groups: [
      {
        id: 'g-montagem',
        title: 'MONTAGEM CHAVES MÉDIO - RECIFE',
        color: 'blue',
        tasks: [
          { id: 't1', name: '3D', groupId: 'g-montagem', orderIndex: 0, columnValues: { 'c3': 2, 'c4': 3360, 'c5': 0, 'c6': 0, 'c8': 'working', 'c9': '3360' } },
          { id: 't2', name: 'IMPRESSÃO 3D', groupId: 'g-montagem', orderIndex: 1, columnValues: { 'c3': 1, 'c4': 1680, 'c5': 0, 'c6': 0, 'c8': 'working' } },
          { id: 't3', name: 'ROUTER', groupId: 'g-montagem', orderIndex: 2, columnValues: { 'c3': 7, 'c4': 11760, 'c5': 0, 'c6': 0, 'c8': 'stuck' } },
          { id: 't4', name: 'ESCULTURA', groupId: 'g-montagem', orderIndex: 3, columnValues: { 'c3': 13, 'c4': 30240, 'c5': 0, 'c6': 0, 'c8': 'done' } },
          { id: 't5', name: 'FORMA', groupId: 'g-montagem', orderIndex: 4, columnValues: { 'c3': 12, 'c4': 20160, 'c5': 0, 'c6': 0, 'c8': 'working' } },
        ]
      },
      {
        id: 'g-logistica',
        title: 'Logística - Baleia - One Piece',
        color: 'pink',
        tasks: [
          { id: 't6', name: 'MONTAGEM', groupId: 'g-logistica', orderIndex: 0, columnValues: { 'c3': 100, 'c4': 282355.23, 'c5': 80, 'c6': 20, 'c8': 'done' } },
        ]
      }
    ]
  },
];

// O board padrão é o PPCP
export const sampleBoard = sampleBoards[0];
