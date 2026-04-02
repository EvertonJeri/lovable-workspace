import { ViewMode } from '@/types/board';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { 
  Table2, 
  Kanban, 
  GanttChart, 
  Plus, 
  Search, 
  Filter, 
  User, 
  ArrowUpDown, 
  EyeOff, 
  LayoutGrid, 
  MoreHorizontal,
  ChevronDown,
  Sparkles,
  Zap,
  Repeat,
  Star,
  FolderPlus,
  UserCircle,
  Download,
  ListPlus,
  FileJson
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BoardHeaderProps {
  title: string;
  viewMode: ViewMode;
  onViewChange: (mode: ViewMode) => void;
  onAddTask: () => void;
  onAutomationsClick: () => void;
  automationsCount: number;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onAddGroup: () => void;
  onImportClick: () => void;
}

const views: { mode: ViewMode; icon: React.ElementType; label: string }[] = [
  { mode: 'table', icon: Table2, label: 'Tabela' },
  { mode: 'kanban', icon: Kanban, label: 'Kanban' },
  { mode: 'gantt', icon: GanttChart, label: 'Gantt' },
  { mode: 'dashboard', icon: LayoutGrid, label: 'Dashboard' },
];

export default function BoardHeader({ 
  title, 
  viewMode, 
  onViewChange, 
  onAddTask, 
  onAutomationsClick,
  automationsCount,
  searchTerm,
  onSearchChange,
  onAddGroup,
  onImportClick
}: BoardHeaderProps) {
  const handleNotImplemented = (feature: string) => {
    alert(`${feature} em desenvolvimento! \nEstamos integrando esta funcionalidade com recursos de IA para seu fluxo de trabalho.`);
  };

  return (
    <div className="px-6 pt-6 pb-2 border-b border-border bg-background shadow-sm hover:shadow-md transition-shadow relative z-20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-[#323338] flex items-center gap-2 group cursor-pointer transition-colors hover:text-[#0073ea]">
            {title}
            <ChevronDown className="w-5 h-5 text-[#676879] opacity-0 group-hover:opacity-100 transition-all" />
          </h1>
          <div className="flex items-center gap-1 opacity-0 hover:opacity-100 transition-opacity">
            <button className="p-1.5 hover:bg-slate-100 rounded text-muted-foreground hover:text-yellow-500 transition-colors">
              <Star className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-sm text-[#676879] mr-4">
          <button 
            onClick={() => handleNotImplemented('Sidekick / IA')}
            className="flex items-center gap-1.5 hover:text-[#323338] transition-all hover:bg-purple-50 px-3 py-1.5 rounded-full group scale-100 active:scale-95"
          >
            <Sparkles className="w-4 h-4 text-purple-500 group-hover:animate-pulse" />
            Sidekick
          </button>
          <button 
            onClick={() => handleNotImplemented('Integrações')}
            className="flex items-center gap-1.5 hover:text-[#323338] transition-all hover:bg-blue-50 px-3 py-1.5 rounded-full scale-100 active:scale-95"
          >
            <Repeat className="w-4 h-4 text-blue-500" />
            Integrar
          </button>
          <button 
            onClick={onAutomationsClick}
            className="flex items-center gap-1.5 hover:text-[#323338] transition-all hover:bg-yellow-50 px-3 py-1.5 rounded-full scale-100 active:scale-95 group"
          >
            <Zap className="w-4 h-4 text-yellow-500 fill-current opacity-70 group-hover:opacity-100" />
            Automatizar / {automationsCount}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          {views.map((view) => (
            <div 
              key={view.mode}
              className={cn(
                "flex items-center border-b-2 pb-2 -mb-2 transition-all cursor-pointer relative group/v",
                viewMode === view.mode ? "border-blue-500 font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
              onClick={() => onViewChange(view.mode)}
            >
               <button className={cn(
                 "flex items-center gap-1.5 px-3 py-1 rounded transition-colors group-hover/v:bg-slate-50",
                 viewMode === view.mode && "text-blue-600"
               )}>
                  <view.icon className="w-4 h-4" />
                  <span>{view.label}</span>
               </button>
            </div>
          ))}
          <button className="flex items-center gap-1.5 px-3 py-1 pb-2 font-medium text-muted-foreground hover:text-foreground transition-colors border-b-2 border-transparent -mb-2">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mt-6 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center shadow-md rounded-md overflow-hidden hover:shadow-lg transition-shadow">
            <button
              onClick={() => onAddTask()}
              className="flex items-center gap-1 px-4 py-1.5 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors active:bg-blue-800"
            >
              Criar tarefa
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center justify-center px-2 py-1.5 bg-blue-600 text-white hover:bg-blue-700 border-l border-white/20 transition-colors active:bg-blue-800">
                  <ChevronDown className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px] p-2 bg-white border border-slate-100 shadow-xl rounded-lg">
                <DropdownMenuItem className="flex items-center gap-2 p-2 text-sm text-[#323338] hover:bg-slate-50 cursor-pointer rounded transition-colors" onClick={onAddGroup}>
                  <ListPlus className="w-4 h-4 text-[#676879]" />
                  <span>Criar grupo de tarefas</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1 bg-slate-100" />
                <DropdownMenuItem className="flex items-center gap-2 p-2 text-sm text-[#323338] hover:bg-slate-50 cursor-pointer rounded transition-colors" onClick={onImportClick}>
                  <Download className="w-4 h-4 text-green-600" />
                  <span>Importar do Excel</span>
                  <span className="ml-auto text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded font-bold">LIVE</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="relative group max-md:hidden ml-2 flex items-center bg-white border border-slate-200 rounded-md focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <Search className="ml-3 w-4 h-4 text-muted-foreground group-focus-within:text-blue-500" />
            <input
              type="text"
              placeholder="Pesquisar..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-2 pr-4 py-1.5 h-9 bg-transparent border-none focus:ring-0 text-sm w-32 focus:w-48 transition-all"
            />
          </div>

          <div className="h-4 w-px bg-border mx-1" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors">
                <User className="w-4 h-4" />
                <span>Pessoa</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80 p-4 bg-white border border-slate-100 shadow-2xl rounded-xl">
               <div className="text-sm font-semibold mb-4">Filtrar este quadro por...</div>
               <div className="grid grid-cols-6 gap-2 h-40 overflow-y-auto pr-2 custom-scrollbar">
                  {['Ana Silva', 'Carlos Souza', 'Marina Costa', 'Bruno Lima', 'Eduarda Rocha'].map((name, i) => (
                    <div 
                      key={name} 
                      className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white overflow-hidden shadow-sm flex items-center justify-center text-[10px] font-bold text-slate-600 bg-cover bg-center cursor-pointer hover:scale-110 transition-transform active:ring-2 ring-blue-500"
                      style={{ backgroundImage: `url(https://i.pravatar.cc/150?u=${i})` }}
                      title={name}
                      onClick={() => onSearchChange(name)}
                    />
                  ))}
               </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <button onClick={() => handleNotImplemented('Filtro Avançado')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors scale-100 active:scale-95">
            <Filter className="w-4 h-4" />
            <span>Filtro</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          <button onClick={() => handleNotImplemented('Ordenação')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors scale-100 active:scale-95">
            <ArrowUpDown className="w-4 h-4" />
            <span>Ordenar</span>
          </button>

          <button onClick={() => handleNotImplemented('Visualização')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors scale-100 active:scale-95">
            <EyeOff className="w-4 h-4" />
            <span>Ocultar</span>
          </button>

          <button onClick={() => handleNotImplemented('Agrupamento')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors scale-100 active:scale-95 max-lg:hidden">
            <LayoutGrid className="w-4 h-4" />
            <span>Agrupar por</span>
          </button>

          <button className="p-1.5 rounded-md text-muted-foreground hover:bg-muted">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
