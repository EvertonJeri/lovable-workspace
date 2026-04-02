import { Board, BoardColumn } from '@/types/board';

// Colunas padrão para quadros gerais
const defaultColumns: BoardColumn[] = [
  { id: 'status', type: 'status', title: 'Status', width: 140, position: 0 },
  { id: 'priority', type: 'priority', title: 'Prioridade', width: 100, position: 1 },
  { id: 'assignee', type: 'person', title: 'Responsável', width: 150, position: 2 },
  { id: 'timeline', type: 'timeline', title: 'Cronograma', width: 200, position: 3 },
  { id: 'budget', type: 'number', title: 'Orçamento', width: 120, summaryType: 'sum', unit: 'R$', position: 4 },
  { id: 'progress', type: 'progress', title: 'Progresso', width: 150, summaryType: 'avg', position: 5 },
];

export const sampleBoards: Board[] = [
  // ========== PPCP - Cronograma de Produção ==========
  {
    id: 'ppcp-cronograma',
    title: 'PPCP - Cronograma de Produção',
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
              budget: 433.16, progress: 100
            }
          },
          {
            id: 'p2', name: 'IMPRESSÃO 3D', groupId: 'g-pirulito', orderIndex: 1,
            columnValues: {
              status: 'working', priority: 'medium',
              assignee: [{ id: 'u2', name: 'Maria Costa', avatar: 'https://i.pravatar.cc/150?u=maria' }],
              timeline: { start: '2026-03-28', end: '2026-04-03' },
              budget: 216.58, progress: 45
            }
          },
          {
            id: 'p3', name: 'ROUTER', groupId: 'g-pirulito', orderIndex: 2,
            columnValues: {
              status: 'stuck', priority: 'high',
              assignee: [{ id: 'u3', name: 'Ana Santos', avatar: 'https://i.pravatar.cc/150?u=ana' }],
              timeline: { start: '2026-03-30', end: '2026-04-05' },
              budget: 1516.06, progress: 10
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
              budget: 3248.70, progress: 60
            }
          },
        ]
      }
    ]
  },

  // ========== Desempenho Oficial ==========
  {
    id: 'desempenho-oficial',
    title: 'Desempenho Oficial',
    workspaceId: 'ws-1',
    columns: [
      { id: 'c1', type: 'text', title: 'Elemento', width: 220, position: 0 },
      { id: 'c2', type: 'text', title: 'Subitem Name', width: 200, position: 1 },
      { id: 'c3', type: 'number', title: 'Percentual (%)', unit: '%', width: 120, summaryType: 'avg', position: 2 },
      { id: 'c4', type: 'number', title: 'Orçado', unit: 'R$', width: 140, summaryType: 'sum', position: 3 },
      { id: 'c5', type: 'number', title: 'Semana 01 (%)', unit: '%', width: 120, position: 4 },
      { id: 'c6', type: 'number', title: 'Semana 02 (%)', unit: '%', width: 120, position: 5 },
      { id: 'c7', type: 'number', title: 'Semana 03 (%)', unit: '%', width: 120, position: 6 },
      { id: 'c8', type: 'status', title: 'Status', width: 140, position: 7 },
      { id: 'c9', type: 'formula', title: 'Fórmula', width: 140, position: 8 },
    ],
    groups: [
      {
        id: 'g-montagem',
        title: 'MONTAGEM CHAVES MÉDIO - RECIFE',
        color: 'blue',
        tasks: [
          { id: 't1', name: '3D', groupId: 'g-montagem', orderIndex: 0, columnValues: { 'c1': 'MONT...', 'c2': '3D', 'c3': 2, 'c4': 3360, 'c8': 'working', 'c9': '3360' } },
          { id: 't2', name: 'IMPRESSÃO 3D', groupId: 'g-montagem', orderIndex: 1, columnValues: { 'c1': 'MONT...', 'c2': 'IMPRESSÃO 3D', 'c3': 1, 'c4': 1680, 'c8': 'working' } },
          { id: 't3', name: 'ROUTER', groupId: 'g-montagem', orderIndex: 2, columnValues: { 'c1': 'MONT...', 'c2': 'ROUTER', 'c3': 7, 'c4': 11760, 'c8': 'stuck' } },
          { id: 't4', name: 'ESCULTURA', groupId: 'g-montagem', orderIndex: 3, columnValues: { 'c1': 'MONT...', 'c2': 'ESCULTURA', 'c3': 13, 'c4': 30240, 'c8': 'done' } },
          { id: 't5', name: 'FORMA', groupId: 'g-montagem', orderIndex: 4, columnValues: { 'c1': 'MONT...', 'c2': 'FORMA', 'c3': 12, 'c4': 20160, 'c8': 'working' } },
        ]
      },
      {
        id: 'g-logistica',
        title: 'Logística - Baleia - One Piece',
        color: 'pink',
        tasks: [
          { id: 't6', name: 'MONTAGEM', groupId: 'g-logistica', orderIndex: 0, columnValues: { 'c1': 'LOG...', 'c2': 'MONTAGEM', 'c3': 100, 'c4': 282355.23, 'c8': 'done' } },
        ]
      }
    ]
  },


];

// O board padrão é o PPCP (primeiro da lista, como na imagem original)
export const sampleBoard = sampleBoards[0];
