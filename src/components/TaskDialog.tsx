import { Task, TaskStatus, TaskPriority, STATUS_LABELS, PRIORITY_LABELS, BoardColumn, ColumnType } from '@/types/board';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StatusBadge, PriorityBadge } from './StatusBadge';
import { Calendar, User, Flag, Tag, Hash, Type, Link as LinkIcon, Paperclip, BarChart, Clock, Trash2, ArrowRight, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TaskDialogProps {
  task: Task | null;
  columns: BoardColumn[];
  open: boolean;
  onClose: () => void;
  onUpdate: (task: Task) => void;
  onDelete: (taskId: string) => void;
}

const statusOptions: TaskStatus[] = ['default', 'working', 'stuck', 'done'];
const priorityOptions: TaskPriority[] = ['low', 'medium', 'high', 'critical'];

export default function TaskDialog({ task, columns, open, onClose, onUpdate, onDelete }: TaskDialogProps) {
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
      case 'chat': return MessageCircle;
      case 'time': return Clock;
      default: return Type;
    }
  };

  const [activeTab, setActiveTab] = useState<'updates' | 'files' | 'activity'>('updates');
  const chatCol = columns.find(c => c.type === 'chat');
  const filesCol = columns.find(c => c.type === 'files');
  const updates = chatCol ? (task.columnValues[chatCol.id] as any[]) || [] : [];
  const files = filesCol ? (task.columnValues[filesCol.id] as any[]) || [] : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange => !onOpenChange && onClose()}>
      <DialogContent className="sm:max-w-[700px] gap-0 p-0 overflow-hidden border-none shadow-2xl bg-white max-h-[90vh] flex flex-col">
        <div className="h-1.5 w-full bg-[#0073ea]" />
        
        <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
          <DialogHeader className="mb-8">
             <input
                className="text-3xl font-bold text-[#323338] bg-transparent border-none focus:ring-0 w-full p-0 hover:bg-slate-50 rounded px-2 -ml-2 transition-colors"
                value={task.name}
                onChange={(e) => onUpdate({ ...task, name: e.target.value })}
                placeholder="Nome da tarefa"
             />
          </DialogHeader>

          <div className="space-y-8">
            {columns.map((column) => {
              if (column.type === 'chat' || column.type === 'files') return null; // Don't show these in the generic property list, they have dedicated tabs
              const Icon = getIcon(column.type);
              const value = task.columnValues[column.id];

              return (
                <div key={column.id} className="flex items-start gap-6 group">
                  <div className="flex items-center gap-3 w-40 shrink-0 pt-1.5">
                    <div className="p-1.5 bg-slate-50 rounded-md text-[#676879] group-hover:bg-slate-100 transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium text-[#676879]">{column.title}</span>
                  </div>
                  
                  <div className="flex-1 min-h-[36px] flex items-center">
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
                          className="text-xs text-blue-500 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
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
                      <div className="flex items-center gap-4 w-full bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <div className="flex flex-col gap-1 flex-1">
                             <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Início</span>
                             <input 
                               type="date"
                               className="text-sm text-[#323338] bg-transparent border-none focus:ring-0 p-0 font-medium"
                               value={value?.start || ''}
                               onChange={(e) => updateColumnValue(column.id, { ...value, start: e.target.value })}
                             />
                          </div>
                          <ArrowRight className="w-4 h-4 text-slate-300" />
                          <div className="flex flex-col gap-1 flex-1">
                             <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Término</span>
                             <input 
                               type="date"
                               className="text-sm text-[#323338] bg-transparent border-none focus:ring-0 p-0 font-medium"
                               value={value?.end || ''}
                               onChange={(e) => updateColumnValue(column.id, { ...value, end: e.target.value })}
                             />
                          </div>
                          {(value?.start || value?.end) && (
                            <button 
                              onClick={() => updateColumnValue(column.id, null)}
                              className="px-2 py-1 hover:bg-red-100 text-red-500 rounded text-[10px] font-bold uppercase transition-colors"
                            >
                              Limpar
                            </button>
                          )}
                      </div>
                    )}

                    {column.type === 'date' && (
                      <div className="flex items-center gap-3 w-full">
                        <input 
                          type="date"
                          className="text-sm text-[#323338] font-medium bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-500 focus:ring-0 p-1 transition-all"
                          value={value || ''}
                          onChange={(e) => updateColumnValue(column.id, e.target.value)}
                        />
                        {value && (
                          <button 
                            onClick={() => updateColumnValue(column.id, null)}
                            className="px-2 py-1 hover:bg-red-100 text-red-500 rounded text-[10px] font-bold uppercase transition-colors"
                          >
                            Limpar
                          </button>
                        )}
                      </div>
                    )}

                    {column.type === 'number' && (
                      <input 
                        type="number"
                        className="text-sm text-[#323338] font-medium bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-500 focus:ring-0 p-1 w-full transition-all"
                        value={value || ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          updateColumnValue(column.id, isNaN(val) ? null : val);
                        }}
                      />
                    )}

                    {column.type === 'text' && (
                      <textarea 
                        className="text-sm text-[#323338] bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-500 focus:ring-0 p-1 w-full rounded resize-none min-h-[36px]"
                        rows={1}
                        value={value || ''}
                        onChange={(e) => updateColumnValue(column.id, e.target.value)}
                        placeholder="Adicionar texto..."
                      />
                    )}

                    {column.type === 'progress' && (
                      <div className="flex items-center gap-4 w-full">
                        <input 
                          type="range"
                          min="0"
                          max="100"
                          className="flex-1 h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-[#00c875]"
                          value={value || 0}
                          onChange={(e) => updateColumnValue(column.id, parseInt(e.target.value))}
                        />
                        <span className="text-sm font-bold text-[#676879] tabular-nums min-w-[40px] text-right">{value || 0}%</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-12 pt-8 border-t border-slate-100">
             <div className="flex gap-8 mb-8 border-b border-slate-100">
                <button 
                  onClick={() => setActiveTab('updates')}
                  className={cn("pb-3 text-sm transition-all border-b-2", activeTab === 'updates' ? "font-bold border-blue-500 text-blue-600" : "font-semibold text-[#676879] border-transparent hover:border-slate-300")}
                >
                  Atualizações ({updates.length})
                </button>
                <button 
                  onClick={() => setActiveTab('files')}
                  className={cn("pb-3 text-sm transition-all border-b-2", activeTab === 'files' ? "font-bold border-blue-500 text-blue-600" : "font-semibold text-[#676879] border-transparent hover:border-slate-300")}
                >
                  Arquivos ({files.length})
                </button>
                <button 
                  onClick={() => setActiveTab('activity')}
                  className={cn("pb-3 text-sm transition-all border-b-2", activeTab === 'activity' ? "font-bold border-blue-500 text-blue-600" : "font-semibold text-[#676879] border-transparent hover:border-slate-300")}
                >
                  Atividade
                </button>
             </div>

             <div className="space-y-8">
                {activeTab === 'updates' && (
                  <>
                    <div className="relative group">
                       <textarea 
                         className="w-full p-4 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none min-h-[120px] shadow-sm transition-all"
                         placeholder="Escreva uma atualização..."
                         onKeyDown={(e) => {
                           if (e.key === 'Enter' && !e.shiftKey) {
                             e.preventDefault();
                             const text = e.currentTarget.value.trim();
                             if (text && chatCol) {
                               const newUpdate = { id: `upd-${Date.now()}`, text, createdAt: new Date().toISOString(), author: { name: 'Você', avatar: null } };
                               updateColumnValue(chatCol.id, [...updates, newUpdate]);
                               e.currentTarget.value = '';
                             }
                           }
                         }}
                       />
                       <div className="absolute bottom-3 right-3 flex gap-2">
                           <button className="px-4 py-2 bg-blue-500 text-white rounded-lg text-xs font-bold hover:bg-blue-600 transition-all shadow-md active:scale-95">Postar</button>
                       </div>
                    </div>

                    <div className="space-y-6">
                       {updates.slice().reverse().map((upd: any) => (
                         <div key={upd.id} className="flex gap-4 p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm uppercase">
                              {upd.author?.name?.split(' ').map((n: string) => n[0]).join('') || '?'}
                            </div>
                            <div className="flex-1">
                               <div className="flex items-center gap-2 mb-2">
                                  <span className="text-sm font-bold text-[#323338]">{upd.author?.name || 'Membro'}</span>
                                  <span className="text-[10px] text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-full">
                                    {isValid(parseISO(upd.createdAt)) ? format(parseISO(upd.createdAt), "dd 'de' MMM, HH:mm", { locale: ptBR }) : 'Agora'}
                                  </span>
                               </div>
                               <p className="text-sm text-[#323338] leading-relaxed">
                                  {upd.text}
                               </p>
                            </div>
                         </div>
                       ))}
                       {updates.length === 0 && <p className="text-center text-sm text-slate-400 py-10">Nenhuma atualização ainda.</p>}
                    </div>
                  </>
                )}

                {activeTab === 'files' && (
                  <div className="grid grid-cols-2 gap-4">
                    {files.map((file: any) => (
                      <div key={file.id} className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-all group/fileitem">
                        <div className="w-12 h-12 rounded bg-blue-50 flex items-center justify-center text-blue-500">
                          <Paperclip className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-[#323338] truncate">{file.name}</p>
                          <p className="text-[10px] text-slate-400 uppercase">{file.size}</p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover/fileitem:opacity-100 transition-opacity">
                          {file.url && (
                             <button onClick={() => window.open(file.url, '_blank')} className="p-2 hover:bg-blue-50 text-blue-500 rounded-lg transition-colors"><MessageCircle className="w-4 h-4" /></button>
                          )}
                          <button onClick={() => {
                             if (filesCol) updateColumnValue(filesCol.id, files.filter((f: any) => f.id !== file.id));
                          }} className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    ))}
                    {files.length === 0 && <p className="col-span-2 text-center text-sm text-slate-400 py-20 border-2 border-dashed border-slate-100 rounded-2xl">Arraste arquivos aqui ou use a coluna na tabela.</p>}
                  </div>
                )}
             </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
           <button 
             onClick={() => { onDelete(task.id); onClose(); }}
             className="px-4 py-2 hover:bg-red-50 text-red-500 rounded-lg transition-all flex items-center gap-2 text-xs font-bold group"
           >
             <Trash2 className="w-4 h-4 group-hover:shake" />
             Excluir tarefa
           </button>
           
           <button 
             onClick={onClose}
             className="px-8 py-2.5 bg-[#0073ea] text-white rounded-lg text-sm font-bold hover:bg-[#0060c2] transition-all shadow-lg active:scale-95 flex items-center gap-2"
           >
             Concluído
           </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
