import { useState } from 'react';
import { Board, Task, GroupColor, STATUS_LABELS, PRIORITY_LABELS, BoardColumn, TaskGroup } from '@/types/board';
import { 
  ChevronDown, 
  GripVertical, 
  Plus, 
  MessageCircle, 
  Star, 
  MoreHorizontal, 
  Check, 
  UserPlus, 
  Download, 
  ListPlus, 
  Trash2, 
  Pencil, 
  HelpCircle, 
  FunctionSquare 
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

const groupColorHex: Record<GroupColor, string> = {
  blue: '#0073ea',
  green: '#00c875',
  purple: '#a25ddc',
  orange: '#fdab3d',
  red: '#e2445c',
  teal: '#11ddbe',
  indigo: '#5559df',
  pink: '#ff5ac4',
  grey: '#c4c4c4',
};

const statusColors: Record<string, string> = {
  done: '#00c875',
  working: '#fdab3d',
  stuck: '#e2445c',
  default: '#c4c4c4',
};

const priorityColors: Record<string, string> = {
  critical: '#333333',
  high: '#e2445c',
  medium: '#5559df',
  low: '#579bfc',
};


interface TableViewProps {
  board: Board;
  onTaskClick: (task: Task) => void;
  onAddTask: (groupId?: string) => void;
  onAddGroup: () => void;
  onRenameGroup: (groupId: string, title: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onAddColumn: (type: any, title: string) => void;
  onUpdateColumn: (columnId: string, updates: Partial<BoardColumn>) => void;
  onRemoveColumn: (columnId: string) => void;
  searchTerm: string;
}

export default function TableView({ 
  board, 
  onTaskClick, 
  onAddTask,
  onAddGroup,
  onRenameGroup,
  onDeleteGroup,
  onAddColumn, 
  onUpdateColumn, 
  onRemoveColumn,
  searchTerm 
}: TableViewProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [editingFormula, setEditingFormula] = useState<BoardColumn | null>(null);

  const filteredGroups = board.groups.map(group => ({
    ...group,
    tasks: group.tasks.filter(task => 
      !searchTerm || 
      task.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      Object.values(task.columnValues).some(v => 
        typeof v === 'string' && v.toLowerCase().includes(searchTerm.toLowerCase())
      )
    )
  })).filter(g => g.tasks.length > 0 || !searchTerm);

  const toggleGroup = (id: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTaskSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const calculateSummary = (group: TaskGroup, column: BoardColumn) => {
    if (!column.summaryType || column.summaryType === 'none') return null;

    let values: any[] = [];
    
    if (column.type === 'formula') {
      values = group.tasks.map(t => evaluateFormula(column.formulaExpr || '', t, board.columns));
    } else {
      values = group.tasks
        .map(t => t.columnValues[column.id])
        .filter(v => v !== undefined && v !== null);
    }

    if (values.length === 0 && column.summaryType !== 'count') return null;

    let result: number | string = 0;
    const numericValues = values
      .map(v => typeof v === 'number' ? v : parseFloat(String(v)) || 0)
      .filter(v => !isNaN(v));

    switch (column.summaryType) {
      case 'sum':
        result = numericValues.reduce((a, b) => a + b, 0);
        break;
      case 'avg':
        result = numericValues.length > 0 ? numericValues.reduce((a, b) => a + b, 0) / numericValues.length : 0;
        break;
      case 'min':
        result = Math.min(...numericValues);
        break;
      case 'max':
        result = Math.max(...numericValues);
        break;
      case 'count':
        result = values.length;
        break;
    }

    if (typeof result === 'number' && (column.type === 'number' || column.type === 'formula')) {
      const formatted = new Intl.NumberFormat('pt-BR').format(result);
      return (
        <div className="flex flex-col items-center justify-center -space-y-1">
           <span className="text-[9px] uppercase text-muted-foreground font-medium">{column.summaryType === 'sum' ? 'Total' : column.summaryType}</span>
           <span className="text-[12px] text-[#323338] font-bold">
              {column.unit === 'R$' ? `R$ ${formatted}` : formatted}
           </span>
        </div>
      );
    }

    return result;
  };

  const renderCell = (task: Task, column: BoardColumn) => {
    const value = task.columnValues[column.id];

    if (column.type === 'formula') {
      const result = evaluateFormula(column.formulaExpr || '', task, board.columns);
      return (
        <div 
          className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50/20 w-full h-full flex items-center justify-center cursor-pointer hover:bg-blue-100/30 transition-colors group/formula"
          onClick={() => setEditingFormula(column)}
        >
          {result === 'Error' ? <HelpCircle className="w-4 h-4 text-red-400" title="Erro na fórmula" /> : result ?? '—'}
          <Pencil className="w-3 h-3 ml-2 opacity-0 group-hover/formula:opacity-100 transition-opacity" />
        </div>
      );
    }

    switch (column.type) {
      case 'status':
        return (
          <div 
            className="h-full w-full flex items-center justify-center text-white font-medium px-2 text-center text-[11px] leading-tight transition-opacity hover:opacity-90"
            style={{ backgroundColor: statusColors[value as string] || statusColors.default }}
          >
            {STATUS_LABELS[value as keyof typeof STATUS_LABELS] || 'Pendente'}
          </div>
        );
      
      case 'priority':
        return (
          <div 
            className="h-full w-full flex items-center justify-center text-white font-medium px-2 text-center text-[11px] leading-tight"
            style={{ backgroundColor: priorityColors[value as string] || '#c4c4c4' }}
          >
            {PRIORITY_LABELS[value as keyof typeof PRIORITY_LABELS] || '—'}
          </div>
        );

      case 'person':
        const persons = Array.isArray(value) ? value : value ? [value] : [];
        return (
          <div className="flex items-center justify-center w-full -space-x-2 overflow-hidden">
            {persons.length > 0 ? (
              persons.map((p: any) => (
                <div 
                  key={p.id} 
                  className="w-7 h-7 rounded-full bg-slate-200 border-2 border-white overflow-hidden shadow-sm flex items-center justify-center text-[10px] font-bold text-slate-600 bg-cover bg-center shrink-0"
                  style={p.avatar ? { backgroundImage: `url(${p.avatar})` } : {}}
                  title={p.name}
                >
                  {!p.avatar && p.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                </div>
              ))
            ) : (
              <div className="w-7 h-7 rounded-full border border-dashed border-muted-foreground/30 flex items-center justify-center text-muted-foreground/30 hover:border-blue-500 hover:text-blue-500 transition-colors">
                <UserPlus className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        );

      case 'date':
        if (!value) return <span className="text-muted-foreground/40 text-[11px]">—</span>;
        const date = parseISO(value as string);
        return <span className="text-[12px]">{isValid(date) ? format(date, "MMM d", { locale: ptBR }) : '—'}</span>;

      case 'timeline':
        const timeline = value as { start: string; end: string };
        if (!timeline?.start || !timeline?.end) return (
           <div className="w-[80%] h-6 rounded-full bg-slate-100 flex items-center justify-center text-[11px] text-muted-foreground/40">—</div>
        );
        const start = parseISO(timeline.start);
        const end = parseISO(timeline.end);
        return (
          <div className="w-full px-2">
            <div className="w-full h-6 rounded-full bg-[#333333] relative overflow-hidden flex items-center justify-center text-[11px] font-medium text-white group/timeline shadow-inner">
               <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 opacity-50" />
               <span className="z-10">{format(start, 'MMM d')} - {format(end, 'd')}</span>
            </div>
          </div>
        );

      case 'progress':
        const progress = (value as number) || 0;
        return (
          <div className="w-full px-3 flex flex-col gap-1">
             <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
                <span>{progress}%</span>
             </div>
             <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                <div 
                  className={cn(
                    "h-full transition-all duration-500",
                    progress === 100 ? "bg-green-500" : "bg-blue-500"
                  )}
                  style={{ width: `${progress}%` }} 
                />
             </div>
          </div>
        );

      case 'number':
        if (value === undefined || value === null) return <span className="text-muted-foreground/40 text-[11px]">—</span>;
        const formatted = new Intl.NumberFormat('pt-BR').format(value as number);
        return (
           <span className="text-[12px] text-[#323338] font-medium">
              {column.unit === 'R$' ? `R$ ${formatted}` : formatted}
           </span>
        );

      default:
        return <span className="px-4 truncate text-[12px]">{String(value || '')}</span>;
    }
  };

  return (
    <div className="flex-1 overflow-x-auto bg-[#F5F6F8] min-h-screen">
      <div className="inline-block min-w-full align-middle pt-4 px-6 pb-20">
        {filteredGroups.map((group) => {
          const collapsed = collapsedGroups.has(group.id);
          const color = groupColorHex[group.color];

          return (
            <div key={group.id} className="mb-8 overflow-visible">
              <div className="flex items-center gap-2 mb-2 sticky left-0 group">
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="p-1 hover:bg-black/5 rounded transition-colors"
                >
                  <ChevronDown 
                    className={cn("w-5 h-5 transition-transform text-[#676879]", collapsed && "-rotate-90")} 
                  />
                </button>
                <h2 className="text-lg font-bold" style={{ color }}>
                  {group.title}
                </h2>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-1 hover:bg-black/5 rounded opacity-0 group-hover:opacity-100 transition-all text-[#676879]">
                       <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-48 p-1 bg-white border border-slate-100 shadow-xl rounded-md">
                     <DropdownMenuItem className="flex items-center gap-2 p-2 text-xs hover:bg-slate-50 cursor-pointer rounded" onClick={() => {
                        const newTitle = prompt('Novo nome do grupo:', group.title);
                        if (newTitle) onRenameGroup(group.id, newTitle);
                     }}>
                        <Pencil className="w-3.5 h-3.5" /> Renomear
                     </DropdownMenuItem>
                     <DropdownMenuSeparator className="my-1 bg-slate-100" />
                     <DropdownMenuItem className="flex items-center gap-2 p-2 text-xs text-red-600 hover:bg-red-50 cursor-pointer rounded" onClick={() => onDeleteGroup(group.id)}>
                        <Trash2 className="w-3.5 h-3.5" /> Excluir
                     </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <span className="text-xs text-muted-foreground ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {group.tasks.length} Tarefas
                </span>
              </div>

              {!collapsed && (
                <div className="grid overflow-visible border-l-[6px] rounded-sm" style={{ borderColor: color }}>
                  <div className="flex items-stretch bg-white border-y border-r border-[#e6e9ef] sticky top-0 z-10 text-[13px] font-normal text-[#676879] h-9 select-none">
                    <div className="w-10 border-r border-[#e6e9ef] flex items-center justify-center shrink-0 bg-white">
                      <div className="w-4 h-4 border border-[#c3c6cd] rounded-sm" />
                    </div>
                    <div className="w-[350px] border-r border-[#e6e9ef] flex items-center px-4 shrink-0 bg-white">Tarefa</div>
                    
                    {board.columns.map(col => (
                      <div 
                        key={col.id} 
                        className="border-r border-[#e6e9ef] flex items-center justify-center shrink-0 px-2 group/col relative"
                        style={{ width: col.width || 100 }}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                             <button className="flex items-center gap-1 hover:bg-slate-50 px-1 rounded transition-colors">
                               {col.title}
                               <ChevronDown className="w-3 h-3 text-[#c3c6cd] opacity-0 group-hover/col:opacity-100" />
                             </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-48 p-1 bg-white border border-slate-100 shadow-xl rounded-md">
                            <DropdownMenuItem className="flex items-center gap-2 p-2 text-xs hover:bg-slate-50 cursor-pointer rounded" onClick={() => onUpdateColumn(col.id, { title: prompt('Novo nome:', col.title) || col.title })}>
                               <Star className="w-3.5 h-3.5" /> Renomear
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="my-1 bg-slate-100" />
                            <DropdownMenuItem className="flex items-center gap-2 p-2 text-xs text-red-600 hover:bg-red-50 cursor-pointer rounded" onClick={() => onRemoveColumn(col.id)}>
                               Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize opacity-0 group-hover/col:opacity-100 bg-blue-400" />
                      </div>
                    ))}
                    
                    <div className="w-10 border-r border-[#e6e9ef] flex items-center justify-center shrink-0 bg-white hover:bg-slate-50 cursor-pointer group/addcol">
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Plus className="w-4 h-4 text-[#676879] group-hover/addcol:text-blue-500" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-64 p-2 bg-white border border-slate-100 shadow-2xl rounded-xl">
                             <DropdownMenuItem className="flex items-center gap-3 p-2 text-sm hover:bg-slate-50 rounded cursor-pointer" onClick={() => onAddColumn('status', 'Status')}>Status</DropdownMenuItem>
                             <DropdownMenuItem className="flex items-center gap-3 p-2 text-sm hover:bg-slate-50 rounded cursor-pointer" onClick={() => onAddColumn('text', 'Texto')}>Texto</DropdownMenuItem>
                             <DropdownMenuItem className="flex items-center gap-3 p-2 text-sm hover:bg-slate-50 rounded cursor-pointer" onClick={() => onAddColumn('number', 'Números')}>Números</DropdownMenuItem>
                             <DropdownMenuItem className="flex items-center gap-3 p-2 text-sm hover:bg-slate-50 rounded cursor-pointer" onClick={() => onAddColumn('date', 'Data')}>Data</DropdownMenuItem>
                             <DropdownMenuItem className="flex items-center gap-3 p-2 text-sm hover:bg-slate-50 rounded cursor-pointer" onClick={() => onAddColumn('timeline', 'Cronograma')}>Cronograma</DropdownMenuItem>
                          </DropdownMenuContent>
                       </DropdownMenu>
                    </div>
                    <div className="flex-1 min-w-[50px] bg-white border-b border-[#e6e9ef]" />
                  </div>

                  {group.tasks.map((task) => {
                    const isSelected = selectedTasks.has(task.id);
                    return (
                      <div
                        key={task.id}
                        onClick={() => onTaskClick(task)}
                        className={cn(
                          "flex items-stretch bg-white border-b border-r border-[#e6e9ef] text-[13px] hover:bg-[#f5f6f8] cursor-pointer group/row transition-colors h-9",
                          isSelected && "bg-[#e5f4ff] hover:bg-[#d9edfe]"
                        )}
                      >
                        <div className="w-10 border-r border-[#e6e9ef] flex items-center justify-center shrink-0 relative">
                          <div 
                            className={cn(
                              "w-4 h-4 border rounded-sm flex items-center justify-center transition-all",
                              isSelected ? "bg-[#0073ea] border-[#0073ea]" : "border-[#c3c6cd] group-hover/row:border-[#0073ea]"
                            )}
                            onClick={(e) => toggleTaskSelection(task.id, e)}
                          >
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                        </div>
                        <div className="w-[350px] border-r border-[#e6e9ef] flex items-center px-4 gap-2 shrink-0 overflow-hidden bg-white group-hover/row:bg-inherit">
                           <GripVertical className="w-4 h-4 text-muted-foreground/30 shrink-0" />
                           <span className="truncate flex-1 text-[#323338]">{task.name}</span>
                        </div>
                        {board.columns.map(col => (
                          <div key={col.id} className="border-r border-[#e6e9ef] flex items-center justify-center shrink-0 overflow-hidden" style={{ width: col.width || 100 }}>
                            {renderCell(task, col)}
                          </div>
                        ))}
                        <div className="flex-1 flex items-center px-4 text-muted-foreground opacity-0 group-hover/row:opacity-100">
                          <MoreHorizontal className="w-4 h-4 cursor-pointer hover:text-[#323338]" />
                        </div>
                      </div>
                    );
                  })}

                  <div className="flex items-stretch bg-[#FBFCFD] border-b border-r border-[#e6e9ef] text-[11px] h-9 sticky bottom-0 z-[5]">
                     <div className="w-10 border-r border-[#e6e9ef] shrink-0" />
                     <div className="w-[350px] border-r border-[#e6e9ef]" />
                     {board.columns.map(col => (
                        <div key={col.id} className="border-r border-[#e6e9ef] flex items-center justify-center shrink-0 px-2" style={{ width: col.width || 100 }}>
                           {calculateSummary(group, col)}
                        </div>
                     ))}
                     <div className="flex-1" />
                  </div>

                  <div className="flex items-stretch bg-white border-b border-r border-[#e6e9ef] text-[13px] h-9 group/add">
                    <div className="w-10 border-r border-[#e6e9ef] flex items-center justify-center shrink-0 bg-white">
                      <Plus className="w-4 h-4 text-muted-foreground group-hover/add:text-[#0073ea]" />
                    </div>
                    <div className="flex-1 flex items-center px-4">
                      <input 
                        type="text" 
                        placeholder="+ Adicionar tarefa"
                        className="w-full bg-transparent border-none focus:ring-0 placeholder:text-muted-foreground/60 text-[13px]"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.currentTarget.value) {
                             onAddTask(group.id);
                             e.currentTarget.value = '';
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <div className="mt-8">
           <button onClick={onAddGroup} className="flex items-center gap-2 px-4 py-2 rounded-md bg-white border border-slate-200 text-sm font-medium text-[#323338] hover:bg-slate-50 transition-colors shadow-sm">
              <Plus className="w-4 h-4 text-blue-500" /> Novo grupo de tarefas
           </button>
        </div>
      </div>
      {editingFormula && (
        <FormulaDialog
          open={!!editingFormula}
          onClose={() => setEditingFormula(null)}
          onDefine={(expr) => {
            onUpdateColumn(editingFormula.id, { formulaExpr: expr });
            setEditingFormula(null);
          }}
          columns={board.columns}
          initialValue={editingFormula.formulaExpr}
        />
      )}
    </div>
  );
}
