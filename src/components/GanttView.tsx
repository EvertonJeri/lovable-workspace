import { useMemo, useState, useRef, useEffect } from 'react';
import { Board, Task, BoardColumn, TaskGroup, Person } from '@/types/board';
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval, parseISO, isValid, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { AlertCircle, ChevronLeft, ChevronRight, User, Search, Filter, Minus, Plus, Settings2, ChevronDown, DollarSign } from 'lucide-react';

interface GanttViewProps {
  board: Board;
}

export default function GanttView({ board }: GanttViewProps) {
  const [zoomLevel, setZoomLevel] = useState(40); // px per day
  const [showSettings, setShowSettings] = useState(false);
  const [timeScale, setTimeScale] = useState<'days' | 'months'>('days');
  const [selectedTimelineCol, setSelectedTimelineCol] = useState<string>('');
  const [labelByCol, setLabelByCol] = useState<string>('');
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [showBaseline, setShowBaseline] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  
  const headerMonthsRef = useRef<HTMLDivElement>(null);
  const headerDaysRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Initialize columns if not set
  useEffect(() => {
    if (!selectedTimelineCol) {
      const col = board.columns.find(c => c.type === 'timeline');
      if (col) setSelectedTimelineCol(col.id);
    }
    if (!labelByCol) {
      const col = board.columns.find(c => c.id && (c.type === 'person' || c.title.toLowerCase().includes('responsável')));
      if (col) setLabelByCol(col.id);
    }
  }, [board.columns, selectedTimelineCol, labelByCol]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollLeft = e.currentTarget.scrollLeft;
    if (headerMonthsRef.current) headerMonthsRef.current.scrollLeft = scrollLeft;
    if (headerDaysRef.current) headerDaysRef.current.scrollLeft = scrollLeft;
  };

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const startDate = useMemo(() => startOfMonth(addDays(new Date(), -30)), []);
  const endDate = useMemo(() => addDays(startDate, 180), [startDate]);
  const days = useMemo(() => eachDayOfInterval({ start: startDate, end: endDate }), [startDate, endDate]);
  const today = new Date();

  const months = useMemo(() => {
    const result: { date: Date, daysCount: number }[] = [];
    let current = startOfMonth(startDate);
    while (current <= endDate) {
      const mStart = current > startDate ? current : startDate;
      const mEnd = endOfMonth(current) < endDate ? endOfMonth(current) : endDate;
      const daysCount = Math.floor((mEnd.getTime() - mStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      result.push({ date: current, daysCount });
      current = addDays(endOfMonth(current), 1);
    }
    return result;
  }, [startDate, endDate]);

  const tasks = useMemo(() => {
    return board.groups.flatMap(g => g.tasks.map(t => ({ ...t, groupColor: g.color })));
  }, [board.groups]);

  const getTimeline = (task: Task) => {
    const colId = selectedTimelineCol || board.columns.find(c => c.type === 'timeline')?.id;
    if (!colId) return null;
    const value = task.columnValues[colId];
    if (!value?.start || !value?.end) return null;
    const start = parseISO(value.start);
    const end = parseISO(value.end);
    return isValid(start) && isValid(end) ? { start, end } : null;
  };

  const getLabelValue = (task: Task) => {
    if (!labelByCol) return '';
    const col = board.columns.find(c => c.id === labelByCol);
    if (!col) return '';
    const val = task.columnValues[labelByCol];
    if (!val) return '';
    
    if (col.type === 'person') {
      const persons = Array.isArray(val) ? val : [val];
      return persons.map(p => (p as Person).name).join(', ');
    }
    if (typeof val === 'object') return '';
    return String(val);
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
        if (!person || !person.id) return;
        if (!userSchedules[person.id]) userSchedules[person.id] = [];
        
        userSchedules[person.id].forEach(sched => {
          if (timeline.start <= sched.end && timeline.end >= sched.start) {
            conflictSet.add(task.id);
            conflictSet.add(sched.taskId);
          }
        });

        userSchedules[person.id].push({ taskId: task.id, start: timeline.start, end: timeline.end });
      });
    });

    return conflictSet;
  }, [tasks, board.columns, selectedTimelineCol]);

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
                  onClick={() => { setTimeScale('months'); setZoomLevel(20); }}
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

        {/* Gantt Header (Months & Days) */}
        <div className="flex flex-col bg-white border-b border-border shrink-0 overflow-hidden">
          <div className="flex h-6 border-b border-slate-100">
             <div className={cn("border-r border-border shrink-0 bg-white z-20 transition-all duration-300 relative", sidebarCollapsed ? "w-[48px]" : "w-[300px]")}>
                {sidebarCollapsed && (
                   <button 
                      onClick={() => setSidebarCollapsed(false)}
                      className="absolute inset-0 flex items-center justify-center hover:bg-slate-50 text-slate-400 hover:text-blue-600 transition-colors"
                   >
                      <ChevronRight className="w-4 h-4" />
                   </button>
                )}
             </div>
             <div ref={headerMonthsRef} className="flex-1 flex overflow-x-hidden no-scrollbar relative">
                {months.map((m, idx) => (
                  <div 
                    key={idx} 
                    className="border-r border-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 uppercase bg-slate-50/30 relative overflow-hidden"
                    style={{ minWidth: m.daysCount * zoomLevel }}
                  >
                    <span className="sticky left-0 px-4 whitespace-nowrap z-10 w-full text-center">
                      {format(m.date, 'MMMM yyyy', { locale: ptBR })}
                    </span>
                  </div>
                ))}
             </div>
          </div>
          <div className="flex h-10">
            <div className={cn("border-r border-border flex items-center px-6 font-semibold text-[#323338] text-xs shrink-0 bg-white z-20 transition-all duration-300 relative", sidebarCollapsed ? "w-[48px]" : "w-[300px]")}>
               {!sidebarCollapsed ? (
                 <>
                   <span>Tarefa / Responsável</span>
                   <button 
                      onClick={() => setSidebarCollapsed(true)}
                      className="ml-auto p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600 transition-all"
                   >
                      <ChevronLeft className="w-4 h-4" />
                   </button>
                 </>
               ) : null}
            </div>
            <div ref={headerDaysRef} className="flex-1 flex overflow-x-hidden no-scrollbar relative">
               {days.map(day => (
                 <div 
                   key={day.toISOString()} 
                   className={cn(
                     "flex flex-col items-center justify-center border-r border-slate-100 text-[9px] shrink-0",
                     (day.getDay() === 0 || day.getDay() === 6) && "bg-slate-50/50"
                   )}
                   style={{ minWidth: zoomLevel }}
                 >
                    <span className="text-muted-foreground uppercase text-[7px]">{format(day, 'E', { locale: ptBR }).substring(0, 1)}</span>
                    <span className={cn("font-bold text-[10px]", isSameDay(day, today) && "text-blue-600")}>{format(day, 'd')}</span>
                 </div>
               ))}
            </div>
          </div>
        </div>

        {/* Gantt Matrix */}
        <div className="flex-1 flex overflow-hidden">
           {/* Left Sidebar Table */}
           <div className={cn("border-r border-border bg-white overflow-y-auto shrink-0 z-20 no-scrollbar transition-all duration-300", sidebarCollapsed ? "w-[48px]" : "w-[300px]")}>
              {board.groups.map(group => {
                const isGroupCollapsed = collapsedGroups.has(group.id);
                return (
                  <div key={group.id}>
                    <div 
                      className={cn("flex bg-slate-50 border-b border-border h-8 items-center px-4 cursor-pointer hover:bg-slate-100 transition-colors", sidebarCollapsed && "justify-center px-0")}
                      onClick={() => toggleGroup(group.id)}
                    >
                        {!sidebarCollapsed ? (
                          <div className="flex items-center gap-2 overflow-hidden">
                            <ChevronDown className={cn("w-3 h-3 text-slate-400 transition-transform", isGroupCollapsed && "-rotate-90")} />
                            <span className="text-[10px] font-bold uppercase tracking-wider truncate" style={{ color: group.color }}>{group.title}</span>
                          </div>
                        ) : (
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: group.color }} />
                        )}
                    </div>
                    {!isGroupCollapsed && group.tasks.map(task => {
                     const timeline = getTimeline(task);
                     const isConflict = conflicts.has(task.id);
                     return (
                        <div key={task.id} className={cn("flex flex-col justify-center px-6 h-14 border-b border-slate-50 group hover:bg-slate-50 transition-colors", sidebarCollapsed && "px-0 items-center")}>
                           {!sidebarCollapsed ? (
                             <>
                               <div className="flex items-center gap-2">
                                  <span className={cn("text-[12px] font-medium truncate", isConflict && "text-red-600")}>{task.name}</span>
                                  {isConflict && <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />}
                               </div>
                               <span className="text-[10px] text-muted-foreground">
                                  {timeline ? `${format(timeline.start, 'MMM d', { locale: ptBR })} - ${format(timeline.end, 'MMM d', { locale: ptBR })}` : 'Sem data'}
                               </span>
                             </>
                           ) : (
                             <div className={cn("w-2 h-2 rounded-full", isConflict ? "bg-red-500 animate-pulse" : "bg-slate-200")} />
                           )}
                        </div>
                     );
                    })}
                  </div>
                );
              })}
           </div>

           {/* Timeline Area */}
           <div ref={timelineRef} onScroll={handleScroll} className="flex-1 overflow-auto relative">
              <div className="absolute top-0 bottom-0 pointer-events-none z-10 w-0.5 bg-blue-500/80" style={{ left: todayX }}>
                 <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-500 rounded-full" />
              </div>

              {board.groups.map(group => {
                const isGroupCollapsed = collapsedGroups.has(group.id);
                return (
                  <div key={group.id}>
                    <div className="h-8 border-b border-slate-50" />
                    {!isGroupCollapsed && group.tasks.map(task => {
                      const timeline = getTimeline(task);
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
                                        "h-6 rounded-md shadow-sm z-10 flex items-center px-3 text-[10px] text-white font-medium group-hover:shadow-md transition-all relative overflow-visible",
                                        isConflict ? "bg-orange-500 animate-pulse-subtle" : (showCriticalPath && task.name.toLowerCase().includes('montagem') ? "bg-red-500" : "bg-blue-500"),
                                        showBaseline && "after:absolute after:bottom-[-4px] after:left-0 after:right-0 after:h-1 after:bg-blue-200 after:rounded-full"
                                     )}
                                     style={{
                                        left: `${Math.max(0, (timeline.start.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) * zoomLevel}px`,
                                        width: `${(timeline.end.getTime() - timeline.start.getTime()) / (1000 * 60 * 60 * 24) * zoomLevel + zoomLevel}px`
                                     }}
                                  >
                                     <div className="flex items-center gap-1.5 min-w-0">
                                        {isConflict && <AlertCircle className="w-3 h-3 text-white shrink-0" />}
                                        <span className="truncate">{task.name}</span>
                                     </div>
                                     
                                     {/* Bar Label (Always visible) */}
                                     <div className="absolute left-full ml-3 whitespace-nowrap text-[11px] text-[#676879] font-normal flex items-center gap-2 pointer-events-none">
                                        {getLabelValue(task)}
                                     </div>
                                  </div>
                               </div>
                            )}
                         </div>
                      );
                    })}
                  </div>
                );
              })}
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
                 <select 
                    value={selectedTimelineCol}
                    onChange={(e) => setSelectedTimelineCol(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                 >
                    {board.columns.filter(c => c.type === 'timeline').map(col => (
                      <option key={col.id} value={col.id}>{col.title}</option>
                    ))}
                 </select>
              </div>

              <div className="space-y-4">
                 <label className="text-xs font-bold text-muted-foreground uppercase">Etiquetar por</label>
                 <select 
                    value={labelByCol}
                    onChange={(e) => setLabelByCol(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                 >
                    <option value="">Nenhuma</option>
                    {board.columns.map(col => (
                      <option key={col.id} value={col.id}>{col.title}</option>
                    ))}
                 </select>
              </div>

              <div className="pt-4 space-y-4 border-t border-slate-100">
                 <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Caminho crítico</span>
                    <button 
                       onClick={() => setShowCriticalPath(!showCriticalPath)}
                       className={cn("w-10 h-5 rounded-full relative transition-colors", showCriticalPath ? "bg-red-500" : "bg-slate-200")}
                    >
                       <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all", showCriticalPath ? "right-1" : "left-1")} />
                    </button>
                 </div>
                 <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Linha de base</span>
                    <button 
                       onClick={() => setShowBaseline(!showBaseline)}
                       className={cn("w-10 h-5 rounded-full relative transition-colors", showBaseline ? "bg-blue-500" : "bg-slate-200")}
                    >
                       <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all", showBaseline ? "right-1" : "left-1")} />
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
