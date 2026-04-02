import { useState } from 'react';
import { Board, Task, GroupColor, STATUS_LABELS, PRIORITY_LABELS, BoardColumn, TaskGroup, ColumnType } from '@/types/board';
import { 
  ChevronDown, GripVertical, Plus, MessageCircle, Star, MoreHorizontal, Check, UserPlus, Trash2, Pencil, HelpCircle, 
  Archive, Copy, ArrowRight, X, Hash, Percent, DollarSign
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { evaluateFormula } from '@/lib/formula';
import FormulaDialog from './FormulaDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
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
  done: '#00c875', working: '#fdab3d', stuck: '#e2445c', default: '#c4c4c4',
};

const priorityColors: Record<string, string> = {
  critical: '#333333', high: '#e2445c', medium: '#5559df', low: '#579bfc',
};

interface TableViewProps {
  board: Board; onTaskClick: (task: Task) => void; onAddTask: (groupId?: string) => void;
  onAddGroup: () => void; onRenameGroup: (groupId: string, title: string) => void;
  onDeleteGroup: (groupId: string) => void; onArchiveGroup: (groupId: string) => void;
  onAddColumn: (type: ColumnType, title: string) => void; onUpdateColumn: (columnId: string, updates: Partial<BoardColumn>) => void;
  onRemoveColumn: (columnId: string) => void; onDeleteTask: (taskId: string) => void;
  onDuplicateTask: (taskId: string) => void; onArchiveTask: (taskIds: string[]) => void;
  onUpdateTask: (task: Task) => void; searchTerm: string;
}

export default function TableView({ 
  board, onTaskClick, onAddTask, onAddGroup, onRenameGroup, onDeleteGroup, onArchiveGroup,
  onAddColumn, onUpdateColumn, onRemoveColumn, onDeleteTask, onDuplicateTask,
  onArchiveTask, onUpdateTask, searchTerm 
}: TableViewProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [editingFormula, setEditingFormula] = useState<BoardColumn | null>(null);
  const [editingCell, setEditingCell] = useState<{taskId: string, colId: string} | null>(null);
  const [editValue, setEditValue] = useState<any>('');

  const filteredGroups = board.groups.map(group => ({
    ...group,
    tasks: group.tasks.filter(task => 
      !searchTerm || task.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      Object.values(task.columnValues).some(v => typeof v === 'string' && v.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  })).filter(g => g.tasks.length > 0 || !searchTerm);

  const toggleGroup = (id: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const calculateSummary = (group: TaskGroup, column: BoardColumn) => {
    let values: any[] = [];
    if (column.type === 'formula') {
      values = group.tasks.map(t => evaluateFormula(column.formulaExpr || '', t, board.columns));
    } else {
      values = group.tasks.map(t => t.columnValues[column.id]).filter(v => v !== undefined && v !== null);
    }
    
    // Status column special summary (stacked bar)
    if (column.type === 'status') {
      const counts: Record<string, number> = {};
      values.forEach(v => {
        const s = String(v || 'default');
        counts[s] = (counts[s] || 0) + 1;
      });
      const total = values.length;
      if (total === 0) return <div className="w-full h-4 bg-slate-100/50 rounded-sm mx-2" />;
      
      return (
        <div className="w-full px-2">
          <div className="w-full h-4 flex rounded-sm overflow-hidden bg-slate-100 shadow-inner">
            {Object.entries(counts).map(([status, count]) => (
              <div 
                key={status} 
                style={{ 
                  width: `${(count / total) * 100}%`, 
                  backgroundColor: statusColors[status] || statusColors.default 
                }} 
                className="h-full border-r border-white/20 last:border-none"
                title={`${STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status}: ${count}`}
              />
            ))}
          </div>
        </div>
      );
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
          <div className="flex flex-col items-center justify-center -space-y-0.5 w-full h-full cursor-pointer hover:bg-slate-200/50 transition-colors py-1 group/summary min-h-[36px]">
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
                <div className="flex gap-0.5">
                   <button className="px-1.5 py-0.5 border border-slate-200 rounded text-[10px] hover:bg-slate-50 font-bold">E</button>
                   <button className="px-1.5 py-0.5 border border-blue-500 rounded text-[10px] bg-blue-50 text-blue-600 font-bold">D</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {['none', '$', '€', '£', '%'].map(unit => (
                  <button
                    key={unit}
                    onClick={() => onUpdateColumn(column.id, { unit: unit === 'none' ? undefined : unit })}
                    className={cn(
                      "px-2 py-1.5 text-xs rounded border transition-all",
                      ((!column.unit && unit === 'none') || column.unit === unit) 
                        ? "bg-blue-600 border-blue-600 text-white font-bold shadow-md shadow-blue-500/20" 
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {unit === 'none' ? 'Nenhum' : unit}
                  </button>
                ))}
                <input 
                   placeholder="Digite seu próprio" 
                   className="flex-1 px-2 py-1.5 text-xs rounded border border-slate-200 outline-none focus:border-blue-500"
                   onChange={(e) => onUpdateColumn(column.id, { unit: e.target.value })}
                   value={column.unit && !['$', '€', '£', '%'].includes(column.unit) ? column.unit : ''}
                />
              </div>
            </div>

            <DropdownMenuSeparator className="bg-slate-100" />

            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight mb-2 block">Cálculo</label>
              <div className="flex flex-wrap gap-1">
                {['none', 'sum', 'avg', 'min', 'max', 'count'].map(type => (
                  <button
                    key={type}
                    onClick={() => onUpdateColumn(column.id, { summaryType: type as any })}
                    className={cn(
                      "px-3 py-1.5 text-xs rounded border transition-all",
                      summaryType === type
                        ? "bg-blue-600 border-blue-600 text-white font-bold" 
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {labelMap[type] || 'Nenhum'}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
               <span className="text-[10px] text-slate-400 font-medium">
                 {summaryType === 'sum' ? 'total geral da coluna' : 'média geral da coluna'}:
               </span>
               <span className="text-[10px] font-bold text-slate-600">
                 {formatted}{column.unit === '%' ? '%' : column.unit === 'R$' ? ' R$' : ''}
               </span>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  const renderCell = (task: Task, column: BoardColumn) => {
    const value = task.columnValues[column.id];
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
          <div className="h-9 w-full group/status">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="h-full w-full flex items-center justify-center text-white font-semibold px-2 text-center text-xs cursor-pointer shadow-sm" style={{ backgroundColor: statusColors[value as string] || statusColors.default }} onClick={e => e.stopPropagation()}>
                  {STATUS_LABELS[value as string as keyof typeof STATUS_LABELS] || 'Fazer'}
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48 p-1 bg-white border border-slate-100 shadow-xl rounded-lg">
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <DropdownMenuItem key={key} className="flex items-center gap-2 p-2 text-xs font-bold text-white mb-1 rounded-md cursor-pointer" style={{ backgroundColor: statusColors[key] || statusColors.default }} onClick={e => { e.stopPropagation(); onUpdateTask({ ...task, columnValues: { ...task.columnValues, [column.id]: key } }); }}>
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      case 'number':
        if (editingCell?.taskId === task.id && editingCell?.colId === column.id) {
          return <input type="number" autoFocus className="w-full h-full px-2 text-[12px] border-2 border-blue-500 focus:outline-none" value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={() => { onUpdateTask({ ...task, columnValues: { ...task.columnValues, [column.id]: parseFloat(editValue) || null } }); setEditingCell(null); }} onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} />;
        }
        return <div className="w-full h-full flex items-center justify-center cursor-text" onClick={e => { e.stopPropagation(); setEditValue(task.columnValues[column.id] || ''); setEditingCell({taskId: task.id, colId: column.id}); }}>
          {value === null ? '—' : `${new Intl.NumberFormat('pt-BR').format(value as number)}${column.unit === 'R$' ? ' R$' : column.unit === '%' ? '%' : ''}`}
        </div>;
      default:
        const progress = (value as number) || 0;
        if (column.type === 'progress' || column.title.toLowerCase().includes('%')) {
           return <div className="w-full h-full px-3 flex flex-col justify-center gap-1 cursor-pointer hover:bg-slate-50 transition-colors" onClick={e => { e.stopPropagation(); setEditValue(value || 0); setEditingCell({taskId: task.id, colId: column.id}); }}>
             <div className="flex justify-between text-[10px] text-muted-foreground font-medium"><span>{progress}%</span></div>
             <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden"><div className={cn("h-full transition-all", progress === 100 ? "bg-green-500" : "bg-blue-500")} style={{ width: `${progress}%` }} /></div>
           </div>;
        }
        return <div className="w-full h-full px-4 truncate text-[12px] flex items-center cursor-text" onClick={e => { e.stopPropagation(); setEditValue(value || ''); setEditingCell({taskId: task.id, colId: column.id}); }}>{String(value || '')}</div>;
    }
  };

  return (
    <div className="flex-1 overflow-x-auto bg-[#F5F6F8] min-h-screen">
      <div className="inline-block min-w-full align-middle pt-4 px-6 pb-20">
        {filteredGroups.map((group) => {
          const collapsed = collapsedGroups.has(group.id);
          const color = groupColorHex[group.color];
          return (
            <div key={group.id} className="mb-8">
              <div className={cn("flex items-stretch bg-white border-y border-r border-[#e6e9ef] mb-2 sticky left-0 group min-h-[48px]", collapsed ? "border-l-[6px]" : "border-none")} style={collapsed ? { borderLeftColor: color } : {}}>
                <div className="w-10 flex items-center justify-center shrink-0 border-r border-[#e6e9ef]">
                  <button onClick={() => toggleGroup(group.id)} className="p-1 hover:bg-black/5 rounded transition-colors">
                    <ChevronDown className={cn("w-5 h-5 transition-transform text-[#676879]", collapsed && "-rotate-90")} />
                  </button>
                </div>
                <div className="flex-[1.5] min-w-[300px] flex flex-col justify-center px-4 border-r border-[#e6e9ef]">
                  <h2 className="text-[16px] font-bold truncate leading-tight" style={{ color }}>{group.title}</h2>
                  <span className="text-[11px] text-muted-foreground font-medium">{group.tasks.length} Elemento{group.tasks.length !== 1 ? 's' : ''}</span>
                </div>
                {collapsed && board.columns.map(col => (
                  <div key={col.id} className="border-r border-[#e6e9ef] flex items-center justify-center shrink-0 bg-[#FBFCFD]" style={{ width: col.width || 140, minWidth: col.width || 140 }}>
                    {calculateSummary(group, col)}
                  </div>
                ))}
                {collapsed && <div className="flex-1 bg-[#FBFCFD]" />}
              </div>

              {!collapsed && (
                <div className="grid border-l-[6px] rounded-sm" style={{ borderLeftColor: color }}>
                  <div className="flex items-stretch bg-white border-y border-r border-[#e6e9ef] sticky top-0 z-10 text-[13px] text-[#676879] h-9">
                    <div className="w-10 border-r border-[#e6e9ef] flex items-center justify-center shrink-0"><div className="w-4 h-4 border border-[#c3c6cd] rounded-sm" /></div>
                    <div className="flex-[1.5] min-w-[300px] border-r border-[#e6e9ef] flex items-center px-4 shrink-0 font-bold text-[#323338]">Tarefa</div>
                    {board.columns.map(col => (
                      <div key={col.id} className="border-r border-[#e6e9ef] flex items-center justify-center shrink-0 px-2" style={{ width: col.width || 140, minWidth: col.width || 140 }}>{col.title}</div>
                    ))}
                    <div className="w-10 border-r border-[#e6e9ef] flex items-center justify-center shrink-0"><Plus className="w-4 h-4 cursor-pointer hover:text-blue-500" onClick={() => onAddColumn('number', 'Nova Coluna')} /></div>
                    <div className="flex-1 bg-white border-b border-[#e6e9ef]" />
                  </div>
                  {group.tasks.map((task) => (
                    <div key={task.id} className="flex items-stretch bg-white border-b border-r border-[#e6e9ef] text-[13px] hover:bg-[#f5f6f8] h-9">
                      <div className="w-10 border-r border-[#e6e9ef] flex items-center justify-center shrink-0"><div className={cn("w-4 h-4 border rounded-sm", selectedTasks.has(task.id) ? "bg-blue-500 border-blue-500" : "border-[#c3c6cd]")} onClick={() => setSelectedTasks(prev => { const n = new Set(prev); if (n.has(task.id)) n.delete(task.id); else n.add(task.id); return n; })}>{selectedTasks.has(task.id) && <Check className="w-3 h-3 text-white m-auto" />}</div></div>
                      <div className="flex-[1.5] min-w-[300px] border-r border-[#e6e9ef] flex items-center px-4 gap-2 shrink-0 truncate text-[#323338]"><GripVertical className="w-4 h-4 text-muted-foreground/30" />{task.name}</div>
                      {board.columns.map(col => (<div key={col.id} className="border-r border-[#e6e9ef] flex items-center justify-center shrink-0" style={{ width: col.width || 140, minWidth: col.width || 140 }}>{renderCell(task, col)}</div>))}
                      <div className="flex-1 flex items-center justify-end px-4 opacity-0 hover:opacity-100"><Trash2 className="w-4 h-4 text-red-400 cursor-pointer" onClick={() => onDeleteTask(task.id)} /></div>
                    </div>
                  ))}
                  <div className="flex items-stretch bg-white border-b border-r border-[#e6e9ef] h-9">
                    <div className="w-10 border-r border-[#e6e9ef] flex items-center justify-center shrink-0"><Plus className="w-4 h-4 text-muted-foreground" /></div>
                    <input className="flex-[1.5] min-w-[300px] px-4 bg-transparent outline-none text-[13px]" placeholder="+ Adicionar tarefa" onKeyDown={e => e.key === 'Enter' && e.currentTarget.value && (onAddTask(group.id), e.currentTarget.value = '')} />
                  </div>
                  
                  {/* FOOTER SUMMARY ROW */}
                  <div className="flex items-stretch bg-[#FBFCFD] border-b border-r border-[#e6e9ef] h-12 mt-1 font-medium text-slate-700">
                    <div className="w-10 border-r border-[#e6e9ef] shrink-0" />
                    <div className="flex-[1.5] min-w-[300px] border-r border-[#e6e9ef]" />
                    {board.columns.map(col => (
                      <div key={col.id} className="border-r border-[#e6e9ef] flex items-center justify-center shrink-0" style={{ width: col.width || 140, minWidth: col.width || 140 }}>
                        {calculateSummary(group, col)}
                      </div>
                    ))}
                    <div className="flex-1" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <button onClick={onAddGroup} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"><Plus className="w-4 h-4 text-blue-500" /> Novo grupo de tarefas</button>
      </div>
      {editingFormula && <FormulaDialog open={!!editingFormula} onClose={() => setEditingFormula(null)} columns={board.columns} initialValue={editingFormula.formulaExpr || ''} onDefine={expr => { onUpdateColumn(editingFormula.id, { formulaExpr: expr }); setEditingFormula(null); }} />}
    </div>
  );
}
