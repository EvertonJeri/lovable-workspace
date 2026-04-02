import { useState } from 'react';
import { Layout, Plus, ChevronDown, Search, Users, MoreHorizontal, Pencil, Trash2, LayoutGrid, ChevronLeft, ChevronRight, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Board } from '@/types/board';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface AppSidebarProps {
  boards: Board[];
  activeBoardId: string;
  onSelectBoard: (id: string) => void;
  onAddBoard: () => void;
  onRenameBoard: (id: string, title: string) => void;
  onDeleteBoard: (id: string) => void;
  onDuplicateBoard: (id: string) => void;
  onSelectTeam: () => void;
}

export default function AppSidebar({ 
  boards, 
  activeBoardId, 
  onSelectBoard, 
  onAddBoard,
  onRenameBoard,
  onDeleteBoard,
  onDuplicateBoard,
  onSelectTeam
}: AppSidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const filteredBoards = boards.filter(b => b.title.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="flex h-screen shrink-0 group/sidebar relative">
      <aside className={cn(
        "bg-white flex flex-col border-r border-[#e6e9ef] transition-all duration-300 relative",
        isCollapsed ? "w-[60px]" : "w-[240px]"
      )}>
        <div className={cn("p-4 border-b border-[#e6e9ef]", isCollapsed && "px-2 flex flex-col items-center")}>
          <div className="flex items-center justify-between mb-4">
            {!isCollapsed ? (
              <>
                <h2 className="font-bold text-[#333333] text-sm truncate">Workspace Principal</h2>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={onAddBoard}
                    className="p-1 hover:bg-slate-100 rounded group/add transition-all"
                    title="Novo Projeto"
                  >
                    <Plus className="w-4 h-4 text-muted-foreground group-hover/add:text-blue-500" />
                  </button>
                  <button 
                    onClick={() => setIsCollapsed(true)}
                    className="p-1 hover:bg-slate-100 rounded text-muted-foreground hover:text-blue-500 transition-all"
                    title="Recolher Menu"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <button 
                onClick={() => setIsCollapsed(false)}
                className="p-2 hover:bg-blue-50 rounded-full transition-all text-blue-500"
                title="Expandir Menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
          </div>
          
          {!isCollapsed && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Buscar projetos..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 h-8 bg-[#f5f6f8] border-none rounded text-xs focus:ring-1 focus:ring-blue-500/20"
              />
            </div>
          )}
        </div>

        <div className={cn("flex-1 overflow-y-auto px-2 py-4 space-y-1 no-scrollbar", isCollapsed && "flex flex-col items-center")}>
          <button 
             onClick={onSelectTeam} 
             className={cn(
               "flex items-center gap-2 w-full px-2 py-2 rounded text-[13px] text-[#333333] hover:bg-[#f5f6f8] transition-colors group",
               isCollapsed && "justify-center"
             )}
             title={isCollapsed ? "Equipe" : ""}
          >
            <Users className="w-4 h-4 text-[#676879] group-hover:text-blue-500" />
            {!isCollapsed && <span>Equipe</span>}
          </button>
          
          {!isCollapsed && (
            <div className="mt-8 mb-2 px-2 text-[10px] font-bold text-[#676879] uppercase tracking-widest flex items-center justify-between">
              <span>Meus Projetos</span>
              <button className="hover:bg-slate-100 p-0.5 rounded transition-colors">
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
          )}

          {filteredBoards.map((board) => {
            const isModel = board.title.includes('(MODELO)');
            return (
              <div key={board.id} className="relative group/item flex items-center">
                <div
                  className={cn(
                    "flex items-center gap-2 w-full px-2 py-2 rounded text-[13px] transition-all flex-1 text-left cursor-pointer",
                    activeBoardId === board.id
                      ? (isModel ? "bg-amber-50 text-amber-700 font-medium border border-amber-100" : "bg-[#e5f4ff] text-blue-600 font-medium")
                      : "text-[#333333] hover:bg-[#f5f6f8]",
                    isCollapsed && "justify-center px-0"
                  )}
                  onClick={() => onSelectBoard(board.id)}
                  title={isCollapsed ? board.title : ""}
                >
                  <Layout className={cn(
                    "w-4 h-4 shrink-0",
                    activeBoardId === board.id 
                      ? (isModel ? "text-amber-500" : "text-blue-500")
                      : (isModel ? "text-amber-400" : "text-slate-400")
                  )} />
                  {!isCollapsed && (
                    <span className={cn(
                      "truncate flex-1",
                      isModel && activeBoardId !== board.id && "text-amber-600/70"
                    )}>{board.title}</span>
                  )}
                </div>
                
                {!isCollapsed && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="absolute right-1 p-1 hover:bg-white/50 rounded opacity-0 group-hover/item:opacity-100 transition-opacity">
                        <MoreHorizontal className="w-3.5 h-3.5 text-[#676879]" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start" className="w-48 p-1 bg-white border border-slate-100 shadow-xl rounded-md">
                      <DropdownMenuItem 
                        className="flex items-center gap-2 p-2 text-xs hover:bg-slate-50 cursor-pointer rounded"
                        onClick={(e) => {
                          e.stopPropagation();
                          const newTitle = prompt('Novo nome do projeto:', board.title);
                          if (newTitle) onRenameBoard(board.id, newTitle);
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" /> Renomear
                      </DropdownMenuItem>
                      
                      <DropdownMenuItem 
                        className="flex items-center gap-2 p-2 text-xs hover:bg-slate-50 cursor-pointer rounded"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicateBoard(board.id);
                        }}
                      >
                        <LayoutGrid className="w-3.5 h-3.5" /> Duplicar projeto
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />
                      
                      <DropdownMenuItem 
                        className="flex items-center gap-2 p-2 text-xs text-red-600 hover:bg-red-50 cursor-pointer rounded"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteBoard(board.id);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
