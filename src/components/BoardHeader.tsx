import { useMemo, useState } from 'react';
import { Board, ViewMode, STATUS_LABELS, PRIORITY_LABELS } from '@/types/board';
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
  ChevronDown,
  Sparkles,
  Zap,
  Repeat,
  Star,
  UserCircle,
  Download,
  ListPlus,
  MoreHorizontal,
  Archive,
  Settings
} from 'lucide-react';

import { cn } from '@/lib/utils';

interface BoardHeaderProps {
  title: string;
  board: Board;
  viewMode: ViewMode;
  onViewChange: (mode: ViewMode) => void;
  onAddTask: () => void;
  onAutomationsClick: () => void;
  automationsCount: number;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  activeFilters: Record<string, string[]>;
  onFilterChange: (filters: Record<string, string[]>) => void;
  onAddGroup: () => void;
  onImportClick: () => void;
  onShowArchived: () => void;
  collapsedCount: number;
  totalGroups: number;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  teamMembers?: { id: string, name: string }[];
}


const views: { mode: ViewMode; icon: React.ElementType; label: string }[] = [
  { mode: 'table', icon: Table2, label: 'Tabela' },
  { mode: 'ganttJobs', icon: GanttChart, label: 'Gantt de Jobs' },
  { mode: 'gantt', icon: GanttChart, label: 'Gantt' },
  { mode: 'dashboard', icon: Kanban, label: 'Desempenho Oficial' },
];

export default function BoardHeader({ 
  title, 
  board,
  viewMode, 
  onViewChange, 
  onAddTask, 
  onAutomationsClick,
  automationsCount,
  searchTerm,
  onSearchChange,
  activeFilters,
  onFilterChange,
  onAddGroup,
  onImportClick,
  onShowArchived,
  collapsedCount,
  totalGroups,
  onCollapseAll,
  onExpandAll,
  teamMembers = []
}: BoardHeaderProps) {
  const handleNotImplemented = (feature: string) => {
    alert(`${feature} em desenvolvimento!`);
  };

  const activeViews = views.map(v => {
    if (v.mode === 'dashboard' && title.toLowerCase().includes('desempenho oficial')) return { ...v, label: 'Dashboard' };
    return v;
  }).filter(v => {
    if (title.toLowerCase().includes('desempenho oficial')) {
      return v.mode === 'table' || v.mode === 'dashboard';
    }
    return true;
  });

  // Calculate allocated people
  const allocatedPeople = useMemo(() => {
    const peopleMap = new Map<string, { id: string, name: string, avatar?: string }>();
    if (!board || !board.groups) return [];
    
    // Nomes permitidos (da aba Equipe)
    const allowedNames = teamMembers.map(m => m.name);

    board.groups.forEach(g => {
      g.tasks.forEach(t => {
        Object.values(t.columnValues).forEach(val => {
          if (Array.isArray(val)) {
            val.forEach(p => {
              if (p && typeof p === 'object' && 'id' in p && 'name' in p) {
                const person = p as any;
                if (allowedNames.length === 0 || allowedNames.includes(person.name)) {
                  peopleMap.set(person.id as string, person);
                }
              }
            });
          } else if (val && typeof val === 'object' && 'id' in val && 'name' in val) {
            const person = val as any;
            if (allowedNames.length === 0 || allowedNames.includes(person.name)) {
              peopleMap.set(person.id as string, person);
            }
          }
        });
      });
    });
    return Array.from(peopleMap.values());
  }, [board, teamMembers]);

  // Quick Filters Logic
  const categories = useMemo(() => {
    if (!board) return [];
    const cats: { id: string, label: string, values: Record<string, number> }[] = [
      { id: 'group', label: 'Grupo', values: {} },
      { id: 'name', label: 'Tarefa', values: {} }
    ];

    board.columns.forEach(col => {
      if (['status', 'priority', 'text', 'number', 'person'].includes(col.type)) {
        const cat = { id: col.id, label: col.title, values: {} as Record<string, number> };
        
        // Se for coluna de pessoa, pré-estabelece quem está na equipe
        if (col.type === 'person' && teamMembers.length > 0) {
          teamMembers.forEach(m => {
            cat.values[m.name] = 0;
          });
        }
        
        cats.push(cat);
      }
    });

    board.groups.forEach(g => {
      cats[0].values[g.title] = (cats[0].values[g.title] || 0) + g.tasks.length;
      g.tasks.forEach(t => {
        cats[1].values[t.name] = (cats[1].values[t.name] || 0) + 1;
        
        board.columns.forEach(col => {
          let val = t.columnValues[col.id];
          if (val === undefined || val === null || val === '') return;

          const cat = cats.find(c => c.id === col.id);
          if (!cat) return;

          let displayVal = '';
          if (col.type === 'status') {
            displayVal = STATUS_LABELS[val as any] || 'Não iniciado';
          } else if (col.type === 'priority') {
            displayVal = PRIORITY_LABELS[val as any] || 'Média';
          } else if (col.type === 'person') {
            const names = teamMembers?.map(m => m.name) || [];
            if (Array.isArray(val)) {
              val.forEach(p => {
                if (p && p.name && (names.length === 0 || names.includes(p.name))) {
                  cat.values[p.name] = (cat.values[p.name] || 0) + 1;
                }
              });
              return;
            } else if (val && typeof val === 'object' && 'name' in val) {
              const nm = (val as any).name;
              if (names.length === 0 || names.includes(nm)) displayVal = nm;
            } else {
              return;
            }
          } else {
            displayVal = String(val);
          }

          if (displayVal) {
            cat.values[displayVal] = (cat.values[displayVal] || 0) + 1;
          }
        });
      });
    });

    return cats;
  }, [board]);

  const toggleFilter = (catId: string, value: string) => {
    const current = activeFilters[catId] || [];
    const next = current.includes(value) 
      ? current.filter(v => v !== value)
      : [...current, value];
    
    onFilterChange({ ...activeFilters, [catId]: next });
  };

  const clearFilters = () => onFilterChange({});

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
          {activeViews.map((view) => (
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

          <div className="relative group ml-1 flex items-center bg-white border border-slate-200 rounded-md focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
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
              <button className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors",
                activeFilters.person?.length ? "bg-blue-50 text-blue-600 font-medium" : "text-muted-foreground hover:bg-muted"
              )}>
                <UserCircle className="w-4 h-4 text-[#676879]" />
                <span>Pessoa</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80 p-4 bg-white border border-slate-100 shadow-2xl rounded-xl">
               <div className="text-sm font-semibold mb-4">Pessoas alocadas neste quadro</div>
               <div className="flex flex-wrap gap-3">
                  {allocatedPeople.length > 0 ? (
                    allocatedPeople.map((person) => (
                      <div 
                        key={person.id} 
                        className={cn(
                          "flex flex-col items-center gap-1 cursor-pointer group transition-all",
                          activeFilters.person?.includes(person.name) ? "scale-105" : "opacity-70 hover:opacity-100"
                        )}
                        onClick={() => toggleFilter('person', person.name)}
                      >
                        <div 
                          className={cn(
                            "w-12 h-12 rounded-full border-2 transition-all flex items-center justify-center text-xs font-bold text-slate-600 bg-cover bg-center shadow-md",
                            activeFilters.person?.includes(person.name) ? "border-blue-500 ring-2 ring-blue-100" : "border-white"
                          )}
                          style={person.avatar ? { backgroundImage: `url(${person.avatar})` } : { backgroundColor: '#e2e8f0' }}
                        >
                          {!person.avatar && person.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="text-[10px] font-medium text-slate-600 max-w-[50px] truncate">{person.name}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-slate-400 py-4 text-center w-full italic">Nenhuma pessoa alocada nas tarefas</div>
                  )}
               </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors",
                Object.keys(activeFilters).filter(k => k !== 'person').some(k => activeFilters[k]?.length > 0) ? "bg-blue-50 text-blue-600 font-medium" : "text-muted-foreground hover:bg-muted"
              )}>
                <Filter className="w-4 h-4 text-[#676879]" />
                <span>Filtro</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#676879]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[850px] p-6 bg-white border border-slate-200 shadow-2xl rounded-2xl max-h-[80vh] overflow-hidden flex flex-col">
               <div className="flex items-center justify-between mb-6">
                 <div>
                   <h3 className="text-lg font-bold text-slate-800">Filtros rápidos</h3>
                   <p className="text-xs text-slate-500 mt-1">Refine seu quadro selecionando categorias abaixo</p>
                 </div>
                 <div className="flex items-center gap-4">
                    <button onClick={clearFilters} className="text-sm font-medium text-blue-600 hover:text-blue-700">Limpar todos</button>
                    <button onClick={() => handleNotImplemented('Salvar Visualização')} className="px-4 py-2 bg-[#f5f6f8] text-slate-500 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-100">Salvar como nova visualização</button>
                 </div>
               </div>

               <div className="flex-1 overflow-x-auto pb-4 custom-scrollbar">
                  <div className="flex gap-8 min-w-max h-full">
                    {categories.map((cat) => (
                      <div key={cat.id} className="w-48 shrink-0 flex flex-col gap-3">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
                          {cat.label}
                        </label>
                        <div className="flex flex-col gap-1.5 overflow-y-auto pr-2 max-h-[400px] custom-scrollbar">
                          {Object.entries(cat.values).length > 0 ? (
                            Object.entries(cat.values).map(([val, count]) => (
                              <button
                                key={val}
                                onClick={() => toggleFilter(cat.id, val)}
                                className={cn(
                                  "flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all border group/item",
                                  activeFilters[cat.id]?.includes(val) 
                                    ? "bg-blue-600 text-white border-blue-600 shadow-md font-medium" 
                                    : "bg-slate-50 text-slate-700 border-slate-100 hover:border-slate-300 hover:bg-white"
                                )}
                              >
                                <span className="truncate flex-1 text-left">{val}</span>
                                <span className={cn(
                                  "text-[10px] min-w-[20px] px-1.5 py-0.5 rounded-full text-center transition-colors font-bold",
                                  activeFilters[cat.id]?.includes(val) ? "bg-white/20 text-white" : "bg-slate-200 text-slate-500"
                                )}>
                                  {count}
                                </span>
                              </button>
                            ))
                          ) : (
                            <div className="text-[11px] text-slate-400 italic px-2 py-4">Sem valores</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
               </div>
               
               <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                  <button className="text-sm font-medium text-slate-500 hover:text-slate-700">Alternar para filtros avançados</button>
               </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="h-4 w-px bg-slate-200 mx-1" />
          
          <button 
            onClick={collapsedCount >= totalGroups ? onExpandAll : onCollapseAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-slate-500 hover:bg-slate-100 hover:text-blue-600 transition-all font-bold"
          >
            {collapsedCount >= totalGroups ? (
              <span className="flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-blue-500" /> 
                <span>Expandir tudo</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <ChevronDown className="w-4 h-4" /> 
                <span>Recolher tudo</span>
              </span>
            )}
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-2 text-muted-foreground hover:bg-muted rounded-md transition-colors">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-white shadow-xl rounded-lg p-1">
               <DropdownMenuItem onClick={onShowArchived} className="flex items-center gap-2 p-2 text-sm hover:bg-slate-50 cursor-pointer rounded">
                  <Archive className="w-4 h-4 text-amber-500" /> Itens Arquivados
               </DropdownMenuItem>
               <DropdownMenuSeparator className="my-1 bg-slate-100" />
               <DropdownMenuItem onClick={() => alert('Configurações do Projeto')} className="flex items-center gap-2 p-2 text-sm hover:bg-slate-50 cursor-pointer rounded">
                  <Settings className="w-4 h-4 text-slate-500" /> Configurações
               </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

