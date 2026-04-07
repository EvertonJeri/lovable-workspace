import { useMemo, useRef, useState } from 'react';
import { Board, TaskGroup } from '@/types/board';
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, isValid, isSameDay, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Minus, Plus, Calendar } from 'lucide-react';

interface GanttJobsViewProps {
  board: Board;
}

interface GroupBar {
  group: TaskGroup;
  deliveryDate: Date | null;
  daysUntilDelivery: number;
}

export default function GanttJobsView({ board }: GanttJobsViewProps) {
  const [zoomLevel, setZoomLevel] = useState(40);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [timeScale, setTimeScale] = useState<'days' | 'months'>('days');

  const headerMonthsRef = useRef<HTMLDivElement>(null);
  const headerDaysRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const startDate = useMemo(() => startOfMonth(addDays(today, -7)), []);
  const endDate = useMemo(() => addDays(startDate, 180), [startDate]);
  const days = useMemo(() => eachDayOfInterval({ start: startDate, end: endDate }), [startDate, endDate]);

  const months = useMemo(() => {
    const result: { date: Date; daysCount: number }[] = [];
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

  const todayX = useMemo(() => {
    return Math.max(0, (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) * zoomLevel;
  }, [today, startDate, zoomLevel]);

  // Find delivery date for each group: latest date column value among tasks
  const groupBars: GroupBar[] = useMemo(() => {
    const normalize = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').trim();

    // Find date columns (delivery date or any date column)
    const dateCol = board.columns.find(c => {
      const nt = normalize(c.title);
      return c.type === 'date' && (nt.includes('entr') || nt.includes('data') || nt.includes('delivery'));
    }) || board.columns.find(c => c.type === 'date');

    // Also check timeline columns for end date
    const timelineCol = board.columns.find(c => c.type === 'timeline');

    return board.groups
      .filter(g => !g.archived)
      .map(group => {
        let latestDate: Date | null = null;

        for (const task of group.tasks) {
          // Check date column
          if (dateCol) {
            const val = task.columnValues[dateCol.id];
            if (typeof val === 'string') {
              const d = parseISO(val);
              if (isValid(d) && (!latestDate || d > latestDate)) latestDate = d;
            }
          }

          // Check timeline end date
          if (timelineCol) {
            const val = task.columnValues[timelineCol.id];
            if (val && typeof val === 'object' && val.end) {
              const d = parseISO(val.end);
              if (isValid(d) && (!latestDate || d > latestDate)) latestDate = d;
            }
          }
        }

        return {
          group,
          deliveryDate: latestDate,
          daysUntilDelivery: latestDate ? differenceInDays(latestDate, today) : 0,
        };
      });
  }, [board.groups, board.columns]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollLeft = e.currentTarget.scrollLeft;
    if (headerMonthsRef.current) headerMonthsRef.current.scrollLeft = scrollLeft;
    if (headerDaysRef.current) headerDaysRef.current.scrollLeft = scrollLeft;
  };

  const groupColorMap: Record<string, string> = {
    blue: '#0073ea', green: '#00c875', purple: '#a25ddc', orange: '#fdab3d',
    red: '#e2445c', teal: '#00d2d2', indigo: '#5559df', pink: '#ff158a', grey: '#c4c4c4',
  };

  return (
    <div className="flex h-[calc(100vh-120px)] bg-[#F5F6F8] overflow-hidden relative">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 h-14 bg-white border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h2 className="text-sm font-bold text-[#323338]">Gantt de Jobs</h2>
            <span className="text-xs text-muted-foreground">
              {groupBars.length} grupo{groupBars.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-100 rounded-md p-0.5">
              <button
                className={cn('px-3 py-1 rounded text-[10px] font-bold transition-all', timeScale === 'days' ? 'bg-white shadow-sm text-blue-600' : 'text-[#676879]')}
                onClick={() => setTimeScale('days')}
              >DIAS</button>
              <button
                className={cn('px-3 py-1 rounded text-[10px] font-bold transition-all', timeScale === 'months' ? 'bg-white shadow-sm text-blue-600' : 'text-[#676879]')}
                onClick={() => { setTimeScale('months'); setZoomLevel(20); }}
              >MESES</button>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setZoomLevel(prev => Math.max(20, prev - 10))} className="p-1.5 hover:bg-slate-100 rounded-md"><Minus className="w-4 h-4 text-[#676879]" /></button>
              <button onClick={() => setZoomLevel(prev => Math.min(80, prev + 10))} className="p-1.5 hover:bg-slate-100 rounded-md"><Plus className="w-4 h-4 text-[#676879]" /></button>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="flex flex-col bg-white border-b border-border shrink-0 overflow-hidden">
          {/* Months row */}
          <div className="flex h-6 border-b border-slate-100">
            <div className={cn('border-r border-border shrink-0 bg-white z-20 transition-all duration-300', sidebarCollapsed ? 'w-[48px]' : 'w-[320px]')}>
              {sidebarCollapsed && (
                <button onClick={() => setSidebarCollapsed(false)} className="w-full h-full flex items-center justify-center hover:bg-slate-50 text-slate-400 hover:text-blue-600">
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
            <div ref={headerMonthsRef} className="flex-1 flex overflow-x-hidden no-scrollbar">
              {months.map((m, idx) => (
                <div key={idx} className="border-r border-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 uppercase bg-slate-50/30" style={{ minWidth: m.daysCount * zoomLevel }}>
                  {format(m.date, 'MMMM yyyy', { locale: ptBR })}
                </div>
              ))}
            </div>
          </div>
          {/* Days row */}
          <div className="flex h-10">
            <div className={cn('border-r border-border flex items-center px-6 font-semibold text-[#323338] text-xs shrink-0 bg-white z-20 transition-all duration-300', sidebarCollapsed ? 'w-[48px]' : 'w-[320px]')}>
              {!sidebarCollapsed && (
                <>
                  <span>Grupo / Job</span>
                  <button onClick={() => setSidebarCollapsed(true)} className="ml-auto p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
            <div ref={headerDaysRef} className="flex-1 flex overflow-x-hidden no-scrollbar">
              {days.map(day => (
                <div
                  key={day.toISOString()}
                  className={cn('flex flex-col items-center justify-center border-r border-slate-100 text-[9px] shrink-0', (day.getDay() === 0 || day.getDay() === 6) && 'bg-slate-50/50')}
                  style={{ minWidth: zoomLevel }}
                >
                  <span className="text-muted-foreground uppercase text-[7px]">{format(day, 'E', { locale: ptBR }).substring(0, 1)}</span>
                  <span className={cn('font-bold text-[10px]', isSameDay(day, today) && 'text-blue-600')}>{format(day, 'd')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Gantt Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div className={cn('border-r border-border bg-white overflow-y-auto shrink-0 z-20 no-scrollbar transition-all duration-300', sidebarCollapsed ? 'w-[48px]' : 'w-[320px]')}>
            {groupBars.map(({ group, deliveryDate, daysUntilDelivery }) => {
              const color = groupColorMap[group.color] || '#0073ea';
              const isOverdue = deliveryDate && daysUntilDelivery < 0;
              return (
                <div key={group.id} className="flex items-center h-16 border-b border-slate-100 hover:bg-slate-50 transition-colors px-4 gap-3">
                  {sidebarCollapsed ? (
                    <div className="w-3 h-3 rounded-full mx-auto" style={{ backgroundColor: color }} />
                  ) : (
                    <>
                      <div className="w-3 h-10 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-[12px] font-bold text-[#323338] truncate">{group.title}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">
                            {deliveryDate ? format(deliveryDate, 'dd MMM yyyy', { locale: ptBR }) : 'Sem data'}
                          </span>
                          {deliveryDate && (
                            <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full', isOverdue ? 'bg-red-100 text-red-600' : daysUntilDelivery <= 7 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700')}>
                              {isOverdue ? `${Math.abs(daysUntilDelivery)}d atraso` : `${daysUntilDelivery}d restantes`}
                            </span>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Timeline */}
          <div ref={timelineRef} onScroll={handleScroll} className="flex-1 overflow-auto relative">
            {/* Today line */}
            <div className="absolute top-0 bottom-0 pointer-events-none z-10 w-0.5 bg-blue-500/80" style={{ left: todayX }}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-500 rounded-full" />
            </div>

            {groupBars.map(({ group, deliveryDate }) => {
              const color = groupColorMap[group.color] || '#0073ea';

              // Bar from today to delivery date
              const barStart = today;
              const barEnd = deliveryDate;

              if (!barEnd) {
                return (
                  <div key={group.id} className="h-16 border-b border-slate-50 relative flex items-center">
                    <div className="absolute inset-0 flex">
                      {days.map(day => (
                        <div key={day.toISOString()} style={{ minWidth: zoomLevel }} className="border-r border-slate-50 shrink-0" />
                      ))}
                    </div>
                    <div className="absolute text-[10px] text-muted-foreground italic" style={{ left: todayX + 8 }}>
                      Sem data de entrega
                    </div>
                  </div>
                );
              }

              const isOverdue = barEnd < barStart;
              const displayStart = isOverdue ? barEnd : barStart;
              const displayEnd = isOverdue ? barStart : barEnd;

              const leftPx = Math.max(0, (displayStart.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) * zoomLevel;
              const widthPx = Math.max(zoomLevel, ((displayEnd.getTime() - displayStart.getTime()) / (1000 * 60 * 60 * 24)) * zoomLevel);
              const totalDays = Math.abs(differenceInDays(barEnd, barStart));

              return (
                <div key={group.id} className="h-16 border-b border-slate-50 relative flex items-center group/bar">
                  {/* Grid */}
                  <div className="absolute inset-0 flex">
                    {days.map(day => (
                      <div key={day.toISOString()} style={{ minWidth: zoomLevel }} className="border-r border-slate-50 shrink-0" />
                    ))}
                  </div>

                  {/* Bar */}
                  <div
                    className={cn(
                      'absolute h-9 rounded-lg shadow-sm z-10 flex items-center px-4 text-white font-semibold text-[11px] transition-all group-hover/bar:shadow-lg group-hover/bar:brightness-110',
                      isOverdue && 'opacity-60'
                    )}
                    style={{
                      left: leftPx,
                      width: widthPx,
                      backgroundColor: isOverdue ? '#e2445c' : color,
                      background: isOverdue
                        ? `repeating-linear-gradient(45deg, #e2445c, #e2445c 10px, #c93a50 10px, #c93a50 20px)`
                        : `linear-gradient(135deg, ${color}, ${color}dd)`,
                    }}
                  >
                    <span className="truncate">{group.title}</span>
                    <span className="ml-auto text-[9px] opacity-80 shrink-0 pl-2">
                      {totalDays}d
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
