import { Board } from '@/types/board';

export const sampleBoard: Board = {
  id: 'board-1',
  title: 'Projeto Website',
  groups: [
    {
      id: 'group-1',
      title: 'Desenvolvimento Frontend',
      color: 'blue',
      tasks: [
        { id: 't1', title: 'Criar layout da landing page', status: 'done', priority: 'high', groupId: 'group-1', startDate: '2026-03-25', endDate: '2026-03-28', assignee: { id: 'p1', name: 'Ana Silva' } },
        { id: 't2', title: 'Implementar sistema de autenticação', status: 'working', priority: 'critical', groupId: 'group-1', startDate: '2026-03-28', endDate: '2026-04-03', assignee: { id: 'p2', name: 'Carlos Souza' } },
        { id: 't3', title: 'Criar componentes de dashboard', status: 'stuck', priority: 'high', groupId: 'group-1', startDate: '2026-03-30', endDate: '2026-04-05', assignee: { id: 'p1', name: 'Ana Silva' } },
        { id: 't4', title: 'Testes unitários', status: 'default', priority: 'medium', groupId: 'group-1', startDate: '2026-04-02', endDate: '2026-04-07' },
      ],
    },
    {
      id: 'group-2',
      title: 'Backend & API',
      color: 'green',
      tasks: [
        { id: 't5', title: 'Configurar banco de dados', status: 'done', priority: 'critical', groupId: 'group-2', startDate: '2026-03-24', endDate: '2026-03-27', assignee: { id: 'p3', name: 'Marina Costa' } },
        { id: 't6', title: 'Criar endpoints REST', status: 'working', priority: 'high', groupId: 'group-2', startDate: '2026-03-27', endDate: '2026-04-02', assignee: { id: 'p3', name: 'Marina Costa' } },
        { id: 't7', title: 'Implementar webhooks', status: 'default', priority: 'low', groupId: 'group-2', startDate: '2026-04-03', endDate: '2026-04-08' },
      ],
    },
    {
      id: 'group-3',
      title: 'Design & UX',
      color: 'purple',
      tasks: [
        { id: 't8', title: 'Wireframes das telas principais', status: 'done', priority: 'high', groupId: 'group-3', startDate: '2026-03-20', endDate: '2026-03-25', assignee: { id: 'p4', name: 'Pedro Lima' } },
        { id: 't9', title: 'Design system completo', status: 'working', priority: 'medium', groupId: 'group-3', startDate: '2026-03-26', endDate: '2026-04-01', assignee: { id: 'p4', name: 'Pedro Lima' } },
        { id: 't10', title: 'Protótipo interativo', status: 'default', priority: 'low', groupId: 'group-3', startDate: '2026-04-01', endDate: '2026-04-06' },
      ],
    },
  ],
};

export const sampleBoards: Board[] = [
  sampleBoard,
  { id: 'board-2', title: 'Marketing Q2', groups: [] },
  { id: 'board-3', title: 'Roadmap Produto', groups: [] },
];
