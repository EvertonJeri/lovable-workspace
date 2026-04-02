import { useMemo, useState } from 'react';
import { Board, Task, BoardColumn, TaskGroup, Person } from '@/types/board';
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval, parseISO, isValid, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { AlertCircle, ChevronLeft, ChevronRight, User, Search, Filter, Minus, Plus, Settings2, ChevronDown } from 'lucide-react';

interface GanttViewProps {
  board: Board;
}

export default function GanttView({ board }: GanttViewProps) {
  const [zoomLevel, setZoomLevel] = useState(40); // px per day
  const [showSettings, setShowSettings] = useState(false);
  const [timeScale, setTimeScale] = useState<'days' | 'months'>('days');

  // Config: 60 days view for better context
  const startDate = startOfMonth(new Date());
  const endDate = addDays(startDate, 60);
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const today = new Date();

  // ... memo ...
  const tasks = useMemo(() => {
    return board.groups.flatMap(g => g.tasks.map(t => ({ ...t, groupColor: g.color })));
  }, [board.groups]);

  // ... logic ...
  const getTimeline = (task: Task) => {
    const col = board.columns.find(c => c.type === 'timeline');
    if (!col) return null;
    const value = task.columnValues[col.id];
    if (!value?.start || !value?.end) return null;
    const start = parseISO(value.start);
    const end = parseISO(value.end);
    return isValid(start) && isValid(end) ? { start, end } : null;
  };

  const getAssignees = (task: Task): Person[] => {
    const col = board.columns.find(c => c.type === 'person');
    if (!col) return [];
    const value = task.columnValues[col.id];
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  };

  const conflicts = useMemo(() => {
    const userSchedules: Record<string, { taskId: string; start: Date; end: Date }[]> = {};
    const conflictSet = new Set<string>();

    tasks.forEach(task => {
      const timeline = getTimeline(task);
      if (!timeline) return;

      const assignees = getAssignees(task);
      assignees.forEach(person => {
        if (!userSchedules[person.id]) userSchedules[person.id] = [];
        
        userSchedules[person.id].forEach(sched => {
          if (
            isWithinInterval(timeline.start, { start: sched.start, end: sched.end }) ||
            isWithinInterval(timeline.end, { start: sched.start, end: sched.end }) ||
            isWithinInterval(sched.start, { start: timeline.start, end: timeline.end })
          ) {
            conflictSet.add(task.id);
            conflictSet.add(sched.taskId);
          }
        });

        userSchedules[person.id].push({ taskId: task.id, start: timeline.start, end: timeline.end });
      });
    });

    return conflictSet;
  }, [tasks, board.columns]);

  const todayX = useMemo(() => {
     return Math.max(0, (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) * zoomLevel;
  }, [today, startDate, zoomLevel]);

  return (
    <div className="flex h-[calc(100vh-120px)] bg-[#F5F6F8] overflow-hidden relative">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Gantt Toolbar */}
        <div className="flex items-center justify-between px-6 h-14 bg-white border-b border-border shrink-0">
          <div className="flex items-center gap-4">
             <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="text" placeholder="Digite para filtrar" className="pl-9 pr-4 py-1.5 bg-[#F5F6F8] border-none rounded text-xs w-48 focus:ring-1 focus:ring-blue-500" />
             </div>
             <button className="flex items-center gap-2 text-xs font-medium text-[#676879] hover:text-[#323338] transition-colors">
                <User className="w-4 h-4" /> Pessoas
             </button>
             <button className="flex items-center gap-2 text-xs font-medium text-[#676879] hover:text-[#323338] transition-colors">
                <Filter className="w-4 h-4" /> Filtro
             </button>
          </div>

          <div className="flex items-center gap-3">
             <div className="flex items-center bg-slate-100 rounded-md p-0.5">
                <button 
                  className={cn("px-3 py-1 rounded text-[10px] font-bold transition-all", timeScale === 'days' ? "bg-white shadow-sm text-blue-600" : "text-[#676879]")}
                  onClick={() => setTimeScale('days')}
                >
                  DIAS
                </button>
                <button 
                  className={cn("px-3 py-1 rounded text-[10px] font-bold transition-all", timeScale === 'months' ? "bg-white shadow-sm text-blue-600" : "text-[#676879]")}
                  onClick={() => setTimeScale('months')}
                >
                  MESES
                </button>
             </div>
             <div className="flex items-center gap-1">
                <button onClick={() => setZoomLevel(prev => Math.max(20, prev - 10))} className="p-1.5 hover:bg-slate-100 rounded-md"><Minus className="w-4 h-4 text-[#676879]" /></button>
                <button onClick={() => setZoomLevel(prev => Math.min(80, prev + 10))} className="p-1.5 hover:bg-slate-100 rounded-md"><Plus className="w-4 h-4 text-[#676879]" /></button>
             </div>
             <button onClick={() => setShowSettings(!showSettings)} className={cn("p-1.5 rounded-md transition-colors", showSettings ? "bg-blue-50 text-blue-600" : "hover:bg-slate-100")}>
                <Settings2 className="w-4 h-4" />
             </button>
          </div>
        </div>

        {/* Gantt Header (Days) */}
        <div className="flex bg-white border-b border-border h-12 shrink-0 overflow-hidden">
          <div className="w-[300px] border-r border-border flex items-center px-6 font-semibold text-[#323338] text-sm shrink-0 bg-white z-20">
             Tarefa / Responsável
          </div>
          <div className="flex-1 flex overflow-x-auto no-scrollbar relative">
             {days.map(day => (
               <div 
                 key={day.toISOString()} 
                 className={cn(
                   "flex flex-col items-center justify-center border-r border-slate-100 text-[10px] shrink-0",
                   (day.getDay() === 0 || day.getDay() === 6) && "bg-slate-50/50"
                 )}
                 style={{ minWidth: zoomLevel }}
               >
                  <span className="text-muted-foreground uppercase text-[8px]">{format(day, 'EEE', { locale: ptBR })}</span>
                  <span className={cn("font-bold text-[11px]", isSameDay(day, today) && "text-blue-600")}>{format(day, 'd')}</span>
               </div>
             ))}
          </div>
        </div>

        {/* Gantt Matrix */}
        <div className="flex-1 flex overflow-hidden">
           {/* Left Sidebar Table */}
           <div className="w-[300px] border-r border-border bg-white overflow-y-auto shrink-0 z-20 no-scrollbar">
              {board.groups.map(group => (
                <div key={group.id}>
                   <div className="flex bg-slate-50 border-b border-border h-8 items-center px-4">
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: group.color }}>{group.title}</span>
                   </div>
                   {group.tasks.map(task => {
                     const timeline = getTimeline(task);
                     const isConflict = conflicts.has(task.id);
                     return (
                        <div key={task.id} className="flex flex-col justify-center px-6 h-14 border-b border-slate-50 group hover:bg-slate-50 transition-colors">
                           <span className={cn("text-[12px] font-medium truncate", isConflict && "text-red-600")}>{task.name}</span>
                           <span className="text-[10px] text-muted-foreground">
                              {timeline ? `${format(timeline.start, 'MMM d', { locale: ptBR })} - ${format(timeline.end, 'MMM d', { locale: ptBR })}` : 'Sem data'}
                           </span>
                        </div>
                     );
                   })}
                </div>
              ))}
           </div>

           {/* Timeline Area */}
           <div className="flex-1 overflow-auto relative">
              <div className="absolute top-0 bottom-0 pointer-events-none z-10 w-0.5 bg-blue-500/80" style={{ left: todayX }}>
                 <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-500 rounded-full" />
              </div>

              {board.groups.map(group => (
                <div key={group.id}>
                   <div className="h-8 border-b border-slate-50" />
                   {group.tasks.map(task => {
                     const timeline = getTimeline(task);
                     const assignees = getAssignees(task);
                     const isConflict = conflicts.has(task.id);

                     return (
                        <div key={task.id} className="h-14 border-b border-slate-50 relative group">
                           {/* Background Grid */}
                           <div className="absolute inset-0 flex">
                              {days.map(day => (
                                <div key={day.toISOString()} style={{ minWidth: zoomLevel }} className="border-r border-slate-50 shrink-0" />
                              ))}
                           </div>

                           {/* Task Bar */}
                           {timeline && (
                              <div className="absolute inset-y-0 flex items-center">
                                 <div 
                                    className={cn(
                                      "h-6 rounded-md shadow-sm z-10 flex items-center px-3 text-[10px] text-white font-medium group-hover:shadow-md transition-all relative",
                                      isConflict ? "bg-orange-500" : "bg-blue-500"
                                    )}
                                    style={{
                                      left: `${Math.max(0, (timeline.start.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) * zoomLevel}px`,
                                      width: `${(timeline.end.getTime() - timeline.start.getTime()) / (1000 * 60 * 60 * 24) * zoomLevel + zoomLevel}px`
                                    }}
                                 >
                                    <span className="truncate">{task.name}</span>
                                    
                                    {/* Bar Label (Assignees) */}
                                    <div className="absolute left-full ml-3 whitespace-nowrap text-[11px] text-[#323338] font-normal flex items-center gap-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                                       {assignees.map(p => p.name).join(', ')}
                                    </div>
                                 </div>
                              </div>
                           )}
                        </div>
                     );
                   })}
                </div>
              ))}
           </div>
        </div>
      </div>

      {/* Settings Side Panel */}
      {showSettings && (
        <div className="w-80 bg-white border-l border-border flex flex-col z-30 shadow-2xl animate-in slide-in-from-right duration-300">
           <div className="p-6 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold">
                 <Settings2 className="w-4 h-4" /> Configurações dos widgets
              </div>
              <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-slate-100 rounded">
                 <ChevronRight className="w-4 h-4 text-[#676879]" />
              </button>
           </div>
           
           <div className="p-6 space-y-8 overflow-y-auto">
              <div className="space-y-4">
                 <label className="text-xs font-bold text-muted-foreground uppercase">Coluna de cronograma</label>
                 <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between cursor-pointer">
                    <span className="text-sm">Cronograma Produção</span>
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                 </div>
              </div>

              <div className="space-y-4">
                 <label className="text-xs font-bold text-muted-foreground uppercase">Agrupar por</label>
                 <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between cursor-pointer">
                    <span className="text-sm">Status do Projeto</span>
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                 </div>
              </div>

              <div className="space-y-4">
                 <label className="text-xs font-bold text-muted-foreground uppercase">Etiquetar por</label>
                 <div className="p-3 bg-white border border-blue-500 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <User className="w-4 h-4 text-blue-500" />
                       <span className="text-sm font-medium">Responsável</span>
                    </div>
                    <Minus className="w-4 h-4 text-[#676879]" />
                 </div>
              </div>

              <div className="pt-4 space-y-4 border-t border-slate-100">
                 <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Caminho crítico</span>
                    <div className="w-8 h-4 bg-slate-200 rounded-full relative">
                       <div className="absolute left-1 top-1 w-2 h-2 bg-white rounded-full" />
                    </div>
                 </div>
                 <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Linha de base</span>
                    <div className="w-8 h-4 bg-blue-500 rounded-full relative">
                       <div className="absolute right-1 top-1 w-2 h-2 bg-white rounded-full" />
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
