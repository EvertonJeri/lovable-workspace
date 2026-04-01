import { ViewMode } from '@/types/board';
import { Table2, Kanban, GanttChart, Plus, Search, Filter, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BoardHeaderProps {
  title: string;
  viewMode: ViewMode;
  onViewChange: (mode: ViewMode) => void;
  onAddTask: () => void;
}

const views: { mode: ViewMode; icon: React.ElementType; label: string }[] = [
  { mode: 'table', icon: Table2, label: 'Tabela' },
  { mode: 'kanban', icon: Kanban, label: 'Kanban' },
  { mode: 'gantt', icon: GanttChart, label: 'Gantt' },
];

export default function BoardHeader({ title, viewMode, onViewChange, onAddTask }: BoardHeaderProps) {
  return (
    <div className="px-6 pt-6 pb-4">
      <h1 className="text-2xl font-bold text-foreground mb-4">{title}</h1>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {views.map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => onViewChange(mode)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                viewMode === mode
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors">
            <Filter className="w-4 h-4" />
            Filtrar
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors">
            <Search className="w-4 h-4" />
            Buscar
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors">
            <UserPlus className="w-4 h-4" />
            Convidar
          </button>
          <button
            onClick={onAddTask}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova tarefa
          </button>
        </div>
      </div>
    </div>
  );
}
