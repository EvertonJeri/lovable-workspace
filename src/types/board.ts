export type ColumnType = 
  | 'status' 
  | 'text' 
  | 'number' 
  | 'person' 
  | 'date' 
  | 'timeline' 
  | 'checkbox' 
  | 'tags' 
  | 'link' 
  | 'files' 
  | 'formula' 
  | 'progress' 
  | 'priority'
  | 'time';

export type ViewMode = 'table' | 'kanban' | 'timeline' | 'calendar' | 'dashboard' | 'gantt' | 'generator';

export type TaskStatus = 'done' | 'working' | 'stuck' | 'default';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type GroupColor = 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'teal' | 'indigo' | 'pink' | 'grey';

export interface Person {
  id: string;
  name: string;
  avatar?: string;
  email?: string;
  sector?: string;
}

export interface BoardColumn {
  id: string;
  type: ColumnType;
  title: string;
  settings?: Record<string, any>;
  width?: number;
  summaryType?: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'none';
  formulaExpr?: string;
  unit?: string;
  position: number;
}

export interface Task {
  id: string;
  name: string;
  groupId: string;
  columnValues: Record<string, any>;
  orderIndex: number;
  subitems?: Task[];
  archived?: boolean;
}


export interface TaskGroup {
  id: string;
  title: string;
  color: GroupColor;
  tasks: Task[];
  collapsed?: boolean;
  archived?: boolean;
}


export interface Board {
  id: string;
  title: string;
  workspaceId: string;
  columns: BoardColumn[];
  groups: TaskGroup[];
  type?: 'public' | 'private' | 'shareable';
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  done: 'Concluído',
  working: 'Em progresso',
  stuck: 'Travado',
  default: 'Não iniciado',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  critical: 'Crítica',
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};
