import { Board, TaskGroup, STATUS_LABELS } from '@/types/board';
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  AlertCircle 
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardViewProps {
  board: Board;
}

export default function DashboardView({ board }: DashboardViewProps) {
  const allTasks = board.groups.flatMap(g => g.tasks);
  const totalTasks = allTasks.length;
  
  const statusCounts = allTasks.reduce((acc, task) => {
    const status = (task.columnValues.status as string) || 'default';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const completedTasks = statusCounts.done || 0;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="flex-1 bg-[#F5F6F8] p-8 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-xl font-bold text-[#323338] mb-8">Dashboard do Quadro</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
           <StatCard 
             title="Total de Tarefas" 
             value={totalTasks} 
             icon={BarChart3} 
             color="blue" 
           />
           <StatCard 
             title="Concluídas" 
             value={completedTasks} 
             icon={CheckCircle2} 
             color="green" 
             subValue={`${progressPercent}% do total`}
           />
           <StatCard 
             title="Em Progresso" 
             value={statusCounts.working || 0} 
             icon={TrendingUp} 
             color="orange" 
           />
           <StatCard 
             title="Travadas" 
             value={statusCounts.stuck || 0} 
             icon={AlertCircle} 
             color="red" 
           />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           {/* Progress Chart */}
           <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-[#323338] mb-6 flex items-center gap-2">
                 <PieChart className="w-4 h-4 text-blue-500" />
                 Distribuição de Status
              </h3>
              <div className="space-y-4">
                 {Object.entries(STATUS_LABELS).map(([key, label]) => {
                    const count = statusCounts[key] || 0;
                    const percent = totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0;
                    return (
                       <div key={key} className="space-y-1">
                          <div className="flex justify-between text-xs font-medium">
                             <span className="text-[#676879]">{label}</span>
                             <span className="text-[#323338]">{count} ({percent}%)</span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                             <div 
                               className={cn(
                                 "h-full transition-all duration-1000",
                                 key === 'done' ? "bg-green-500" :
                                 key === 'working' ? "bg-orange-400" :
                                 key === 'stuck' ? "bg-red-500" : "bg-slate-300"
                               )}
                               style={{ width: `${percent}%` }}
                             />
                          </div>
                       </div>
                    );
                 })}
              </div>
           </div>

           {/* Performance Widget */}
           <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
              <h3 className="text-sm font-bold text-[#323338] mb-8 w-full text-left">Saúde do Projeto</h3>
              <div className="relative w-40 h-40">
                 <svg className="w-full h-full" viewBox="0 0 36 36">
                    <path
                       className="text-slate-100"
                       strokeDasharray="100, 100"
                       d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                       fill="none"
                       stroke="currentColor"
                       strokeWidth="3"
                    />
                    <path
                       className="text-blue-500"
                       strokeDasharray={`${progressPercent}, 100`}
                       d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                       fill="none"
                       stroke="currentColor"
                       strokeWidth="3"
                       strokeLinecap="round"
                    />
                 </svg>
                 <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-[#323338]">{progressPercent}%</span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Progresso</span>
                 </div>
              </div>
              <div className="mt-8 grid grid-cols-2 gap-4 w-full">
                 <div className="bg-slate-50 p-3 rounded-lg">
                    <span className="block text-xs text-slate-500 mb-1">Taxa de Sucesso</span>
                    <span className="text-sm font-bold text-[#323338]">Alta</span>
                 </div>
                 <div className="bg-slate-50 p-3 rounded-lg">
                    <span className="block text-xs text-slate-500 mb-1">Itens Críticos</span>
                    <span className="text-sm font-bold text-red-500">2</span>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, subValue }: { 
  title: string; 
  value: number|string; 
  icon: any; 
  color: 'blue'|'green'|'orange'|'red'|'purple';
  subValue?: string;
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-500',
    green: 'bg-green-50 text-green-500',
    orange: 'bg-orange-50 text-orange-500',
    red: 'bg-red-50 text-red-500',
    purple: 'bg-purple-50 text-purple-500',
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className={cn("p-2 rounded-lg", colors[color])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="space-y-1">
         <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</h4>
         <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#323338]">{value}</span>
            {subValue && <span className="text-[10px] text-slate-400 font-medium">{subValue}</span>}
         </div>
      </div>
    </div>
  );
}
