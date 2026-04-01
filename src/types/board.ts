export type TaskStatus = 'done' | 'working' | 'stuck' | 'default';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type ViewMode = 'table' | 'kanban' | 'gantt';
export type GroupColor = 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'teal';

export interface Person {
  id: string;
  name: string;
  avatar?: string;
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee?: Person;
  startDate?: string;
  endDate?: string;
  groupId: string;
}

export interface TaskGroup {
  id: string;
  title: string;
  color: GroupColor;
  tasks: Task[];
  collapsed?: boolean;
}

export interface Board {
  id: string;
  title: string;
  groups: TaskGroup[];
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  done: 'Concluído',
  working: 'Em progresso',
  stuck: 'Travado',
  default: 'Pendente',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  critical: 'Crítica',
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};
