import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Board } from "@/types/board";
import { Archive, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { useMemo } from "react";

interface ArchivedItemsDialogProps {
  open: boolean;
  onClose: () => void;
  board: Board;
  onUnarchiveGroup: (groupId: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onUnarchiveTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
}

export default function ArchivedItemsDialog({ 
  open, 
  onClose, 
  board,
  onUnarchiveGroup,
  onDeleteGroup,
  onUnarchiveTask,
  onDeleteTask
}: ArchivedItemsDialogProps) {
  const archivedGroups = board.groups.filter(g => g.archived);
  
  // Otimização: criar mapa de tarefas arquivadas e seus grupos
  const archivedItems = board.groups.flatMap(group => 
    group.tasks.filter(t => t.archived).map(task => ({ task, group }))
  );

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-3xl bg-white focus:outline-none">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Archive className="w-6 h-6 text-amber-500" />
            Itens Arquivados de "{board.title}"
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-8 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
          {/* Grupos Section */}
          <div>
            <h3 className="text-xs font-bold mb-4 text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
              Grupos Arquivados ({archivedGroups.length})
            </h3>
            {archivedGroups.length > 0 ? (
              <div className="grid gap-2">
                {archivedGroups.map(group => (
                  <div key={group.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl hover:border-amber-200 hover:bg-amber-50/30 transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-md shadow-sm" style={{ backgroundColor: group.color }} />
                      <span className="font-semibold text-[#323338]">{group.title}</span>
                    </div>
                    <div className="flex items-center gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 gap-1.5 text-xs font-medium bg-white"
                        onClick={() => onUnarchiveGroup(group.id)}
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Restaurar
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 gap-1.5 text-xs font-medium text-red-500 hover:text-white hover:bg-red-500 border-red-100"
                        onClick={() => onDeleteGroup(group.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Excluir
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs italic">
                Nenhum grupo arquivado
              </div>
            )}
          </div>

          {/* Tarefas Section */}
          <div>
            <h3 className="text-xs font-bold mb-4 text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
              Tarefas Arquivadas ({archivedItems.length})
            </h3>
            {archivedItems.length > 0 ? (
              <div className="grid gap-2">
                {archivedItems.map(({ task, group }) => {
                   return (
                    <div key={task.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:border-blue-200 hover:bg-blue-50/30 transition-all group">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-[#323338]">{task.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400">Grupo original:</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: group?.color + '20', color: group?.color }}>
                            {group?.title}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 gap-1.5 text-xs font-medium bg-white"
                          onClick={() => onUnarchiveTask(task.id)}
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Restaurar
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 gap-1.5 text-xs font-medium text-red-500 hover:text-white hover:bg-red-500 border-red-100"
                          onClick={() => onDeleteTask(task.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Excluir
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs italic">
                Nenhuma tarefa arquivada
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

