import { TaskGroup, GroupColor } from '@/types/board';
import { differenceInDays, parseISO, format, addDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const barColors: Record<GroupColor, string> = {
  blue: 'bg-group-blue',
  green: 'bg-group-green',
  purple: 'bg-group-purple',
  orange: 'bg-group-orange',
  red: 'bg-group-red',
  teal: 'bg-group-teal',
};

interface GanttViewProps {
  groups: TaskGroup[];
}

export default function GanttView({ groups }: GanttViewProps) {
  const allTasks = groups.flatMap((g) => g.tasks.map((t) => ({ ...t, groupColor: g.color })));
  const tasksWithDates = allTasks.filter((t) => t.startDate && t.endDate);

  if (tasksWithDates.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-muted-foreground">
        Nenhuma tarefa com datas definidas para exibir no Gantt.
      </div>
    );
  }

  const allStarts = tasksWithDates.map((t) => parseISO(t.startDate!));
  const allEnds = tasksWithDates.map((t) => parseISO(t.endDate!));
  const minDate = startOfDay(new Date(Math.min(...allStarts.map((d) => d.getTime()))));
  const maxDate = startOfDay(new Date(Math.max(...allEnds.map((d) => d.getTime()))));
  const totalDays = differenceInDays(maxDate, minDate) + 2;

  const days = Array.from({ length: totalDays }, (_, i) => addDays(minDate, i));

  return (
    <div className="px-6 overflow-x-auto pb-6">
      <div className="bg-card rounded-lg border border-border overflow-hidden min-w-[800px]">
        {/* Header with days */}
        <div className="flex border-b border-border">
          <div className="w-[250px] shrink-0 px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider border-r border-border">
            Tarefa
          </div>
          <div className="flex-1 flex">
            {days.map((day, i) => (
              <div
                key={i}
                className="flex-1 min-w-[40px] px-1 py-3 text-center text-xs text-muted-foreground border-r border-border last:border-r-0"
              >
                <div className="font-medium">{format(day, 'dd')}</div>
                <div className="text-[10px] opacity-60">{format(day, 'EEE', { locale: ptBR })}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Task rows */}
        {tasksWithDates.map((task) => {
          const start = parseISO(task.startDate!);
          const end = parseISO(task.endDate!);
          const offsetDays = differenceInDays(start, minDate);
          const durationDays = differenceInDays(end, start) + 1;
          const leftPercent = (offsetDays / totalDays) * 100;
          const widthPercent = (durationDays / totalDays) * 100;

          return (
            <div key={task.id} className="flex border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors">
              <div className="w-[250px] shrink-0 px-4 py-3 text-sm font-medium text-foreground truncate border-r border-border flex items-center gap-2">
                <div className={cn("w-2 h-2 rounded-full", barColors[task.groupColor])} />
                {task.title}
              </div>
              <div className="flex-1 relative py-2">
                <div
                  className={cn("absolute top-1/2 -translate-y-1/2 h-7 rounded-md opacity-90 flex items-center justify-center", barColors[task.groupColor])}
                  style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                >
                  <span className="text-[10px] font-medium text-card truncate px-2">
                    {task.assignee?.name.split(' ')[0] || ''}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
