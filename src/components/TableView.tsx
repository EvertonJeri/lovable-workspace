import { useState, useRef, useEffect } from 'react';
import { Board, Task, GroupColor, STATUS_LABELS, PRIORITY_LABELS, BoardColumn, TaskGroup, ColumnType } from '@/types/board';
import { 
  ChevronDown, GripVertical, Plus, MessageCircle, Star, MoreHorizontal, Check, UserPlus, Trash2, Pencil, HelpCircle, 
  Archive, Copy, ArrowRight, ArrowLeft, X, Hash, Percent, DollarSign, Calendar as CalendarIcon, User, Info, AlertCircle, Settings, Download, Box,
  Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO, isValid, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DayPicker, DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { Calendar } from '@/components/ui/calendar';
import { evaluateFormula } from '@/lib/formula';
import FormulaDialog from './FormulaDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const groupColorHex: Record<GroupColor, string> = {
  blue: '#0073ea', green: '#00c875', purple: '#a25ddc', orange: '#fdab3d', red: '#e2445c',
  teal: '#11ddbe', indigo: '#5559df', pink: '#ff5ac4', grey: '#c4c4c4',
};

const statusColors: Record<string, string> = {
  done: '#00c875', working: '#fdab3d', stuck: '#e2445c', done_soon: '#00c875', default: '#c4c4c4',
};

const priorityColors: Record<string, string> = {
  critical: '#333333', high: '#e2445c', medium: '#5559df', low: '#579bfc', default: '#c4c4c4'
};

const columnIcons: Record<string, React.ElementType> = {
  status: Check, priority: AlertCircle, person: User, timeline: CalendarIcon,
  number: Hash, progress: Percent, formula: HelpCircle, text: Info
};

interface TableViewProps {
  board: Board; onTaskClick: (task: Task) => void; onAddTask: (groupId?: string) => void;
  onAddGroup: () => void; onRenameGroup: (groupId: string, title: string) => void;
  onDeleteGroup: (groupId: string) => void; onArchiveGroup: (groupId: string) => void;
  onDuplicateGroup: (groupId: string) => void;
  onUpdateGroupBudget: (groupId: string, budget: number) => void;
  onAddColumn: (type: ColumnType, title: string) => void; onUpdateColumn: (columnId: string, updates: Partial<BoardColumn>) => void;
  onRemoveColumn: (columnId: string) => void; onMoveColumn?: (columnId: string, direction: 'left' | 'right') => void;
  onDeleteTask: (taskId: string) => void;
  onDuplicateTask: (taskId: string) => void; onArchiveTask: (taskIds: string[]) => void;
  onUpdateTask: (task: Task) => void; searchTerm: string;
  collapsedGroups: Set<string>; onToggleGroup: (id: string) => void;
  teamMembers?: any[];
}

export default function TableView({ 
  board, onTaskClick, onAddTask, onAddGroup, onRenameGroup, onDeleteGroup, onArchiveGroup, onDuplicateGroup, onUpdateGroupBudget,
  onAddColumn, onUpdateColumn, onRemoveColumn, onMoveColumn, onDeleteTask, onDuplicateTask,
  onArchiveTask, onUpdateTask, searchTerm, collapsedGroups, onToggleGroup,
  teamMembers = []
}: TableViewProps) {
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [editingFormula, setEditingFormula] = useState<BoardColumn | null>(null);
  const [editingCell, setEditingCell] = useState<{taskId: string, colId: string} | null>(null);
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<any>('');

  const colInputRef = useRef<HTMLInputElement>(null);
  const groupInputRef = useRef<HTMLInputElement>(null);
  const taskInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingColumn && colInputRef.current) {
      colInputRef.current.focus();
      colInputRef.current.select();
    }
  }, [editingColumn]);

  useEffect(() => {
    if (editingGroup && groupInputRef.current) {
      groupInputRef.current.focus();
      groupInputRef.current.select();
    }
  }, [editingGroup]);

  useEffect(() => {
    if (editingTask && taskInputRef.current) {
      taskInputRef.current.focus();
      taskInputRef.current.select();
    }
  }, [editingTask]);

  const filteredGroups = board.groups.map(group => ({
    ...group,
    tasks: group.tasks.filter(task => 
      !searchTerm || task.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      Object.values(task.columnValues).some(v => typeof v === 'string' && v.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  })).filter(g => (g.tasks.length > 0 || !searchTerm) && !g.archived);

  const calculateSummary = (group: TaskGroup, column: BoardColumn) => {
    let values: any[] = [];
    if (column.type === 'formula') {
      values = group.tasks.map(t => evaluateFormula(column.formulaExpr || '', t, board.columns));
    } else {
      values = group.tasks.map(t => t.columnValues[column.id]).filter(v => v !== undefined && v !== null);
    }
    
    if (column.type === 'status' || column.type === 'progress' || column.title.toLowerCase().includes('%') || column.type === 'priority') {
      if (column.type === 'status' || column.type === 'priority') {
        const counts: Record<string, number> = {};
        values.forEach(v => {
          const s = String(v || 'default');
          counts[s] = (counts[s] || 0) + 1;
        });
        const total = values.length;
        if (total === 0) return <div className="w-full h-4 bg-slate-100/50 rounded-sm mx-2" />;
        const colorMap = column.type === 'status' ? statusColors : priorityColors;
        
        return (
          <div className="w-full px-2">
            <div className="w-full h-4 flex rounded-sm overflow-hidden bg-slate-100 shadow-inner">
              {Object.entries(counts).map(([key, count]) => (
                <div 
                  key={key} 
                  style={{ 
                    width: `${(count / total) * 100}%`, 
                    backgroundColor: colorMap[key] || colorMap.default 
                  }} 
                  className="h-full border-r border-white/20 last:border-none"
                />
              ))}
            </div>
          </div>
        );
      } else {
        const numericValues = values.map(v => typeof v === 'number' ? v : parseFloat(String(v)) || 0).filter(v => !isNaN(v));
        const avg = numericValues.length > 0 ? numericValues.reduce((a, b) => a + b, 0) / numericValues.length : 0;
        return (
           <div className="w-full px-2 flex flex-col gap-1 items-center">
             <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden shadow-inner w-3/4">
               <div className={cn("h-full transition-all", avg >= 100 ? "bg-green-500" : "bg-blue-500")} style={{ width: `${Math.min(avg, 100)}%` }} />
             </div>
             <span className="text-[10px] font-bold text-slate-500">{new Intl.NumberFormat('pt-BR').format(avg)}%</span>
           </div>
        );
      }
    }

    let result: number | string = 0;
    const numericValues = values.map(v => typeof v === 'number' ? v : parseFloat(String(v)) || 0).filter(v => !isNaN(v));
    const summaryType = column.summaryType || 'none';
    
    switch (summaryType) {
      case 'sum': result = numericValues.reduce((a, b) => a + b, 0); break;
      case 'avg': result = numericValues.length > 0 ? numericValues.reduce((a, b) => a + b, 0) / numericValues.length : 0; break;
      case 'count': result = values.length; break;
      case 'min': result = numericValues.length > 0 ? Math.min(...numericValues) : 0; break;
      case 'max': result = numericValues.length > 0 ? Math.max(...numericValues) : 0; break;
      default: result = 0;
    }

    const formatted = new Intl.NumberFormat('pt-BR').format(result as number);
    const labelMap: any = { sum: 'Total', avg: 'Média', count: 'Contagem', min: 'Mín.', max: 'Máx.', none: 'Cálculo' };
    
    return (
      <Popover>
        <PopoverTrigger asChild>
          <div className="flex flex-col items-center justify-center -space-y-0.5 w-full h-full cursor-pointer hover:bg-slate-200/50 transition-colors py-1 group/summary min-h-[44px]">
             {summaryType !== 'none' ? (
                <>
                  <span className="text-[12px] text-[#323338] font-bold">
                    {column.unit === 'R$' ? `${formatted} R$` : column.unit === '%' ? `${formatted}%` : formatted}
                  </span>
                  <span className="text-[9px] uppercase text-muted-foreground font-semibold">{labelMap[summaryType]}</span>
                </>
             ) : (
                <div className="opacity-0 group-hover/summary:opacity-100 transition-opacity">
                   <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </div>
             )}
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4 bg-white border border-slate-200 shadow-2xl rounded-xl z-[100]" onClick={e => e.stopPropagation()}>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Unidade</label>
              </div>
              <div className="flex flex-wrap gap-1">
                {['none', '$', '€', '£', '%'].map(unit => (
                  <button key={unit} onClick={() => onUpdateColumn(column.id, { unit: unit === 'none' ? undefined : unit })} className={cn("px-2 py-1.5 text-xs rounded border transition-all", ((!column.unit && unit === 'none') || column.unit === unit) ? "bg-blue-600 border-blue-600 text-white font-bold" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50")}>
                    {unit === 'none' ? 'Nenhum' : unit}
                  </button>
                ))}
                <input placeholder="Personalizado" className="flex-1 px-2 py-1.5 text-xs rounded border border-slate-200" onChange={e => onUpdateColumn(column.id, { unit: e.target.value })} value={column.unit && !['$', '€', '£', '%'].includes(column.unit) ? column.unit : ''} />
              </div>
            </div>
            <DropdownMenuSeparator className="bg-slate-100" />
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight mb-2 block">Cálculo</label>
              <div className="flex flex-wrap gap-1">
                {['none', 'sum', 'avg', 'min', 'max', 'count'].map(type => (
                  <button key={type} onClick={() => onUpdateColumn(column.id, { summaryType: type as any })} className={cn("px-3 py-1.5 text-xs rounded border transition-all", summaryType === type ? "bg-blue-600 border-blue-600 text-white font-bold" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50")}>
                    {labelMap[type] || 'Nenhum'}
                  </button>
                ))}
              </div>
            </div>
            {(column.unit === 'R$' || column.title.toLowerCase().includes('orç')) && (
              <>
                <DropdownMenuSeparator className="bg-slate-100" />
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight mb-2 block">Ratear Fixo para Tarefas</label>
                  <div className="flex gap-2">
                    <input 
                      type="number" 
                      placeholder="Ex: 50000" 
                      className="flex-1 px-2 py-1.5 text-xs rounded border border-slate-200" 
                      defaultValue={group.budget || ''}
                      onKeyDown={e => {
                         if (e.key === 'Enter') {
                            const num = parseFloat(e.currentTarget.value);
                            if (!isNaN(num)) onUpdateGroupBudget(group.id, num);
                            document.body.click(); // Close popover
                         }
                      }}
                    />
                    <button 
                      className="px-3 py-1.5 text-xs rounded bg-emerald-600 text-white font-bold hover:bg-emerald-700"
                      onClick={(e) => {
                         const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                         const num = parseFloat(input.value);
                         if (!isNaN(num)) onUpdateGroupBudget(group.id, num);
                         document.body.click(); // Close popover
                      }}
                    >Aplicar</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  const renderCell = (task: Task, column: BoardColumn) => {
    const value = task.columnValues[column.id];
    const isEditing = editingCell?.taskId === task.id && editingCell?.colId === column.id;

    if (column.type === 'formula') {
      const result = evaluateFormula(column.formulaExpr || '', task, board.columns);
      return (
        <div className="px-4 py-2 text-sm font-medium text-blue-600 w-full h-full flex items-center justify-center cursor-pointer hover:bg-blue-100/30 transition-colors group/formula" onClick={e => { e.stopPropagation(); setEditingFormula(column); }}>
          {result === 'Error' ? <HelpCircle className="w-4 h-4 text-red-400" /> : result ?? '—'}
        </div>
      );
    }

    switch (column.type) {
      case 'status':
        return (
          <div className="h-full w-full group/status">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="h-full w-full flex items-center justify-center text-white font-semibold px-2 text-center text-xs cursor-pointer shadow-sm transition-all hover:brightness-95" style={{ backgroundColor: statusColors[value as string] || statusColors.default }} onClick={e => e.stopPropagation()}>
                  {STATUS_LABELS[value as string as keyof typeof STATUS_LABELS] || 'Fazer'}
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48 p-1 bg-white border border-slate-100 shadow-xl rounded-lg z-[100]">
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <DropdownMenuItem key={key} className="flex items-center gap-2 p-2 text-xs font-bold text-white mb-1 rounded-md cursor-pointer" style={{ backgroundColor: statusColors[key] || statusColors.default }} onClick={e => { e.stopPropagation(); onUpdateTask({ ...task, columnValues: { ...task.columnValues, [column.id]: key } }); }}>
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      case 'priority':
        return (
          <div className="h-full w-full group/priority">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="h-full w-full flex items-center justify-center text-white font-semibold px-2 text-center text-xs cursor-pointer shadow-sm transition-all hover:brightness-95" style={{ backgroundColor: priorityColors[value as string] || priorityColors.default }} onClick={e => e.stopPropagation()}>
                  {PRIORITY_LABELS[value as string as keyof typeof PRIORITY_LABELS] || 'Urgente'}
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48 p-1 bg-white border border-slate-100 shadow-xl rounded-lg z-[100]">
                {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
                  <DropdownMenuItem key={key} className="flex items-center gap-2 p-2 text-xs font-bold text-white mb-1 rounded-md cursor-pointer" style={{ backgroundColor: priorityColors[key] || priorityColors.default }} onClick={e => { e.stopPropagation(); onUpdateTask({ ...task, columnValues: { ...task.columnValues, [column.id]: key } }); }}>
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      case 'person':
        const persons = Array.isArray(value) ? value : [];
        return (
          <div className="w-full h-full flex items-center justify-center gap-1 cursor-pointer hover:bg-slate-50 transition-colors px-2" onClick={e => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="flex -space-x-2 items-center justify-center min-w-[40px] min-h-[30px]">
                  {persons.length > 0 ? (
                    persons.map((p: any) => (
                      <div key={p.id} className="w-7 h-7 rounded-full border-2 border-white bg-cover bg-center shadow-sm" style={{ backgroundImage: `url(${p.avatar})` }} title={p.name} />
                    ))
                  ) : <UserPlus className="w-5 h-5 text-slate-300 hover:text-blue-500" />}
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 p-0 bg-white border border-slate-100 shadow-2xl rounded-xl z-[100] max-h-[400px] overflow-hidden flex flex-col">
                <div className="p-2 border-b border-slate-50">
                  <input 
                    autoFocus 
                    placeholder="Pesquisar pessoa..." 
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-100 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20"
                    onChange={(e) => setEditValue(e.target.value)}
                    value={editValue}
                  />
                </div>
                <div className="overflow-y-auto flex-1">
                  <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 mb-1">Membros da Equipe</div>
                  {teamMembers.length > 0 ? teamMembers.filter(m => !editValue || m.name.toLowerCase().includes(String(editValue).toLowerCase())).map((member) => (
                    <DropdownMenuCheckboxItem
                      key={member.id}
                      className="flex items-center gap-3 p-2 text-sm hover:bg-slate-50 cursor-pointer rounded-lg transition-colors"
                      checked={persons.some((p: any) => p.id === member.id)}
                      onCheckedChange={(checked) => {
                        let newPersons = [...persons];
                        if (checked) {
                          if (!newPersons.some(p => p.id === member.id)) newPersons.push(member);
                        } else {
                          newPersons = newPersons.filter(p => p.id !== member.id);
                        }
                        onUpdateTask({ ...task, columnValues: { ...task.columnValues, [column.id]: newPersons } });
                      }}
                    >
                      <div className="w-6 h-6 rounded-full bg-cover bg-center" style={{ backgroundImage: `url(${member.avatar})` }} />
                      <div className="flex flex-col">
                        <span className="font-bold text-[#323338]">{member.name}</span>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">{member.role}</span>
                      </div>
                    </DropdownMenuCheckboxItem>
                  )) : (
                    <div className="p-4 text-center">
                      <p className="text-xs text-slate-500 mb-2">Nenhum membro encontrado</p>
                    </div>
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      case 'timeline':
        try {
          const timeline = value as any;
          const timelineText = (timeline?.start && isValid(parseISO(timeline.start))) 
            ? `${format(parseISO(timeline.start), 'dd MMM')} - ${timeline.end && isValid(parseISO(timeline.end)) ? format(parseISO(timeline.end), 'dd MMM') : '?'}` 
            : '—';
          
          return (
            <div className="w-full h-full flex items-center justify-center px-2">
              <Popover>
                <PopoverTrigger asChild>
                  <div 
                    className={cn(
                      "px-4 py-1.5 rounded-full text-[11px] font-bold shadow-sm w-full text-center cursor-pointer transition-all hover:scale-105", 
                      timeline?.start ? "bg-[#333333] text-white" : "bg-slate-100 text-slate-400 border border-slate-200"
                    )}
                    onClick={e => e.stopPropagation()}
                  >
                    {timelineText}
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4 bg-white border border-slate-200 shadow-2xl rounded-xl z-[100]" align="center" onClick={e => e.stopPropagation()}>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Início</label>
                        <input 
                          className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs font-medium" 
                          placeholder="Data de início" 
                          value={timeline?.start ? format(parseISO(timeline.start), 'yyyy-MM-dd') : ''}
                          readOnly
                        />
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 mt-4" />
                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Término</label>
                        <input 
                          className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs font-medium" 
                          placeholder="Data de término" 
                          value={timeline?.end ? format(parseISO(timeline.end), 'yyyy-MM-dd') : ''}
                          readOnly
                        />
                      </div>
                    </div>
                    
                    <div className="border border-slate-100 rounded-lg p-2 bg-slate-50/30">
                      <DayPicker
                        mode="range"
                        locale={ptBR}
                        selected={timeline?.start && isValid(parseISO(timeline.start)) ? { from: parseISO(timeline.start), to: (timeline.end && isValid(parseISO(timeline.end))) ? parseISO(timeline.end) : undefined } : undefined}
                        onSelect={(range: DateRange | undefined) => {
                          if (range?.from) {
                             onUpdateTask({ 
                               ...task, 
                               columnValues: { 
                                 ...task.columnValues, 
                                 [column.id]: { 
                                   start: range.from.toISOString(), 
                                   end: range.to ? range.to.toISOString() : range.from.toISOString() 
                                 } 
                               } 
                             });
                          }
                        }}
                        styles={{
                          caption: { color: '#323338', fontWeight: 'bold' },
                          head_cell: { color: '#676879', fontSize: '11px', fontWeight: 'bold' }
                        }}
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          );
        } catch (e) {
          console.warn('Timeline render error:', e);
          return <div className="text-red-500 text-[10px]"><CalendarIcon className="w-3 h-3 inline mr-1" /> Erro Data</div>;
        }
      case 'date':
        const dateVal = value as string;
        const formattedDate = dateVal && isValid(parseISO(dateVal)) 
          ? format(parseISO(dateVal), 'dd MMM yyyy', { locale: ptBR }) 
          : null;
        
        return (
          <div className="w-full h-full flex items-center justify-center px-2">
            <Popover>
              <PopoverTrigger asChild>
                <div 
                  className={cn(
                    "px-3 py-1 rounded-md text-[12px] font-medium w-full text-center cursor-pointer transition-all hover:bg-slate-100 border border-transparent hover:border-slate-200 flex items-center justify-center gap-2", 
                    dateVal ? "text-[#323338]" : "text-slate-400"
                  )}
                  onClick={e => e.stopPropagation()}
                >
                  {formattedDate ? (
                    <span>{formattedDate}</span>
                  ) : (
                    <CalendarIcon className="w-4 h-4 text-slate-300 group-hover:text-blue-500" />
                  )}
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-white border border-slate-200 shadow-2xl rounded-xl z-[200]" align="center" onClick={e => e.stopPropagation()}>
                <Calendar
                  mode="single"
                  selected={dateVal ? parseISO(dateVal) : undefined}
                  onSelect={(date) => {
                    if (date) {
                      onUpdateTask({ 
                        ...task, 
                        columnValues: { 
                          ...task.columnValues, 
                          [column.id]: format(date, 'yyyy-MM-dd') 
                        } 
                      });
                    }
                  }}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        );
      case 'number':
        if (isEditing) {
          return <input type="number" ref={colInputRef} className="w-full h-full px-2 text-[12px] border-2 border-blue-500 focus:outline-none" value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={() => { 
            if (editingCell) {
              onUpdateTask({ ...task, columnValues: { ...task.columnValues, [column.id]: parseFloat(editValue) || null } }); 
              setEditingCell(null); 
            }
          }} onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} />;
        }
        const numValue = typeof value === 'number' ? value : parseFloat(String(value));
        const isInvalid = isNaN(numValue) || value === null;
        return <div className="w-full h-full flex items-center justify-center cursor-text hover:bg-slate-50/50" onClick={e => { e.stopPropagation(); setEditValue(task.columnValues[column.id] || ''); setEditingCell({taskId: task.id, colId: column.id}); }}>
          {isInvalid ? '—' : `${new Intl.NumberFormat('pt-BR').format(numValue)}${column.unit === 'R$' ? ' R$' : column.unit === '%' ? '%' : ''}`}
        </div>;
      case 'formula':
        const formulaResult = column.formulaExpr ? evaluateFormula(column.formulaExpr, task, board.columns) : '';
        const numResult = typeof formulaResult === 'number' ? formulaResult : parseFloat(String(formulaResult));
        const showAsNum = !isNaN(numResult) && formulaResult !== 'Error' && formulaResult !== '';
        return (
          <div className="w-full h-full flex items-center justify-center bg-blue-50/20 text-blue-700 font-medium" onClick={e => e.stopPropagation()}>
            {showAsNum 
              ? `${new Intl.NumberFormat('pt-BR').format(numResult)}${column.unit === 'R$' ? ' R$' : column.unit === '%' ? '%' : ''}` 
              : String(formulaResult || '')}
          </div>
        );
      default:
        if (isEditing) {
          return <input ref={colInputRef} className="w-full h-full px-4 text-[12px] border-2 border-blue-500 focus:outline-none" value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={() => { 
            if (editingCell) {
              onUpdateTask({ ...task, columnValues: { ...task.columnValues, [column.id]: editValue } }); 
              setEditingCell(null); 
            }
          }} onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} />;
        }
        const progress = (value as number) || 0;
        if (column.type === 'progress' || column.title.toLowerCase().includes('%')) {
           return <div className="w-full h-full px-3 flex flex-col justify-center gap-1 cursor-pointer hover:bg-slate-50 transition-colors" onClick={e => { e.stopPropagation(); setEditValue(value || 0); setEditingCell({taskId: task.id, colId: column.id}); }}>
             <div className="flex justify-between text-[10px] text-muted-foreground font-bold"><span>{progress}%</span></div>
             <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden shadow-inner"><div className={cn("h-full transition-all", progress >= 100 ? "bg-green-500" : "bg-blue-500")} style={{ width: `${progress}%` }} /></div>
           </div>;
        }
        return <div className="w-full h-full px-4 truncate text-[12px] flex items-center cursor-text hover:bg-slate-50/50" onClick={e => { e.stopPropagation(); setEditValue(value || ''); setEditingCell({taskId: task.id, colId: column.id}); }}>{String(value || '')}</div>;
    }
  };

  return (
    <div className="flex-1 overflow-x-auto bg-[#F5F6F8] min-h-screen relative">
      <div className="inline-block min-w-full align-middle pt-4 px-6 pb-20">
        {filteredGroups.map((group) => {
          const collapsed = collapsedGroups.has(group.id);
          const color = groupColorHex[group.color];
          return (
            <div key={group.id} className="mb-10 last:mb-20">
              <div className={cn("flex items-stretch bg-white border-y border-r border-[#e6e9ef] mb-1 sticky left-0 group min-h-[52px]", collapsed ? "border-l-[6px]" : "border-none shadow-sm")} style={collapsed ? { borderLeftColor: color } : {}}>
                <div className="w-10 flex items-center justify-center shrink-0 border-r border-[#e6e9ef]">
                  <button onClick={() => onToggleGroup(group.id)} className="p-1 hover:bg-black/5 rounded transition-colors">
                    <ChevronDown className={cn("w-5 h-5 transition-transform text-[#676879]", collapsed && "-rotate-90")} />
                  </button>
                </div>
                <div 
                  className="flex-[1.5] min-w-[240px] flex flex-col justify-center px-4 border-r border-[#e6e9ef] min-h-[52px] cursor-pointer hover:bg-slate-50/50 select-none" 
                  onDoubleClick={() => { 
                    setEditValue(group.title); 
                    setEditingGroup(group.id); 
                  }}
                >
                  <div className="flex items-center justify-between w-full h-[28px]">
                    {editingGroup === group.id ? (
                      <input 
                        ref={groupInputRef}
                        className="text-[18px] font-bold outline-none border-b-2 border-blue-500 w-full bg-white p-0 m-0 leading-tight" 
                        value={editValue} 
                        onChange={e => setEditValue(e.target.value)} 
                        onBlur={() => { 
                          if (editingGroup) {
                            onRenameGroup(group.id, editValue); 
                            setEditingGroup(null); 
                          }
                        }} 
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            onRenameGroup(group.id, editValue);
                            setEditingGroup(null);
                          }
                          if (e.key === 'Escape') setEditingGroup(null);
                        }} 
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <h2 
                        className="text-[18px] font-bold truncate leading-tight tracking-tight hover:text-blue-600 transition-colors" 
                        style={!searchTerm ? { color } : {}} 
                      >
                        {group.title}
                      </h2>
                    )}
                    
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ml-2">
                       <DropdownMenu>
                         <DropdownMenuTrigger asChild>
                           <button className="p-1 hover:bg-black/5 rounded transition-colors" onClick={e => e.stopPropagation()}>
                             <MoreHorizontal className="w-5 h-5 text-slate-400" />
                           </button>
                         </DropdownMenuTrigger>
                         <DropdownMenuContent align="end" className="w-48 bg-white border border-slate-100 shadow-xl rounded-lg p-1 z-[110]">
                           <DropdownMenuItem className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold hover:bg-slate-50 rounded-md cursor-pointer text-slate-600" onClick={(e) => { e.stopPropagation(); setEditValue(group.title); setEditingGroup(group.id); }}>
                             <Pencil className="w-4 h-4" /> Renomear Grupo
                           </DropdownMenuItem>
                           <DropdownMenuItem className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold hover:bg-slate-50 rounded-md cursor-pointer text-slate-600" onClick={(e) => { e.stopPropagation(); const v = window.prompt('Defina o Orçamento Total deste grupo para rateio dinâmico das tarefas:', String(group.budget || '')); if (v !== null) { const num = parseFloat(v); if (!isNaN(num)) onUpdateGroupBudget(group.id, num); } }}>
                             <DollarSign className="w-4 h-4" /> Orçamento Fixo
                           </DropdownMenuItem>
                           <DropdownMenuItem className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold hover:bg-slate-50 rounded-md cursor-pointer text-slate-600" onClick={(e) => { e.stopPropagation(); onDuplicateGroup(group.id); }}>
                             <Copy className="w-4 h-4" /> Duplicar Grupo
                           </DropdownMenuItem>
                           <DropdownMenuItem className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold hover:bg-slate-50 rounded-md cursor-pointer text-slate-600" onClick={(e) => { e.stopPropagation(); onArchiveGroup(group.id); }}>
                             <Archive className="w-4 h-4" /> Arquivar Grupo
                           </DropdownMenuItem>
                           <DropdownMenuSeparator className="bg-slate-50" />
                           <DropdownMenuItem className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold hover:bg-red-50 rounded-md cursor-pointer text-red-500" onClick={(e) => { e.stopPropagation(); onDeleteGroup(group.id); }}>
                             <Trash2 className="w-4 h-4" /> Excluir Grupo
                           </DropdownMenuItem>
                         </DropdownMenuContent>
                       </DropdownMenu>
                    </div>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1"><Info className="w-3 h-3" /> {group.tasks.length} elemento{group.tasks.length !== 1 ? 's' : ''}</span>
                </div>
                {collapsed && board.columns.map(col => (
                  <div key={col.id} className="border-r border-[#e6e9ef] flex items-center justify-center shrink-0 bg-[#FBFCFD]" style={{ width: col.width || 140, minWidth: col.width || 140 }}>
                    {calculateSummary(group, col)}
                  </div>
                ))}
                {collapsed && <div className="flex-1 bg-[#FBFCFD]" />}
              </div>

              {!collapsed && (
                <div 
                  className="grid border-l-[6px] rounded-sm shadow-md overflow-x-auto bg-[#F8F9FA]" 
                  style={{ 
                    borderLeftColor: color,
                    gridTemplateColumns: `40px 240px ${board.columns.map(c => `minmax(${c.width || 120}px, max-content)`).join(' ')} 1fr`,
                    display: 'grid'
                  }}
                >
                  {/* HEADER ROW */}
                  <div className="contents bg-[#F8F9FA] text-[12px] text-[#676879] uppercase tracking-wider font-bold">
                    <div className="border-r border-y border-[#e6e9ef] flex items-center justify-center h-10 sticky top-0 z-10 bg-[#F8F9FA]"><div className="w-4 h-4 border border-[#c3c6cd] rounded-sm bg-white" /></div>
                    <div className="border-r border-y border-[#e6e9ef] flex items-center px-4 text-[#323338] h-10 sticky top-0 z-10 bg-[#F8F9FA]">Tarefa</div>
                    {board.columns.map(col => (
                        <div 
                          key={col.id} 
                          className="border-r border-y border-[#e6e9ef] flex items-center justify-between px-3 gap-2 cursor-pointer hover:bg-[#EBEDF0] transition-colors relative group/col h-10 sticky top-0 z-10 bg-[#F8F9FA] select-none whitespace-nowrap" 
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setEditValue(col.title);
                            setEditingColumn(col.id);
                          }}
                        >
                            {editingColumn === col.id ? (
                              <input
                                ref={colInputRef}
                                className="text-[12px] font-bold text-[#323338] bg-white border border-blue-500 rounded px-2 py-1 w-full outline-none ring-2 ring-blue-200"
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onBlur={() => {
                                  if (editValue.trim() && editValue.trim() !== col.title) {
                                    onUpdateColumn(col.id, { title: editValue.trim() });
                                  }
                                  setEditingColumn(null);
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    if (editValue.trim() && editValue.trim() !== col.title) {
                                      onUpdateColumn(col.id, { title: editValue.trim() });
                                    }
                                    setEditingColumn(null);
                                  }
                                  if (e.key === 'Escape') {
                                    setEditingColumn(null);
                                  }
                                }}
                                onClick={e => e.stopPropagation()}
                              />
                            ) : (
                              <div className="flex items-center gap-1.5 pointer-events-none">
                                <span className="font-bold text-[#323338]">{col.title}</span>
                              </div>
                            )}

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="opacity-0 group-hover/col:opacity-100 p-1 hover:bg-slate-200 rounded transition-all">
                                  <ChevronDown className="w-3 h-3 text-slate-500" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="w-48 bg-white border border-slate-200 shadow-xl rounded-lg p-1 z-[110]">
                                <DropdownMenuItem className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 rounded-md cursor-pointer text-slate-600" onClick={() => { setEditValue(col.title); setEditingColumn(col.id); }}>
                                  <Pencil className="w-4 h-4" /> Renomear Coluna
                                </DropdownMenuItem>
                                {onMoveColumn && (
                                  <>
                                    <DropdownMenuItem className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 rounded-md cursor-pointer text-slate-600" onClick={() => onMoveColumn(col.id, 'left')}>
                                      <ArrowLeft className="w-4 h-4" /> Mover p/ Esquerda
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 rounded-md cursor-pointer text-slate-600" onClick={() => onMoveColumn(col.id, 'right')}>
                                      <ArrowRight className="w-4 h-4" /> Mover p/ Direita
                                    </DropdownMenuItem>
                                  </>
                                )}
                                <DropdownMenuSeparator className="bg-slate-100" />
                                <DropdownMenuItem className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-red-50 rounded-md cursor-pointer text-red-500" onClick={() => onRemoveColumn(col.id)}>
                                  <Trash2 className="w-4 h-4" /> Excluir Coluna
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    ))}
                    <div className="border-y border-[#e6e9ef] flex items-center px-4 h-10 sticky top-0 z-10 bg-[#F8F9FA]">
                       <DropdownMenu>
                         <DropdownMenuTrigger asChild>
                           <button className="hover:bg-slate-200 p-1.5 rounded-md transition-all group/plus">
                             <Plus className="w-4 h-4 text-blue-500 group-hover/plus:scale-110 transition-transform" />
                           </button>
                         </DropdownMenuTrigger>
                         <DropdownMenuContent className="w-56 p-2 bg-white border border-slate-100 shadow-2xl rounded-xl z-[150]">
                           <div className="px-2 py-1.5 mb-1">
                             <div className="relative">
                               <input 
                                 type="text" 
                                 placeholder="Pesquisar coluna..." 
                                 className="w-full pl-8 pr-3 py-1.5 h-8 bg-[#f5f6f8] border-none rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
                               />
                               <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                             </div>
                           </div>
                           
                           <div className="space-y-3 p-1">
                             <div>
                               <h3 className="px-2 mb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Essenciais</h3>
                               <div className="grid grid-cols-1 gap-0.5">
                                 <DropdownMenuItem className="flex items-center gap-2.5 px-2 py-2 text-xs hover:bg-slate-50 rounded-lg cursor-pointer transition-colors" onClick={() => onAddColumn('status', 'Status')}>
                                   <div className="w-5 h-5 rounded bg-green-500 flex items-center justify-center"><Check className="w-3.5 h-3.5 text-white" /></div>
                                   <span className="font-medium text-[#323338]">Status</span>
                                 </DropdownMenuItem>
                                 <DropdownMenuItem className="flex items-center gap-2.5 px-2 py-2 text-xs hover:bg-slate-50 rounded-lg cursor-pointer transition-colors" onClick={() => onAddColumn('text', 'Texto')}>
                                   <div className="w-5 h-5 rounded bg-yellow-400 flex items-center justify-center"><Info className="w-3.5 h-3.5 text-white" /></div>
                                   <span className="font-medium text-[#323338]">Texto</span>
                                 </DropdownMenuItem>
                                 <DropdownMenuItem className="flex items-center gap-2.5 px-2 py-2 text-xs hover:bg-slate-50 rounded-lg cursor-pointer transition-colors" onClick={() => onAddColumn('date', 'Data de Entrega')}>
                                   <div className="w-5 h-5 rounded bg-purple-500 flex items-center justify-center"><Calendar className="w-3.5 h-3.5 text-white" /></div>
                                   <span className="font-medium text-[#323338]">Data de Entrega</span>
                                 </DropdownMenuItem>
                                 <DropdownMenuItem className="flex items-center gap-2.5 px-2 py-2 text-xs hover:bg-slate-50 rounded-lg cursor-pointer transition-colors" onClick={() => onAddColumn('number', 'Números')}>
                                   <div className="w-5 h-5 rounded bg-blue-500 flex items-center justify-center"><Hash className="w-3.5 h-3.5 text-white" /></div>
                                   <span className="font-medium text-[#323338]">Números</span>
                                 </DropdownMenuItem>
                                 <DropdownMenuItem className="flex items-center gap-2.5 px-2 py-2 text-xs hover:bg-slate-50 rounded-lg cursor-pointer transition-colors" onClick={() => onAddColumn('person', 'Pessoas')}>
                                   <div className="w-5 h-5 rounded bg-sky-400 flex items-center justify-center"><User className="w-3.5 h-3.5 text-white" /></div>
                                   <span className="font-medium text-[#323338]">Pessoas</span>
                                 </DropdownMenuItem>
                               </div>
                             </div>
                             
                             <div>
                               <h3 className="px-2 mb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Super úteis</h3>
                               <div className="grid grid-cols-1 gap-0.5">
                                 <DropdownMenuItem className="flex items-center gap-2.5 px-2 py-2 text-xs hover:bg-slate-50 rounded-lg cursor-pointer transition-colors" onClick={() => onAddColumn('timeline', 'Cronograma')}>
                                   <div className="w-5 h-5 rounded bg-indigo-500 flex items-center justify-center"><Calendar className="w-3.5 h-3.5 text-white" /></div>
                                   <span className="font-medium text-[#323338]">Cronograma</span>
                                 </DropdownMenuItem>
                                 <DropdownMenuItem className="flex items-center gap-2.5 px-2 py-2 text-xs hover:bg-slate-50 rounded-lg cursor-pointer transition-colors" onClick={() => onAddColumn('formula', 'Fórmula')}>
                                   <div className="w-5 h-5 rounded bg-teal-400 flex items-center justify-center"><HelpCircle className="w-3.5 h-3.5 text-white" /></div>
                                   <span className="font-medium text-[#323338]">Fórmula</span>
                                 </DropdownMenuItem>
                                 <DropdownMenuItem className="flex items-center gap-2.5 px-2 py-2 text-xs hover:bg-slate-50 rounded-lg cursor-pointer transition-colors" onClick={() => onAddColumn('progress', 'Progresso')}>
                                   <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center"><Percent className="w-3.5 h-3.5 text-white" /></div>
                                   <span className="font-medium text-[#323338]">Progresso</span>
                                 </DropdownMenuItem>
                                 <DropdownMenuItem className="flex items-center gap-2.5 px-2 py-2 text-xs hover:bg-slate-50 rounded-lg cursor-pointer transition-colors" onClick={() => onAddColumn('priority', 'Prioridade')}>
                                   <div className="w-5 h-5 rounded bg-red-500 flex items-center justify-center"><AlertCircle className="w-3.5 h-3.5 text-white" /></div>
                                   <span className="font-medium text-[#323338]">Prioridade</span>
                                 </DropdownMenuItem>
                               </div>
                             </div>
                           </div>
                         </DropdownMenuContent>
                       </DropdownMenu>
                    </div>
                  </div>

                  {/* TASKS ROWS */}
                  {group.tasks.map((task) => (
                    <div key={task.id} className="contents group/row">
                      <div className="border-r border-b border-[#e6e9ef] flex items-center justify-center bg-white h-10 text-[13px] hover:bg-[#f0f4ff] transition-colors"><div className={cn("w-4 h-4 border rounded-sm transition-colors cursor-pointer", selectedTasks.has(task.id) ? "bg-blue-500 border-blue-500 shadow-sm" : "border-[#c3c6cd] bg-white group-hover/row:border-blue-400")} onClick={() => setSelectedTasks(prev => { const n = new Set(prev); if (n.has(task.id)) n.delete(task.id); else n.add(task.id); return n; })}>{selectedTasks.has(task.id) && <Check className="w-3 h-3 text-white m-auto" />}</div></div>
                      <div 
                        className="border-r border-b border-[#e6e9ef] flex items-center px-4 gap-2 truncate text-[#323338] font-medium cursor-pointer select-none bg-white h-10 text-[13px] hover:bg-[#f0f4ff] transition-colors"
                        onDoubleClick={() => {
                          setEditValue(task.name);
                          setEditingTask(task.id);
                        }}
                      >
                        {editingTask === task.id ? (
                           <input 
                            autoFocus
                            className="w-full h-full bg-transparent outline-none border-b border-blue-500" 
                            value={editValue} 
                            onChange={e => setEditValue(e.target.value)} 
                            onBlur={() => { onUpdateTask({ ...task, name: editValue }); setEditingTask(null); }} 
                            onKeyDown={e => e.key === 'Enter' && (onUpdateTask({ ...task, name: editValue }), setEditingTask(null))}
                            onClick={e => e.stopPropagation()}
                           />
                        ) : (
                           <span className="truncate hover:text-blue-600 transition-colors">
                             {task.name}
                           </span>
                        )}
                      </div>
                      {board.columns.map(col => (<div key={col.id} className="border-r border-b border-[#e6e9ef] flex items-center justify-center transition-colors focus-within:ring-2 focus-within:ring-blue-400 focus-within:z-20 px-6 whitespace-nowrap overflow-hidden bg-white h-10 text-[13px] hover:bg-[#f0f4ff] transition-colors">{renderCell(task, col)}</div>))}
                      <div className="border-b border-[#e6e9ef] flex items-center justify-end px-4 gap-2 transition-colors bg-white h-10 hover:bg-[#f0f4ff]">
                        <div className="flex items-center gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                          <Copy className="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-blue-500" onClick={() => onDuplicateTask(task.id)} />
                          <Trash2 className="w-3.5 h-3.5 text-red-400 cursor-pointer hover:text-red-600" onClick={() => onDeleteTask(task.id)} />
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* NEW TASK INPUT ROW */}
                  <div className="contents group/new">
                    <div className="border-r border-b border-[#e6e9ef] flex items-center justify-center bg-white h-10"><Plus className="w-4 h-4 text-blue-500 group-hover/new:scale-125 transition-transform" /></div>
                    <input className="border-r border-b border-[#e6e9ef] px-4 bg-white outline-none text-[13px] font-medium h-10" placeholder="+ Adicionar tarefa" onKeyDown={e => e.key === 'Enter' && e.currentTarget.value && (onAddTask(group.id), e.currentTarget.value = '')} />
                    {board.columns.map(col => <div key={col.id} className="border-r border-b border-[#e6e9ef] bg-white h-10" />)}
                    <div className="border-b border-[#e6e9ef] bg-white h-10" />
                  </div>
                  
                  {/* FOOTER SUMMARY ROW */}
                  <div className="contents text-[11px] font-bold text-slate-500 bg-[#F8F9FA]">
                    <div className="border-r border-[#e6e9ef] h-10" />
                    <div className="border-r border-[#e6e9ef] flex items-center px-4 text-[10px] uppercase text-slate-400 tracking-widest h-10">Resumo do Grupo</div>
                    {board.columns.map(col => (
                      <div key={col.id} className="border-r border-[#e6e9ef] flex items-center justify-center px-6 whitespace-nowrap h-10 bg-[#F8F9FA]">
                        {calculateSummary(group, col)}
                      </div>
                    ))}
                    <div className="h-10" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <button onClick={onAddGroup} className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-[#323338] hover:bg-slate-50 transition-all shadow-md hover:shadow-lg active:scale-95"><Plus className="w-5 h-5 text-blue-500" /> Novo grupo de tarefas</button>
      </div>

      {/* FLOATING ACTION TOOLBAR */}
      {selectedTasks.size > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100 rounded-xl px-2 py-2 flex items-center gap-1.5 z-[1000] animate-in fade-in slide-in-from-bottom-5 duration-300">
           <div className="bg-blue-600 text-white w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ml-1">{selectedTasks.size}</div>
           <span className="text-[14px] font-bold text-[#323338] px-3 border-r border-slate-100 mr-2">Elemento selecionado</span>
           <button onClick={() => { selectedTasks.forEach(id => onDuplicateTask(id)); setSelectedTasks(new Set()); }} className="flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors group">
             <Copy className="w-5 h-5 text-slate-400 group-hover:text-blue-500" />
             <span className="text-[10px] font-bold text-slate-500">Duplicar</span>
           </button>
           <button className="flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors group" onClick={() => alert('Exportar elementosem Breve')}>
             <Download className="w-5 h-5 text-slate-400 group-hover:text-blue-500" />
             <span className="text-[10px] font-bold text-slate-500">Exportar</span>
           </button>
           <button onClick={() => { onArchiveTask(Array.from(selectedTasks)); setSelectedTasks(new Set()); }} className="flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors group">
             <Box className="w-5 h-5 text-slate-400 group-hover:text-blue-500" />
             <span className="text-[10px] font-bold text-slate-500">Arquivar</span>
           </button>
           <button onClick={() => { selectedTasks.forEach(id => onDeleteTask(id)); setSelectedTasks(new Set()); }} className="flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors group">
             <Trash2 className="w-5 h-5 text-slate-400 group-hover:text-red-500" />
             <span className="text-[10px] font-bold text-slate-500">Excluir</span>
           </button>
           <button onClick={() => setSelectedTasks(new Set())} className="ml-4 p-2 hover:bg-slate-100 rounded-full transition-colors mr-1">
             <X className="w-5 h-5 text-slate-400" />
           </button>
        </div>
      )}

      {editingFormula && <FormulaDialog open={!!editingFormula} onClose={() => setEditingFormula(null)} columns={board.columns} initialValue={editingFormula.formulaExpr || ''} onDefine={expr => { onUpdateColumn(editingFormula.id, { formulaExpr: expr }); setEditingFormula(null); }} />}
    </div>
  );
}
