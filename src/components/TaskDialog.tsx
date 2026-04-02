import { Task, TaskStatus, TaskPriority, STATUS_LABELS, PRIORITY_LABELS, BoardColumn, ColumnType } from '@/types/board';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StatusBadge, PriorityBadge } from './StatusBadge';
import { Calendar, User, Flag, Tag, Hash, Type, Link as LinkIcon, Paperclip, BarChart, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TaskDialogProps {
  task: Task | null;
  columns: BoardColumn[];
  open: boolean;
  onClose: () => void;
  onUpdate: (task: Task) => void;
}

const statusOptions: TaskStatus[] = ['default', 'working', 'stuck', 'done'];
const priorityOptions: TaskPriority[] = ['low', 'medium', 'high', 'critical'];

export default function TaskDialog({ task, columns, open, onClose, onUpdate }: TaskDialogProps) {
  if (!task) return null;

  const updateColumnValue = (columnId: string, value: any) => {
    onUpdate({
      ...task,
      columnValues: {
        ...task.columnValues,
        [columnId]: value,
      },
    });
  };

  const cycleStatus = (columnId: string) => {
    const current = task.columnValues[columnId] as TaskStatus || 'default';
    const idx = statusOptions.indexOf(current);
    const next = statusOptions[(idx + 1) % statusOptions.length];
    updateColumnValue(columnId, next);
  };

  const cyclePriority = (columnId: string) => {
    const current = task.columnValues[columnId] as TaskPriority || 'medium';
    const idx = priorityOptions.indexOf(current);
    const next = priorityOptions[(idx + 1) % priorityOptions.length];
    updateColumnValue(columnId, next);
  };

  const getIcon = (type: ColumnType) => {
    switch (type) {
      case 'status': return Tag;
      case 'priority': return Flag;
      case 'person': return User;
      case 'date': return Calendar;
      case 'timeline': return Calendar;
      case 'number': return Hash;
      case 'link': return LinkIcon;
      case 'files': return Paperclip;
      case 'progress': return BarChart;
      case 'time': return Clock;
      default: return Type;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] gap-0 p-0 overflow-hidden border-none shadow-2xl">
        <div className="h-1.5 w-full bg-blue-500" />
        
        <div className="p-6">
          <DialogHeader className="mb-6">
             <input
                className="text-2xl font-bold text-[#323338] bg-transparent border-none focus:ring-0 w-full p-0"
                value={task.name}
                onChange={(e) => onUpdate({ ...task, name: e.target.value })}
             />
          </DialogHeader>

          <div className="space-y-6">
            {columns.map((column) => {
              const Icon = getIcon(column.type);
              const value = task.columnValues[column.id];

              return (
                <div key={column.id} className="flex items-start gap-4 group">
                  <div className="flex items-center gap-2 w-32 shrink-0 pt-1.5">
                    <Icon className="w-4 h-4 text-[#676879]" />
                    <span className="text-sm text-[#676879]">{column.title}</span>
                  </div>
                  
                  <div className="flex-1">
                    {column.type === 'status' && (
                      <StatusBadge 
                        status={value as TaskStatus || 'default'} 
                        onClick={() => cycleStatus(column.id)} 
                      />
                    )}

                    {column.type === 'priority' && (
                      <PriorityBadge 
                        priority={value as TaskPriority || 'medium'} 
                        onClick={() => cyclePriority(column.id)} 
                      />
                    )}

                    {column.type === 'person' && (
                      <div className="flex flex-wrap items-center gap-2">
                        {(Array.isArray(value) ? value : value ? [value] : []).map((p: any) => (
                          <div key={p.id} className="flex items-center gap-2 p-1 pr-2 bg-slate-100 rounded-full border border-slate-200 group/p">
                            <div 
                              className="w-5 h-5 rounded-full bg-slate-300 flex items-center justify-center text-[8px] font-bold text-slate-700 bg-cover bg-center"
                              style={p.avatar ? { backgroundImage: `url(${p.avatar})` } : {}}
                            >
                              {!p.avatar && p.name?.split(' ').map((n: string) => n[0]).join('')}
                            </div>
                            <span className="text-xs text-[#323338]">{p.name}</span>
                            <button 
                              className="w-3.5 h-3.5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] text-[#676879] hover:bg-red-100 hover:text-red-500 opacity-0 group-hover/p:opacity-100 transition-opacity"
                              onClick={() => {
                                const current = Array.isArray(value) ? value : value ? [value] : [];
                                updateColumnValue(column.id, current.filter((v: any) => v.id !== p.id));
                              }}
                            >
                               ×
                            </button>
                          </div>
                        ))}
                        <button 
                          className="text-xs text-blue-500 hover:underline flex items-center gap-1 p-1"
                          onClick={() => {
                            const newPerson = { id: `p-${Date.now()}`, name: 'Novo Membro', avatar: `https://i.pravatar.cc/150?u=${Date.now()}` };
                            const current = Array.isArray(value) ? value : value ? [value] : [];
                            updateColumnValue(column.id, [...current, newPerson]);
                          }}
                        >
                          + Atribuir
                        </button>
                      </div>
                    )}

                    {column.type === 'timeline' && (
                      <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-100">
                         <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold">Início</span>
                            <input 
                              type="date"
                              className="text-xs text-[#323338] bg-transparent border-none focus:ring-0 p-0"
                              value={value?.start || ''}
                              onChange={(e) => updateColumnValue(column.id, { ...value, start: e.target.value })}
                            />
                         </div>
                         <div className="w-px h-6 bg-slate-200" />
                         <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold">Término</span>
                            <input 
                              type="date"
                              className="text-xs text-[#323338] bg-transparent border-none focus:ring-0 p-0"
                              value={value?.end || ''}
                              onChange={(e) => updateColumnValue(column.id, { ...value, end: e.target.value })}
                            />
                         </div>
                      </div>
                    )}

                    {column.type === 'date' && (
                      <input 
                        type="date"
                        className="text-sm text-[#323338] bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-500 focus:ring-0 p-0"
                        value={value || ''}
                        onChange={(e) => updateColumnValue(column.id, e.target.value)}
                      />
                    )}

                    {column.type === 'number' && (
                      <input 
                        type="number"
                        className="text-sm text-[#323338] bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-500 focus:ring-0 p-0 w-full"
                        value={value || ''}
                        onChange={(e) => updateColumnValue(column.id, parseFloat(e.target.value))}
                      />
                    )}

                    {column.type === 'text' && (
                      <textarea 
                        className="text-sm text-[#323338] bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-500 focus:ring-0 p-1 w-full rounded resize-none"
                        rows={1}
                        value={value || ''}
                        onChange={(e) => updateColumnValue(column.id, e.target.value)}
                        placeholder="Adicionar texto..."
                      />
                    )}

                    {column.type === 'progress' && (
                      <div className="flex items-center gap-3 w-full">
                        <input 
                          type="range"
                          min="0"
                          max="100"
                          className="flex-1 h-1 bg-slate-200 rounded-full appearance-none cursor-pointer accent-green-500"
                          value={value || 0}
                          onChange={(e) => updateColumnValue(column.id, parseInt(e.target.value))}
                        />
                        <span className="text-sm text-[#676879] tabular-nums">{value || 0}%</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          <div className="mt-8 pt-6 border-t">
             <div className="flex gap-6 mb-6">
                <button className="pb-2 text-sm font-bold border-b-2 border-blue-500 text-blue-600">Atualizações</button>
                <button className="pb-2 text-sm font-medium border-b-2 border-transparent text-[#676879] hover:text-[#323338]">Arquivos</button>
                <button className="pb-2 text-sm font-medium border-b-2 border-transparent text-[#676879] hover:text-[#323338]">Atividade</button>
             </div>

             <div className="space-y-6">
                <div className="relative">
                   <textarea 
                     className="w-full p-4 bg-white border border-slate-200 rounded-xl text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none min-h-[100px] shadow-sm transition-all"
                     placeholder="Escreva uma atualização..."
                   />
                   <div className="absolute bottom-3 right-3 flex gap-2">
                      <button className="p-1.5 hover:bg-slate-100 rounded-md text-slate-400">@</button>
                      <button className="px-4 py-1 bg-blue-500 text-white rounded-md text-xs font-bold hover:bg-blue-600 transition-colors">Postar</button>
                   </div>
                </div>

                <div className="space-y-4">
                   <div className="flex gap-3">
                      <div className="w-8 h-8 rounded bg-orange-500 flex items-center justify-center text-white text-xs font-bold shrink-0">AS</div>
                      <div className="flex-1">
                         <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-bold text-[#323338]">Ana Silva</span>
                            <span className="text-[10px] text-slate-400 font-medium">Há 2 horas</span>
                         </div>
                         <p className="text-sm text-[#323338] bg-slate-50 p-3 rounded-lg border border-slate-100">
                            Já finalizei o modelo 3D. Podem revisar na pasta do projeto?
                         </p>
                      </div>
                   </div>
                </div>
             </div>
          </div>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t flex items-center justify-between">
           <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-[11px] text-[#676879]">Atualizado agora</span>
           </div>
           <button 
             onClick={onClose}
             className="px-6 py-2 bg-[#0073ea] text-white rounded-lg text-sm font-bold hover:bg-[#0060c2] transition-colors shadow-md active:scale-95"
           >
             Concluído
           </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
