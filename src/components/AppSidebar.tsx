import { useState } from 'react';
import { LayoutDashboard, Plus, ChevronDown, Search, Home, Settings, Users, Bell, Bookmark, Mail, Grid, Inbox, Star, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Board } from '@/types/board';
import { cn } from '@/lib/utils';
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
}

export default function AppSidebar({ 
  boards, 
  activeBoardId, 
  onSelectBoard, 
  onAddBoard,
  onRenameBoard,
  onDeleteBoard
}: AppSidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredBoards = boards.filter(b => b.title.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="flex h-screen shrink-0 group/sidebar">
      {/* Workspace Sidebar */}
      <aside className="w-[240px] bg-white flex flex-col border-r border-[#e6e9ef] transition-all">
        <div className="p-4 border-b border-[#e6e9ef]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-[#333333] text-sm">Workspace Principal</h2>
            <button 
              onClick={onAddBoard}
              className="p-1 hover:bg-slate-100 rounded group/add transition-all"
              title="Novo Quadro"
            >
              <Plus className="w-4 h-4 text-muted-foreground group-hover/add:text-blue-500" />
            </button>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Buscar quadros..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 h-8 bg-[#f5f6f8] border-none rounded text-xs focus:ring-1 focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-4 space-y-1 no-scrollbar">
          <WorkspaceItem icon={Home} label="Início" />
          <WorkspaceItem icon={Users} label="Equipe" />
          
          <div className="mt-8 mb-2 px-2 text-[10px] font-bold text-[#676879] uppercase tracking-widest flex items-center justify-between">
            <span>Meus Quadros</span>
            <button className="hover:bg-slate-100 p-0.5 rounded transition-colors">
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>

          {filteredBoards.map((board) => (
            <div key={board.id} className="relative group/item flex items-center">
              <button
                onClick={() => onSelectBoard(board.id)}
                className={cn(
                  "flex items-center gap-2 w-full px-2 py-2 rounded text-[13px] transition-all flex-1 text-left",
                  activeBoardId === board.id
                    ? "bg-[#e5f4ff] text-blue-600 font-medium"
                    : "text-[#333333] hover:bg-[#f5f6f8]"
                )}
              >
                <div className={cn(
                  "w-4 h-4 rounded-sm flex items-center justify-center text-[10px] text-white font-bold",
                  activeBoardId === board.id ? "bg-blue-500" : "bg-slate-300 group-hover/item:bg-slate-400"
                )}>
                  {board.title[0].toUpperCase()}
                </div>
                <span className="truncate flex-1">{board.title}</span>
              </button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="absolute right-1 p-1 hover:bg-white/50 rounded opacity-0 group-hover/item:opacity-100 transition-opacity">
                    <MoreHorizontal className="w-3.5 h-3.5 text-[#676879]" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="start" className="w-48 p-1 bg-white border border-slate-100 shadow-xl rounded-md">
                   <DropdownMenuItem className="flex items-center gap-2 p-2 text-xs hover:bg-slate-50 cursor-pointer rounded" onClick={() => {
                     const newTitle = prompt('Novo nome do quadro:', board.title);
                     if (newTitle) onRenameBoard(board.id, newTitle);
                   }}>
                      <Pencil className="w-3.5 h-3.5" /> Renomear
                   </DropdownMenuItem>
                   <DropdownMenuItem className="flex items-center gap-2 p-2 text-xs text-red-600 hover:bg-red-50 cursor-pointer rounded" onClick={() => onDeleteBoard(board.id)}>
                      <Trash2 className="w-3.5 h-3.5" /> Excluir
                   </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function WorkspaceItem({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <button className="flex items-center gap-2 w-full px-2 py-2 rounded text-[13px] text-[#333333] hover:bg-[#f5f6f8] transition-colors group">
      <Icon className="w-4 h-4 text-[#676879] group-hover:text-blue-500" />
      <span>{label}</span>
    </button>
  );
}
