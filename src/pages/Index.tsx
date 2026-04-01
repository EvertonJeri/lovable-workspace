import { useState, useCallback } from 'react';
import { ViewMode, Task, Board } from '@/types/board';
import { sampleBoard, sampleBoards } from '@/data/sampleData';
import AppSidebar from '@/components/AppSidebar';
import BoardHeader from '@/components/BoardHeader';
import TableView from '@/components/TableView';
import KanbanView from '@/components/KanbanView';
import GanttView from '@/components/GanttView';
import TaskDialog from '@/components/TaskDialog';

export default function Index() {
  const [boards, setBoards] = useState<Board[]>(sampleBoards.map((b) => b.id === sampleBoard.id ? sampleBoard : b));
  const [activeBoardId, setActiveBoardId] = useState(sampleBoard.id);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const activeBoard = boards.find((b) => b.id === activeBoardId) || sampleBoard;

  const handleTaskUpdate = useCallback((updated: Task) => {
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
  }, [activeBoardId]);

  const handleAddTask = useCallback(() => {
    const firstGroup = activeBoard.groups[0];
    if (!firstGroup) return;
    const newTask: Task = {
      id: `t-${Date.now()}`,
      title: 'Nova tarefa',
      status: 'default',
      priority: 'medium',
      groupId: firstGroup.id,
    };
    setBoards((prev) =>
      prev.map((board) =>
        board.id === activeBoardId
          ? {
              ...board,
              groups: board.groups.map((group) =>
                group.id === firstGroup.id ? { ...group, tasks: [...group.tasks, newTask] } : group
              ),
            }
          : board
      )
    );
    setSelectedTask(newTask);
  }, [activeBoardId, activeBoard]);

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar
        boards={boards}
        activeBoardId={activeBoardId}
        onSelectBoard={setActiveBoardId}
      />

      <main className="flex-1 overflow-y-auto">
        <BoardHeader
          title={activeBoard.title}
          viewMode={viewMode}
          onViewChange={setViewMode}
          onAddTask={handleAddTask}
        />

        {viewMode === 'table' && (
          <TableView groups={activeBoard.groups} onTaskClick={setSelectedTask} />
        )}
        {viewMode === 'kanban' && (
          <KanbanView groups={activeBoard.groups} onTaskClick={setSelectedTask} />
        )}
        {viewMode === 'gantt' && (
          <GanttView groups={activeBoard.groups} />
        )}
      </main>

      <TaskDialog
        task={selectedTask}
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onUpdate={handleTaskUpdate}
      />
    </div>
  );
}
