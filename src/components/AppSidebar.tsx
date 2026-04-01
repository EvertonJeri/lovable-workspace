import { useState } from 'react';
import { LayoutDashboard, Plus, ChevronDown, Search, Home, Settings, Users } from 'lucide-react';
import { Board } from '@/types/board';
import { cn } from '@/lib/utils';

interface AppSidebarProps {
  boards: Board[];
  activeBoardId: string;
  onSelectBoard: (id: string) => void;
}

export default function AppSidebar({ boards, activeBoardId, onSelectBoard }: AppSidebarProps) {
  const [workspaceOpen, setWorkspaceOpen] = useState(true);

  return (
    <aside className="w-[260px] h-screen bg-sidebar flex flex-col border-r border-sidebar-border shrink-0">
      {/* Logo area */}
      <div className="p-4 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-sm">W</span>
        </div>
        <span className="text-sidebar-accent-foreground font-semibold text-lg">WorkFlow</span>
      </div>

      {/* Search */}
      <div className="px-3 mb-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-sidebar-muted text-sidebar-foreground">
          <Search className="w-4 h-4 opacity-50" />
          <span className="text-sm opacity-50">Buscar</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="px-3 space-y-0.5 mb-4">
        <SidebarItem icon={Home} label="Início" />
        <SidebarItem icon={Users} label="Minha equipe" />
        <SidebarItem icon={Settings} label="Configurações" />
      </nav>

      {/* Workspace */}
      <div className="px-3 flex-1 overflow-y-auto">
        <button
          onClick={() => setWorkspaceOpen(!workspaceOpen)}
          className="flex items-center justify-between w-full px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
        >
          <span>Workspace</span>
          <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", !workspaceOpen && "-rotate-90")} />
        </button>

        {workspaceOpen && (
          <div className="mt-1 space-y-0.5">
            {boards.map((board) => (
              <button
                key={board.id}
                onClick={() => onSelectBoard(board.id)}
                className={cn(
                  "flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm transition-colors",
                  activeBoardId === board.id
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span className="truncate">{board.title}</span>
              </button>
            ))}
            <button className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors">
              <Plus className="w-4 h-4" />
              <span>Novo quadro</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

function SidebarItem({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <button className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors">
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}
