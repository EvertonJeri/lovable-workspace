import { useState, useCallback, useEffect } from 'react';
import { ViewMode, Task, Board, TaskGroup, BoardColumn } from '@/types/board';
import { sampleBoard, sampleBoards } from '@/data/sampleData';
import AppSidebar from '@/components/AppSidebar';
import BoardHeader from '@/components/BoardHeader';
import TableView from '@/components/TableView';
import AutomationCenter from '@/components/AutomationCenter';
import { Automation } from '@/types/automation';
import TaskDialog from '@/components/TaskDialog';
import GanttView from '@/components/GanttView';
import { supabase, fetchBoards } from '@/lib/supabase';
import { toast } from 'sonner';
import ImportDialog from '@/components/ImportDialog';

export default function Index() {
  const [boards, setBoards] = useState<Board[]>(sampleBoards);
  const [activeBoardId, setActiveBoardId] = useState(sampleBoard.id);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isAutomationOpen, setIsAutomationOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const activeBoard = boards.find((b) => b.id === activeBoardId) || boards[0] || sampleBoard;

  useEffect(() => {
    let mounted = true;
    
    async function loadData() {
      // Timeout de 4 segundos para evitar travamento se o Supabase estiver offline
      const timeout = new Promise((_, reject) => setTimeout(() => reject('timeout'), 4000));
      
      try {
        const fetchPromise = fetchBoards();
        const data = await Promise.race([fetchPromise, timeout]) as Board[];
        
        if (mounted && data && data.length > 0) {
          setBoards(data);
          setActiveBoardId(data[0].id);
        }
      } catch (err) {
        console.warn('Usando dados locais (Supabase offline ou timeout)');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    
    loadData();
    return () => { mounted = false; };
  }, []);

  const handleTaskUpdate = useCallback(async (updated: Task) => {
    setBoards((prev) =>
      prev.map((board) =>
        board.id === activeBoardId
          ? {
              ...board,
              groups: board.groups.map((group) => ({
                ...group,
                tasks: group.tasks.map((t) => (t.id === updated.id ? updated : t)),
              })),
            }
          : board
      )
    );
    setSelectedTask(updated);

    try {
      const promises = Object.entries(updated.columnValues).map(([colId, val]) => 
        supabase.from('task_values').upsert({ task_id: updated.id, column_id: colId, value: val })
      );
      await Promise.all(promises);
    } catch (err) {
      console.error('Failed to sync task update:', err);
    }
  }, [activeBoardId]);

  const handleRenameBoard = useCallback(async (boardId: string, newTitle: string) => {
    setBoards(prev => prev.map(b => b.id === boardId ? { ...b, title: newTitle } : b));
    await supabase.from('boards').update({ title: newTitle }).eq('id', boardId);
  }, []);

  const handleDeleteBoard = useCallback(async (boardId: string) => {
    if (boards.length <= 1) return;
    if (!confirm('Excluir quadro?')) return;
    setBoards(prev => {
      const filtered = prev.filter(b => b.id !== boardId);
      if (activeBoardId === boardId) setActiveBoardId(filtered[0].id);
      return filtered;
    });
    await supabase.from('boards').delete().eq('id', boardId);
  }, [boards.length, activeBoardId]);

  const handleRenameGroup = useCallback(async (groupId: string, newTitle: string) => {
    setBoards(prev => prev.map(board => 
      board.id === activeBoardId 
        ? { ...board, groups: board.groups.map(g => g.id === groupId ? { ...g, title: newTitle } : g) } 
        : board
    ));
    await supabase.from('task_groups').update({ title: newTitle }).eq('id', groupId);
  }, [activeBoardId]);

  const handleDeleteGroup = useCallback(async (groupId: string) => {
    if (activeBoard.groups.length <= 1) return;
    if (!confirm('Excluir grupo?')) return;
    setBoards(prev => prev.map(board => 
      board.id === activeBoardId 
        ? { ...board, groups: board.groups.filter(g => g.id !== groupId) } 
        : board
    ));
    await supabase.from('task_groups').delete().eq('id', groupId);
  }, [activeBoardId, activeBoard.groups.length]);

  const handleAddTask = useCallback(async (groupId?: string) => {
    const targetGroupId = groupId || activeBoard.groups[0]?.id;
    if (!targetGroupId) return;
    
    const initialColumnValues: Record<string, any> = {};
    activeBoard.columns.forEach(col => {
       if (col.type === 'status') initialColumnValues[col.id] = 'default';
       else if (col.type === 'priority') initialColumnValues[col.id] = 'medium';
    });

    const newTask: Task = {
      id: crypto.randomUUID(),
      name: 'Nova Tarefa',
      columnValues: initialColumnValues,
      orderIndex: activeBoard.groups.find(g => g.id === targetGroupId)?.tasks.length || 0,
      groupId: targetGroupId
    };

    setBoards(prev => prev.map(board => 
      board.id === activeBoardId 
        ? { ...board, groups: board.groups.map(g => g.id === targetGroupId ? { ...g, tasks: [...g.tasks, newTask] } : g) } 
        : board
    ));

    await supabase.from('tasks').insert({ id: newTask.id, group_id: targetGroupId, name: newTask.name, position: newTask.orderIndex });
  }, [activeBoard, activeBoardId]);

  const handleAddGroup = useCallback(async () => {
    const newGroup: TaskGroup = {
      id: crypto.randomUUID(),
      title: 'Novo Grupo',
      color: 'blue',
      tasks: []
    };
    setBoards(prev => prev.map(board => board.id === activeBoardId ? { ...board, groups: [newGroup, ...board.groups] } : board));
    await supabase.from('task_groups').insert({ id: newGroup.id, board_id: activeBoardId, title: newGroup.title, color: 'blue' });
  }, [activeBoardId]);

  const handleAddColumn = useCallback(async (type: any, title: string) => {
    const newCol: BoardColumn = { id: crypto.randomUUID(), type, title, width: 160, position: activeBoard.columns.length };
    setBoards(prev => prev.map(board => board.id === activeBoardId ? { ...board, columns: [...board.columns, newCol] } : board));
    await supabase.from('board_columns').insert({ id: newCol.id, board_id: activeBoardId, type, title, width: 160, position: newCol.position });
  }, [activeBoardId, activeBoard.columns.length]);

  const handleUpdateColumn = useCallback(async (columnId: string, updates: Partial<BoardColumn>) => {
    setBoards(prev => prev.map(board => 
      board.id === activeBoardId 
        ? { ...board, columns: board.columns.map(col => col.id === columnId ? { ...col, ...updates } : col) } 
        : board
    ));
    await supabase.from('board_columns').update(updates).eq('id', columnId);
  }, [activeBoardId]);

  const handleRemoveColumn = useCallback(async (columnId: string) => {
    setBoards(prev => prev.map(board => board.id === activeBoardId ? { ...board, columns: board.columns.filter(col => col.id !== columnId) } : board));
    await supabase.from('board_columns').delete().eq('id', columnId);
  }, [activeBoardId]);

  const handleImport = useCallback((groups: TaskGroup[], newColumns?: BoardColumn[]) => {
    // 1. Close dialog immediately to prevent freeze
    setIsImportOpen(false);

    // 2. Update local state
    const columnsToUse = newColumns && activeBoard.columns.length === 0 ? newColumns : undefined;
    
    setBoards(prev => prev.map(board => {
      if (board.id !== activeBoardId) return board;
      return {
        ...board,
        columns: columnsToUse ? columnsToUse : board.columns,
        groups: [...board.groups, ...groups]
      };
    }));

    // 3. Save to database in background (non-blocking)
    (async () => {
      try {
        // Save new columns if any
        if (columnsToUse) {
          for (const col of columnsToUse) {
            await supabase.from('board_columns').insert({
              id: col.id, board_id: activeBoardId, title: col.title,
              type: col.type, width: col.width, position: col.position,
              unit: col.unit || null, summary_type: col.summaryType || 'none'
            });
          }
        }

        // Save groups, tasks, and task_values
        for (const group of groups) {
          await supabase.from('task_groups').insert({
            id: group.id, board_id: activeBoardId,
            title: group.title, color: group.color, position: 0
          });

          for (const task of group.tasks) {
            await supabase.from('tasks').insert({
              id: task.id, group_id: group.id,
              name: task.name, position: task.orderIndex
            });

            // Save each column value
            const entries = Object.entries(task.columnValues);
            if (entries.length > 0) {
              const values = entries.map(([colId, val]) => ({
                task_id: task.id, column_id: colId,
                value: typeof val === 'object' ? val : val
              }));
              await supabase.from('task_values').upsert(values);
            }
          }
        }
        console.log('Import synced to database successfully');
      } catch (err) {
        console.error('Import database sync failed:', err);
      }
    })();
  }, [activeBoardId, activeBoard.columns.length]);

  const handleAddBoard = useCallback(async () => {
    const title = 'Novo Quadro';
    const { data: newBoardData } = await supabase.from('boards').insert({ title }).select().single();
    if (newBoardData) {
      const newBoard: Board = { id: newBoardData.id, title: newBoardData.title, workspaceId: 'w1', columns: [], groups: [] };
      setBoards(prev => [newBoard, ...prev]);
      setActiveBoardId(newBoard.id);
    }
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F5F6F8]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">Iniciando ambiente...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar
        boards={boards}
        activeBoardId={activeBoardId}
        onSelectBoard={setActiveBoardId}
        onAddBoard={handleAddBoard}
        onRenameBoard={handleRenameBoard}
        onDeleteBoard={handleDeleteBoard}
      />

      <main className="flex-1 overflow-y-auto">
        <BoardHeader
          title={activeBoard?.title || 'Sem título'}
          viewMode={viewMode}
          onViewChange={setViewMode}
          onAddTask={handleAddTask}
          onAddGroup={handleAddGroup}
          onAutomationsClick={() => setIsAutomationOpen(true)}
          automationsCount={automations.length}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onImportClick={() => setIsImportOpen(true)}
        />

        {viewMode === 'table' && activeBoard && (
          <TableView 
            board={activeBoard} 
            onTaskClick={setSelectedTask}
            onAddTask={handleAddTask}
            onAddGroup={handleAddGroup}
            onRenameGroup={handleRenameGroup}
            onDeleteGroup={handleDeleteGroup}
            onAddColumn={handleAddColumn}
            onUpdateColumn={handleUpdateColumn}
            onRemoveColumn={handleRemoveColumn}
            searchTerm={searchTerm}
          />
        )}

        {viewMode === 'gantt' && activeBoard && <GanttView board={activeBoard} />}
      </main>

      <AutomationCenter
        open={isAutomationOpen}
        onClose={() => setIsAutomationOpen(false)}
        automations={automations}
        onToggle={(id) => setAutomations(prev => prev.map(a => a.id === id ? { ...a, isActive: !a.isActive } : a))}
        onDelete={(id) => setAutomations(prev => prev.filter(a => a.id !== id))}
      />

      <ImportDialog open={isImportOpen} onClose={() => setIsImportOpen(false)} onImport={handleImport} existingColumns={activeBoard?.columns || []} />

      {selectedTask && (
        <TaskDialog
          task={selectedTask}
          columns={activeBoard?.columns || []}
          open={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleTaskUpdate}
        />
      )}
    </div>
  );
}
