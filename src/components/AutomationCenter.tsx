import { useState } from 'react';
import { 
  Zap, 
  Plus, 
  Trash2, 
  MoreVertical, 
  CheckCircle2, 
  Circle,
  ArrowRight,
  MessageSquare,
  Move,
  History
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Automation } from '@/types/automation';
import { cn } from '@/lib/utils';

interface AutomationCenterProps {
  open: boolean;
  onClose: () => void;
  automations: Automation[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function AutomationCenter({ open, onClose, automations, onToggle, onDelete }: AutomationCenterProps) {
  const [activeTab, setActiveTab] = useState<'board' | 'activity'>('board');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] h-[600px] flex flex-col p-0 gap-0 overflow-hidden border-none shadow-2xl">
        <div className="bg-[#111111] text-white p-6 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center">
                  <Zap className="w-6 h-6 text-white fill-current" />
               </div>
               <div>
                  <DialogTitle className="text-xl font-medium">Fluxo de Automatação</DialogTitle>
                  <p className="text-sm text-slate-400">Automatize tarefas repetitivas e conecte seus fluxos.</p>
               </div>
            </div>
            <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-md flex items-center gap-2 text-sm font-medium transition-colors">
               <Plus className="w-4 h-4" />
               Criar Nova Automação
            </button>
          </div>

          <div className="flex gap-6 mt-6">
             <button 
               onClick={() => setActiveTab('board')}
               className={cn(
                 "pb-2 text-sm font-medium border-b-2 transition-colors",
                 activeTab === 'board' ? "border-blue-500 text-white" : "border-transparent text-slate-400 hover:text-white"
               )}
             >
               Automações do Quadro
             </button>
             <button 
               onClick={() => setActiveTab('activity')}
               className={cn(
                 "pb-2 text-sm font-medium border-b-2 transition-colors",
                 activeTab === 'activity' ? "border-blue-500 text-white" : "border-transparent text-slate-400 hover:text-white"
               )}
             >
               Logs de Atividade
             </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#F5F6F8] p-6">
           {activeTab === 'board' ? (
              <div className="space-y-4">
                 {automations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                       <Zap className="w-12 h-12 text-slate-300 mb-4" />
                       <h3 className="text-lg font-medium text-slate-600">Nenhuma automação ativa</h3>
                       <p className="text-sm text-slate-500 max-w-sm mx-auto">
                          As automações ajudam você a economizar tempo movendo itens, atualizando status e enviando notificações automaticamente.
                       </p>
                    </div>
                 ) : (
                    automations.map(automation => (
                       <div key={automation.id} className="bg-white rounded-lg border border-slate-200 p-5 flex items-center justify-between group hover:border-blue-300 transition-all">
                          <div className="flex gap-4">
                             <div className={cn(
                                "w-10 h-10 rounded-lg flex items-center justify-center",
                                automation.isActive ? "bg-blue-50 text-blue-500" : "bg-slate-50 text-slate-400"
                             )}>
                                {automation.action.type === 'notify_user' && <MessageSquare className="w-5 h-5" />}
                                {automation.action.type === 'move_to_group' && <Move className="w-5 h-5" />}
                                {automation.action.type === 'update_column' && <Zap className="w-5 h-5" />}
                             </div>
                             <div>
                                <h4 className="font-medium text-slate-800 mb-1">{automation.name}</h4>
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                   <span className="bg-slate-100 px-2 py-0.5 rounded italic">Trigger: {automation.trigger.type.replace(/_/g, ' ')}</span>
                                   <ArrowRight className="w-3 h-3" />
                                   <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded italic">Action: {automation.action.type.replace(/_/g, ' ')}</span>
                                </div>
                             </div>
                          </div>

                          <div className="flex items-center gap-4">
                             <button 
                               onClick={() => onToggle(automation.id)}
                               className={cn(
                                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                                automation.isActive ? "bg-blue-600" : "bg-slate-200"
                               )}
                             >
                                <span className={cn(
                                   "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                                   automation.isActive ? "translate-x-6" : "translate-x-1"
                                )} />
                             </button>
                             <button 
                               onClick={() => onDelete(automation.id)}
                               className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                             >
                                <Trash2 className="w-4 h-4" />
                             </button>
                          </div>
                       </div>
                    ))
                 )}
              </div>
           ) : (
              <div className="space-y-3">
                 {[1, 2, 3].map(i => (
                    <div key={i} className="flex gap-4 p-4 bg-white rounded-lg border border-slate-100">
                       <div className="shrink-0 w-8 h-8 rounded-full bg-green-50 flex items-center justify-center">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                       </div>
                       <div>
                          <p className="text-sm text-slate-700">
                             <span className="font-medium">Mover Item</span> foi executado com sucesso em <span className="font-medium">"Tarefa #23"</span>.
                          </p>
                          <span className="text-[11px] text-slate-400">Há {i * 10} minutos</span>
                       </div>
                    </div>
                 ))}
              </div>
           )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
