import { useState } from 'react';
import { TaskGroup, Task, GroupColor } from '@/types/board';
import { StatusBadge, PriorityBadge } from './StatusBadge';
import { ChevronDown, GripVertical, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const groupColorClasses: Record<GroupColor, string> = {
  blue: 'bg-group-blue',
  green: 'bg-group-green',
  purple: 'bg-group-purple',
  orange: 'bg-group-orange',
  red: 'bg-group-red',
  teal: 'bg-group-teal',
};

const groupTextClasses: Record<GroupColor, string> = {
  blue: 'text-group-blue',
  green: 'text-group-green',
  purple: 'text-group-purple',
  orange: 'text-group-orange',
  red: 'text-group-red',
  teal: 'text-group-teal',
};

interface TableViewProps {
  groups: TaskGroup[];
  onTaskClick: (task: Task) => void;
}

export default function TableView({ groups, onTaskClick }: TableViewProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (id: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="px-6 space-y-4">
      {groups.map((group) => {
        const collapsed = collapsedGroups.has(group.id);
        return (
          <div key={group.id} className="bg-card rounded-lg overflow-hidden shadow-sm border border-border">
            {/* Group header */}
            <button
              onClick={() => toggleGroup(group.id)}
              className="flex items-center gap-2 w-full px-4 py-3 hover:bg-muted/50 transition-colors"
            >
              <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", collapsed && "-rotate-90")} />
              <div className={cn("w-3 h-3 rounded-sm", groupColorClasses[group.color])} />
              <span className={cn("font-semibold text-sm", groupTextClasses[group.color])}>
                {group.title}
              </span>
              <span className="text-xs text-muted-foreground ml-1">
                {group.tasks.length} tarefas
              </span>
            </button>

            {!collapsed && (
              <>
                {/* Column headers */}
                <div className="grid grid-cols-[4px_minmax(0,2fr)_120px_100px_140px_140px] items-center px-4 py-2 border-y border-border text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <div />
                  <div className="pl-6">Tarefa</div>
                  <div className="text-center">Responsável</div>
                  <div className="text-center">Status</div>
                  <div className="text-center">Prioridade</div>
                  <div className="text-center">Prazo</div>
                </div>

                {/* Tasks */}
                {group.tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => onTaskClick(task)}
                    className="grid grid-cols-[4px_minmax(0,2fr)_120px_100px_140px_140px] items-center px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-muted/30 cursor-pointer transition-colors group"
                  >
                    <div className={cn("w-1 h-8 rounded-full", groupColorClasses[group.color])} />
                    <div className="pl-4 flex items-center gap-2">
                      <GripVertical className="w-3.5 h-3.5 text-muted-foreground/0 group-hover:text-muted-foreground/50 transition-colors" />
                      <span className="text-sm font-medium text-foreground truncate">{task.title}</span>
                    </div>
                    <div className="text-center">
                      {task.assignee ? (
                        <div className="inline-flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">
                            {task.assignee.name.split(' ').map(n => n[0]).join('')}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                    <div className="flex justify-center">
                      <StatusBadge status={task.status} />
                    </div>
                    <div className="flex justify-center">
                      <PriorityBadge priority={task.priority} />
                    </div>
                    <div className="text-center text-xs text-muted-foreground">
                      {task.endDate ? format(parseISO(task.endDate), "dd MMM", { locale: ptBR }) : '—'}
                    </div>
                  </div>
                ))}

                {/* Add task */}
                <button className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted/30 transition-colors">
                  <Plus className="w-4 h-4 ml-1" />
                  <span>Adicionar tarefa</span>
                </button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
