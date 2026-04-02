import { Task, TaskGroup, TaskStatus, STATUS_LABELS } from '@/types/board';
import { StatusBadge, PriorityBadge } from './StatusBadge';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

const statusOrder: TaskStatus[] = ['default', 'working', 'stuck', 'done'];

const columnBorderColors: Record<TaskStatus, string> = {
  default: 'border-t-status-default',
  working: 'border-t-status-working',
  stuck: 'border-t-status-stuck',
  done: 'border-t-status-done',
};

interface KanbanViewProps {
  groups: TaskGroup[];
  onTaskClick: (task: Task) => void;
}

export default function KanbanView({ groups, onTaskClick }: KanbanViewProps) {
  const allTasks = groups.flatMap((g) => g.tasks);

  const columns = statusOrder.map((status) => ({
    status,
    tasks: allTasks.filter((t) => (t as any).columnValues?.status === status || (!status && !(t as any).columnValues?.status)),
  }));

  return (
    <div className="px-6 flex gap-4 overflow-x-auto pb-6">
      {columns.map(({ status, tasks }) => (
        <div key={status} className="min-w-[280px] flex-1">
          <div className={cn("bg-card rounded-lg border border-border border-t-4 p-3", columnBorderColors[status])}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">{STATUS_LABELS[status]}</span>
                <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                  {tasks.length}
                </span>
              </div>
              <button className="text-muted-foreground hover:text-foreground transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {tasks.map((task) => {
                const group = groups.find((g) => g.id === task.groupId);
                const priority = (task as any).columnValues?.priority || 'medium';
                return (
                  <div
                    key={task.id}
                    onClick={(e) => { if (e.detail === 3) onTaskClick(task); }}
                    className="bg-background rounded-md p-3 border border-border hover:shadow-md cursor-pointer transition-all"
                  >

                    <p className="text-sm font-medium text-foreground mb-2">{task.name}</p>
                    <div className="flex items-center justify-between">
                      <PriorityBadge priority={priority} />
                      {(task as any).columnValues?.person && (
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">
                           {(task as any).columnValues.person.name?.[0] || 'U'}
                        </div>
                      )}
                    </div>
                    {group && (
                      <p className="text-xs text-muted-foreground mt-2">{group.title}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

