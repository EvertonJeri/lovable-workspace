import { useState, useCallback, useEffect, useMemo } from 'react';
import { ViewMode, Task, Board, TaskGroup, BoardColumn, ColumnType, STATUS_LABELS, PRIORITY_LABELS } from '@/types/board';
import { sampleBoard, sampleBoards } from '@/data/sampleData';
import AppSidebar from '@/components/AppSidebar';
import BoardHeader from '@/components/BoardHeader';
import TableView from '@/components/TableView';
import AutomationCenter from '@/components/AutomationCenter';
import { Automation } from '@/types/automation';
import TaskDialog from '@/components/TaskDialog';
import GanttView from '@/components/GanttView';
import ExecDashboard from '@/components/ExecDashboard';
import { supabase, fetchBoards, createBoard, createTask, updateTaskValue, createGroup, fetchTeamMembers } from '@/lib/supabase';
import { toast } from 'sonner';
import ImportDialog from '@/components/ImportDialog';
import TeamView from '@/components/TeamView';
import ArchivedItemsDialog from '@/components/ArchivedItemsDialog';
import GroupGenerator from '@/components/GroupGenerator';

export default function Index() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode | 'team' | 'generator'>('table');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isAutomationOpen, setIsAutomationOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isArchivedOpen, setIsArchivedOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [boardFilters, setBoardFilters] = useState<Record<string, { searchTerm: string, activeFilters: Record<string, string[]> }>>({});
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  const isSample = useCallback((id: string) => 
    boards.some(b => b.id === id && (
      id === 'ppcp-cronograma' || 
      id === 'desempenho-oficial' || 
      id.startsWith('g-') || 
      id.startsWith('p-') || 
      id.startsWith('t-') || 
      id.startsWith('e-')
    )), [boards]);

  const activeBoard = useMemo(() => {
    return boards.find((b) => b.id === activeBoardId) || boards[0] || sampleBoard;
  }, [boards, activeBoardId]);

  const currentFilter = useMemo(() => {
    // Garantimos que sempre pegamos o filtro correto, inclusive se o activeBoardId estiver em transição
    const key = activeBoardId || 'default';
    return boardFilters[key] || { searchTerm: '', activeFilters: {} };
  }, [activeBoardId, boardFilters]);

  const { searchTerm, activeFilters } = currentFilter;

  const persistBoard = async (boardToPersist: Board) => {
    try {
      toast.loading("Salvando modelo como projeto real no banco...", { id: 'persist' });
      const { data: newBoard, error: bErr } = await supabase.from('boards').insert({ title: boardToPersist.title }).select().single();
      if (bErr || !newBoard) throw bErr;

      const columnIdMap: Record<string, string> = {};

      for (const col of boardToPersist.columns) {
        const { data: nC } = await supabase.from('board_columns').insert({
          board_id: newBoard.id,
          title: col.title,
          type: col.type,
          width: col.width,
          position: col.position,
          unit: col.unit,
          summary_type: col.summaryType,
          formula_expr: col.formulaExpr
        }).select().single();
        if (nC) columnIdMap[col.id] = nC.id;
      }

      for (const group of boardToPersist.groups) {
        const { data: nG } = await supabase.from('task_groups').insert({
          board_id: newBoard.id,
          title: group.title,
          color: group.color,
          position: 0
        }).select().single();
        
        if (nG) {
          for (const task of group.tasks) {
            const { data: nT } = await supabase.from('tasks').insert({
              group_id: nG.id,
              name: task.name,
              position: task.orderIndex
            }).select().single();
            
            if (nT && task.columnValues) {
              const values = Object.entries(task.columnValues)
                .filter(([oldColId]) => columnIdMap[oldColId])
                .map(([oldColId, val]) => ({
                  task_id: nT.id,
                  column_id: columnIdMap[oldColId],
                  value: val
                }));
              if (values.length > 0) await supabase.from('task_values').upsert(values);
            }
          }
        }
      }

      toast.dismiss('persist');
      toast.success("Modelo convertido com sucesso!");
      return { id: newBoard.id, columnIdMap };
    } catch (err: any) {
      toast.error(`Falha ao converter modelo: ${err.message}`);
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;
    
    async function loadData() {
      setLoading(true);
      try {
        const [boardsData, membersData] = await Promise.all([
          fetchBoards(),
          fetchTeamMembers()
        ]);
        
        if (mounted) {
          setTeamMembers(membersData);
          if (boardsData && boardsData.length > 0) {
            setBoards(boardsData);
            if (!activeBoardId || !boardsData.some(b => b.id === activeBoardId)) {
              setActiveBoardId(boardsData[0].id);
            }
          } else {
            setBoards(sampleBoards);
            if (!activeBoardId) setActiveBoardId(sampleBoards[1].id);
          }
        }
      } catch (err: any) {
        console.error('fetchData failed:', err);
        if (mounted) {
          setBoards(sampleBoards);
          if (!activeBoardId) setActiveBoardId(sampleBoards[0].id);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    
    loadData();
    return () => { mounted = false; };
  }, []);

  // Recarregar equipe sempre que voltar para a tabela ou dashboard
  useEffect(() => {
    if (viewMode === 'table' || viewMode === 'dashboard') {
      fetchTeamMembers().then(members => setTeamMembers(members)).catch(console.error);
    }
  }, [viewMode]);

  const handleTaskUpdate = useCallback(async (updated: Task) => {
    let targetBoardId = activeBoardId;
    let currentActiveBoard = activeBoard;

    if (isSample(activeBoardId)) {
      const result = await persistBoard(activeBoard);
      if (!result) return;
      targetBoardId = result.id;
      currentActiveBoard = { ...activeBoard, id: targetBoardId };
      setActiveBoardId(targetBoardId);
      // Continue and apply the update to the new real board
    }

    let finalTaskToSave = updated;
    const targetGroup = currentActiveBoard?.groups.find(g => g.id === updated.groupId);

    // DYNAMIC CALCULATION: Relation between Budget, Percentage and Group Total
    if (targetGroup && targetGroup.budget && targetGroup.budget > 0) {
      const orcadoCol = currentActiveBoard.columns.find(c => 
        c.unit === 'R$' || 
        c.title.toLowerCase().includes('orç') || 
        c.title.toLowerCase().includes('budg') ||
        c.id === 'budget' || c.id === 'c4'
      );
      const percentCol = currentActiveBoard.columns.find(c => 
        c.unit === '%' || 
        c.type === 'progress' || 
        c.title.toLowerCase().includes('%') || 
        c.title.toLowerCase().includes('perc') ||
        c.id === 'percentage' || c.id === 'progress' || c.id === 'c3'
      );
      
      if (orcadoCol && percentCol) {
         const parseLocal = (val: any) => {
           if (typeof val === 'number') return val;
           if (!val) return 0;
           return parseFloat(String(val).replace('R$', '').replace('%', '').replace(/\s/g, '').replace(',', '.')) || 0;
         };

         const oldTask = targetGroup.tasks.find(t => t.id === updated.id);
         const oldPerc = oldTask ? parseLocal(oldTask.columnValues[percentCol.id]) : -1;
         const newPerc = parseLocal(updated.columnValues[percentCol.id]);
         
         const oldOrcado = oldTask ? parseLocal(oldTask.columnValues[orcadoCol.id]) : -1;
         const newOrcado = parseLocal(updated.columnValues[orcadoCol.id]);

         // Robust comparison to handle floating point and 0
         const percChanged = Math.abs(newPerc - oldPerc) > 0.0001;
         const orcadoChanged = Math.abs(newOrcado - oldOrcado) > 0.0001;

         // A. If percentage changed (or budget is 0), update budget
         if (percChanged || (newOrcado === 0 && oldOrcado !== 0)) {
            const calculatedBudget = (newPerc / 100) * targetGroup.budget;
            finalTaskToSave = {
              ...updated,
              columnValues: {
                ...updated.columnValues,
                [orcadoCol.id]: Math.round(calculatedBudget * 100) / 100
              }
            };
         } 
         // B. If budget changed manually, update percentage
         else if (orcadoChanged) {
            const calculatedPerc = (newOrcado / targetGroup.budget) * 100;
            finalTaskToSave = {
              ...updated,
              columnValues: {
                ...updated.columnValues,
                [percentCol.id]: Math.min(100, Math.round(calculatedPerc * 100) / 100)
              }
            };
         }
      }
    }

    setBoards((prev) =>
      prev.map((board) =>
        board.id === activeBoardId
          ? {
              ...board,
              groups: board.groups.map((group) => ({
                ...group,
                tasks: group.tasks.map((t) => (t.id === finalTaskToSave.id ? finalTaskToSave : t)),
              })),
            }
          : board
      )
    );
    
    setSelectedTask(prev => prev && prev.id === finalTaskToSave.id ? finalTaskToSave : prev);

    try {
      const promises = Object.entries(finalTaskToSave.columnValues).map(async ([colId, val]) => {
        await supabase.from('task_values').upsert({ task_id: finalTaskToSave.id, column_id: colId, value: val });
      });
      promises.push((async () => {
        await supabase.from('tasks').update({ name: finalTaskToSave.name }).eq('id', finalTaskToSave.id);
      })());
      await Promise.all(promises);
    } catch (err: any) {
      console.error('Task sync error:', err);
    }
  }, [activeBoardId, activeBoard]);

  const handleRenameBoard = useCallback(async (boardId: string, newTitle: string) => {
    const targetBoard = boards.find(b => b.id === boardId);
    if (!targetBoard) return;

    if (isSample(boardId)) {
      // Se for amostra, criamos uma versão real com o novo título
      const result = await persistBoard({ ...targetBoard, title: newTitle });
      if (result) {
        setActiveBoardId(result.id);
        const data = await fetchBoards();
        setBoards([...data, ...sampleBoards]);
      }
      return;
    }

    setBoards(prev => prev.map(b => b.id === boardId ? { ...b, title: newTitle } : b));
    await supabase.from('boards').update({ title: newTitle }).eq('id', boardId);
    toast.success("Nome do projeto atualizado!");
  }, [boards, sampleBoards]);

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
    // Atualização local imediata preservando a ordem original
    setBoards(prev => {
      const newBoards = [...prev];
      const boardIndex = newBoards.findIndex(b => b.id === activeBoardId);
      if (boardIndex === -1) return prev;
      
      const newGroups = [...newBoards[boardIndex].groups];
      const groupIndex = newGroups.findIndex(g => g.id === groupId);
      if (groupIndex === -1) return prev;
      
      newGroups[groupIndex] = { ...newGroups[groupIndex], title: newTitle };
      newBoards[boardIndex] = { ...newBoards[boardIndex], groups: newGroups };
      
      return newBoards;
    });
    
    // Atualização no banco em segundo plano
    try {
      await supabase.from('task_groups').update({ title: newTitle }).eq('id', groupId);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar no servidor');
    }
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

  const handleUpdateGroupBudget = useCallback(async (groupId: string, newBudget: number) => {
    let targetBoardId = activeBoardId;
    if (isSample(targetBoardId)) {
      const result = await persistBoard(activeBoard);
      if (!result) return;
      targetBoardId = result.id;
      setActiveBoardId(targetBoardId);
    }

    const board = boards.find(b => b.id === targetBoardId) || activeBoard;
    const orcadoCol = board.columns.find(c => c.unit === 'R$' || c.title.toLowerCase().includes('orç') || c.title.toLowerCase().includes('budg'));
    const percentCol = board.columns.find(c => c.unit === '%' || c.type === 'progress' || c.title.toLowerCase().includes('%') || c.title.toLowerCase().includes('perc'));

    setBoards(prev => prev.map(b => {
      if (b.id !== targetBoardId) return b;
      return {
        ...b,
        groups: b.groups.map(g => {
          if (g.id !== groupId) return g;
          const updatedTasks = g.tasks.map(t => {
            if (!orcadoCol || !percentCol) return t;
            const perc = parseFloat(String(t.columnValues[percentCol.id])) || 0;
            return {
              ...t,
              columnValues: {
                ...t.columnValues,
                [orcadoCol.id]: (perc / 100) * newBudget
              }
            };
          });
          return { ...g, budget: newBudget, tasks: updatedTasks };
        })
      };
    }));

    await supabase.from('task_groups').update({ budget: newBudget }).eq('id', groupId);

    if (orcadoCol && percentCol) {
       const group = board.groups.find(g => g.id === groupId);
       if (group) {
         const updates = group.tasks.map(t => {
            const perc = parseFloat(String(t.columnValues[percentCol.id])) || 0;
            return { task_id: t.id, column_id: orcadoCol.id, value: (perc / 100) * newBudget };
         });
         if (updates.length > 0) await supabase.from('task_values').upsert(updates);
       }
    }
    toast.success('Orçamento do grupo aplicado e tarefas recalculadas!');
  }, [activeBoardId, activeBoard, boards]);

  const handleDuplicateGroup = useCallback(async (groupId: string) => {
    let targetBoardId = activeBoardId;
    if (isSample(targetBoardId)) {
      const result = await persistBoard(activeBoard);
      if (!result) return;
      targetBoardId = result.id;
      setActiveBoardId(targetBoardId);
    }

    const groupToDup = activeBoard.groups.find(g => g.id === groupId);
    if (!groupToDup) return;

    const newGroup: TaskGroup = {
      ...groupToDup,
      id: crypto.randomUUID(),
      title: `${groupToDup.title} (Cópia)`,
      tasks: groupToDup.tasks.map(t => ({
        ...t,
        id: crypto.randomUUID()
      }))
    };

    setBoards(prev => prev.map(board => 
      board.id === targetBoardId || board.id === activeBoardId 
        ? { 
            ...board, 
            groups: board.groups.flatMap(g => g.id === groupId ? [g, newGroup] : [g]) 
          } 
        : board
    ));

    const { data: nG } = await supabase.from('task_groups').insert({ 
      id: newGroup.id, board_id: targetBoardId, title: newGroup.title, color: newGroup.color 
    }).select().single();

    if (nG) {
      const tasksToInsert = newGroup.tasks.map(t => ({ id: t.id, group_id: nG.id, name: t.name, position: t.orderIndex }));
      if (tasksToInsert.length > 0) {
        await supabase.from('tasks').insert(tasksToInsert);
        const valuesToInsert = newGroup.tasks.flatMap(t => 
          Object.entries(t.columnValues)
            .filter(([_, val]) => val !== undefined && val !== null)
            .map(([colId, val]) => ({ task_id: t.id, column_id: colId, value: val }))
        );
        if (valuesToInsert.length > 0) {
          await supabase.from('task_values').insert(valuesToInsert);
        }
      }
    }
  }, [activeBoardId, activeBoard]);

  const handleAddTask = useCallback(async (groupId?: string) => {
    let targetBoardId = activeBoardId;
    if (isSample(targetBoardId)) {
      const result = await persistBoard(activeBoard);
      if (!result) return;
      targetBoardId = result.id;
      setActiveBoardId(targetBoardId);
    }

    const targetGroupId = groupId || activeBoard.groups[0]?.id;
    if (!targetGroupId) return;
    
    const newTask: Task = {
      id: crypto.randomUUID(),
      name: 'Nova Tarefa',
      columnValues: {},
      orderIndex: activeBoard.groups.find(g => g.id === targetGroupId)?.tasks.length || 0,
      groupId: targetGroupId
    };

    setBoards(prev => prev.map(board => 
      board.id === targetBoardId || board.id === activeBoardId
        ? { ...board, groups: board.groups.map(g => g.id === targetGroupId ? { ...g, tasks: [...g.tasks, newTask] } : g) } 
        : board
    ));

    await supabase.from('tasks').insert({ id: newTask.id, group_id: targetGroupId, name: newTask.name, position: newTask.orderIndex });
  }, [activeBoard, activeBoardId]);

  const handleAddGroup = useCallback(async () => {
    let targetBoardId = activeBoardId;
    if (isSample(targetBoardId)) {
      const result = await persistBoard(activeBoard);
      if (!result) return;
      targetBoardId = result.id;
      setActiveBoardId(targetBoardId);
    }

    const newGroup: TaskGroup = {
      id: crypto.randomUUID(),
      title: 'Novo Grupo',
      color: 'blue',
      tasks: []
    };
    setBoards(prev => prev.map(board => board.id === targetBoardId || board.id === activeBoardId ? { ...board, groups: [newGroup, ...board.groups] } : board));
    await supabase.from('task_groups').insert({ id: newGroup.id, board_id: targetBoardId, title: newGroup.title, color: 'blue' });
  }, [activeBoardId, activeBoard]);

  const handleAddColumn = useCallback(async (type: any, title: string, forBoardId?: string) => {
    let targetBoardId = forBoardId || activeBoardId;
    if (isSample(targetBoardId)) {
      const result = await persistBoard(activeBoard);
      if (!result) return;
      targetBoardId = result.id;
      if (!forBoardId) setActiveBoardId(targetBoardId);
    }

    const targetBoard = boards.find(b => b.id === targetBoardId) || activeBoard;
    const newCol: BoardColumn = { id: crypto.randomUUID(), type, title, width: 160, position: targetBoard.columns.length };
    setBoards(prev => prev.map(board => board.id === targetBoardId || board.id === activeBoardId ? { ...board, columns: [...board.columns, newCol] } : board));
    await supabase.from('board_columns').insert({ id: newCol.id, board_id: targetBoardId, type, title, width: 160, position: newCol.position });
    return newCol.id;
  }, [activeBoardId, activeBoard, persistBoard, isSample, boards]);

  const handleUpdateColumn = useCallback(async (columnId: string, updates: Partial<BoardColumn>) => {
    const supabaseUpdates: any = { ...updates };
    if (updates.summaryType) {
      supabaseUpdates.summary_type = updates.summaryType;
      delete supabaseUpdates.summaryType;
    }
    if (updates.formulaExpr) {
      supabaseUpdates.formula_expr = updates.formulaExpr;
      delete supabaseUpdates.formulaExpr;
    }

    setBoards(prev => prev.map(board => 
      board.id === activeBoardId 
        ? { ...board, columns: board.columns.map(col => col.id === columnId ? { ...col, ...updates } : col) } 
        : board
    ));
    await supabase.from('board_columns').update(supabaseUpdates).eq('id', columnId);
  }, [activeBoardId]);

  const handleMoveColumn = useCallback(async (columnId: string, direction: 'left' | 'right') => {
    setBoards(prev => {
      const newBoards = [...prev];
      const boardIndex = newBoards.findIndex(b => b.id === activeBoardId);
      if (boardIndex === -1) return prev;
      
      const board = newBoards[boardIndex];
      const columns = [...board.columns];
      const colIndex = columns.findIndex(c => c.id === columnId);
      
      if (colIndex === -1) return prev;
      if (direction === 'left' && colIndex === 0) return prev;
      if (direction === 'right' && colIndex === columns.length - 1) return prev;
      
      const targetIndex = direction === 'left' ? colIndex - 1 : colIndex + 1;
      
      // Swap elements
      const temp = columns[colIndex];
      columns[colIndex] = columns[targetIndex];
      columns[targetIndex] = temp;
      
      // Update positions
      columns[colIndex] = { ...columns[colIndex], position: colIndex };
      columns[targetIndex] = { ...columns[targetIndex], position: targetIndex };
      
      newBoards[boardIndex] = { ...board, columns }; // Clone board object to trigger React update
      
      // Persist reordered positions
      supabase.from('board_columns').update({ position: colIndex }).eq('id', columns[colIndex].id).then();
      supabase.from('board_columns').update({ position: targetIndex }).eq('id', columns[targetIndex].id).then();
      
      return newBoards;
    });
  }, [activeBoardId]);

  const handleRemoveColumn = useCallback(async (columnId: string) => {
    setBoards(prev => prev.map(board => board.id === activeBoardId ? { ...board, columns: board.columns.filter(col => col.id !== columnId) } : board));
    await supabase.from('board_columns').delete().eq('id', columnId);
  }, [activeBoardId]);

  const handleImport = useCallback(async (groups: TaskGroup[], newColumns?: BoardColumn[]) => {
    setIsImportOpen(false);
    let targetBoardId = activeBoardId;
    let colMapping: Record<string, string> = {};

    if (isSample(targetBoardId)) {
      const result = await persistBoard(activeBoard);
      if (!result) return;
      targetBoardId = result.id;
      colMapping = result.columnIdMap;
      setActiveBoardId(targetBoardId);
    }

    const filteredGroups = groups.filter(newG => {
      const existingG = activeBoard.groups.find(g => g.title.toLowerCase() === newG.title.toLowerCase());
      if (!existingG) return true;
      
      const allTasksMatch = newG.tasks.every(nT => 
        existingG.tasks.some(eT => eT.name === nT.name)
      );
      
      return !allTasksMatch;
    });

    if (filteredGroups.length === 0) {
      toast.info("Nenhuma informação nova detectada. Duplicatas ignoradas.");
      return;
    }

    const allNewCols = newColumns || [];
    
    setBoards(prev => prev.map(board => {
      if (board.id !== targetBoardId && board.id !== activeBoardId) return board;
      return {
        ...board,
        columns: [...board.columns, ...allNewCols],
        groups: [...board.groups, ...filteredGroups]
      };
    }));

    (async () => {
      try {
        for (const col of allNewCols) {
          const { data } = await supabase.from('board_columns').insert({
            id: col.id, board_id: targetBoardId, title: col.title,
            type: col.type, width: col.width, position: col.position,
            unit: col.unit || null, summary_type: col.summaryType || 'none'
          }).select().single();
          if (data) colMapping[col.id] = data.id;
        }

        for (const group of filteredGroups) {
          const { data: nG } = await supabase.from('task_groups').insert({
            id: group.id, board_id: targetBoardId,
            title: group.title, color: group.color, position: 0
          }).select().single();

          if (!nG) continue;

          for (const task of group.tasks) {
            const { data: nT } = await supabase.from('tasks').insert({
              id: task.id, group_id: nG.id,
              name: task.name, position: task.orderIndex
            }).select().single();

            if (!nT) continue;

            const values = Object.entries(task.columnValues)
              .filter(([_, val]) => val !== null && val !== undefined)
              .map(([oldColId, val]) => ({
                task_id: nT.id,
                column_id: colMapping[oldColId] || oldColId,
                value: val
              }));

            if (values.length > 0) {
              await supabase.from('task_values').upsert(values);
            }
          }
        }
        await fetchBoards().then(data => setBoards([...data, ...sampleBoards]));
      } catch (err) {
        console.error('Import sync error:', err);
      }
    })();
  }, [activeBoardId, activeBoard]);

  const handleDuplicateBoard = useCallback(async (boardId: string) => {
    const boardToDup = boards.find(b => b.id === boardId);
    if (!boardToDup) return;
    const result = await persistBoard({ ...boardToDup, title: boardToDup.title + ' (Cópia)' });
    if (result) {
      toast.success("Projeto duplicado com sucesso!");
      const data = await fetchBoards();
      setBoards([...data, ...sampleBoards]);
    }
  }, [boards]);

  const handleDeleteTask = useCallback(async (taskId: string) => {
    if (!confirm('Excluir tarefa?')) return;
    setBoards(prev => prev.map(board => 
      board.id === activeBoardId 
        ? { ...board, groups: board.groups.map(g => ({ ...g, tasks: g.tasks.filter(t => t.id !== taskId) })) } 
        : board
    ));
    await supabase.from('tasks').delete().eq('id', taskId);
  }, [activeBoardId]);

  const handleDuplicateTask = useCallback(async (taskId: string) => {
    let duplicatedTask: Task | null = null;
    let targetGroupId = '';
    let originalTask: Task | null = null;
    
    boards.forEach(board => {
      board.groups.forEach(group => {
        const taskIndex = group.tasks.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
          originalTask = group.tasks[taskIndex];
          targetGroupId = group.id;
          duplicatedTask = {
            ...originalTask,
            id: crypto.randomUUID(),
            name: `${originalTask.name} (Cópia)`,
            orderIndex: originalTask.orderIndex + 1
          };
        }
      });
    });

    if (!duplicatedTask || !originalTask) return;

    setBoards(prev => prev.map(board => 
      board.id === activeBoardId 
        ? { 
            ...board, 
            groups: board.groups.map(g => {
              if (g.id !== targetGroupId) return g;
              const taskIndex = g.tasks.findIndex(t => t.id === taskId);
              const newTasks = [...g.tasks];
              newTasks.splice(taskIndex + 1, 0, duplicatedTask!);
              return { ...g, tasks: newTasks.map((t, i) => ({ ...t, orderIndex: i })) };
            }) 
          } 
        : board
    ));

    const { error: taskError } = await supabase.from('tasks').insert({
      id: duplicatedTask.id, group_id: targetGroupId,
      name: duplicatedTask.name, position: duplicatedTask.orderIndex
    });
    
    if (!taskError) {
      const values = Object.entries(originalTask.columnValues).map(([colId, val]) => ({
        task_id: duplicatedTask!.id, column_id: colId, value: val
      }));
      if (values.length > 0) await supabase.from('task_values').insert(values);
    }
  }, [boards, activeBoardId]);

  const handleArchiveTask = useCallback(async (taskIds: string[]) => {
     if (taskIds.length === 0) return;
     setBoards(prev => prev.map(board => ({
       ...board,
       groups: board.groups.map(g => ({
         ...g,
         tasks: g.tasks.map(t => taskIds.includes(t.id) ? { ...t, archived: true } : t)
       }))
     })));
     await supabase.from('tasks').update({ is_archived: true }).in('id', taskIds);
     toast.info(`${taskIds.length} tarefas arquivadas`);
  }, []);

  const handleUnarchiveTask = useCallback(async (taskId: string) => {
    setBoards(prev => prev.map(board => ({
      ...board,
      groups: board.groups.map(g => ({
        ...g,
        tasks: g.tasks.map(t => t.id === taskId ? { ...t, archived: false } : t)
      }))
    })));
    await supabase.from('tasks').update({ is_archived: false }).eq('id', taskId);
    toast.success('Tarefa restaurada');
  }, []);

  const handleArchiveGroup = useCallback(async (groupId: string) => {
    setBoards(prev => prev.map(board => 
      board.id === activeBoardId 
        ? { ...board, groups: board.groups.map(g => g.id === groupId ? { ...g, archived: true } : g) } 
        : board
    ));
    await supabase.from('task_groups').update({ is_archived: true }).eq('id', groupId);
    toast.success('Grupo arquivado');
  }, [activeBoardId]);

  const handleUnarchiveGroup = useCallback(async (groupId: string) => {
    setBoards(prev => prev.map(board => 
      board.id === activeBoardId 
        ? { ...board, groups: board.groups.map(g => g.id === groupId ? { ...g, archived: false } : g) } 
        : board
    ));
    await supabase.from('task_groups').update({ is_archived: false }).eq('id', groupId);
    toast.success('Grupo restaurado');
  }, [activeBoardId]);

  const handleAddBoard = useCallback(async () => {
    const title = 'Novo Quadro';
    const { data: bData } = await supabase.from('boards').insert({ title }).select().single();
    
    if (bData) {
      const defaultCols = [
        { title: 'Status', type: 'status', width: 160, position: 0 },
        { title: 'Prioridade', type: 'priority', width: 140, position: 1 },
        { title: 'Responsável', type: 'person', width: 220, position: 2 },
        { title: 'Cronograma', type: 'timeline', width: 240, position: 3 },
        { title: 'Orçamento', type: 'number', width: 160, unit: 'R$', summary_type: 'sum', position: 4 }
      ];

      const createdCols: BoardColumn[] = [];
      for (const col of defaultCols) {
        const { data: cData } = await supabase.from('board_columns').insert({ board_id: bData.id, ...col }).select().single();
        if (cData) createdCols.push({ ...col, id: cData.id, type: cData.type as any, summaryType: cData.summary_type as any });
      }

      const { data: nG } = await supabase.from('task_groups').insert({ board_id: bData.id, title: 'Novo Grupo', color: 'blue' }).select().single();

      const newBoard: Board = { 
        id: bData.id, title: bData.title, workspaceId: 'default', 
        columns: createdCols, groups: nG ? [{ id: nG.id, title: nG.title, color: nG.color, tasks: [] }] : [] 
      };

      setBoards(prev => [newBoard, ...prev]);
      setActiveBoardId(newBoard.id);
      toast.success("Novo projeto criado.");
    }
  }, []);

  const onSearchChange = useCallback((value: string) => {
    const key = activeBoardId || 'default';
    setBoardFilters(prev => ({ ...prev, [key]: { ...(prev[key] || { searchTerm: '', activeFilters: {} }), searchTerm: value } }));
  }, [activeBoardId]);

  const onFilterChange = useCallback((filters: Record<string, string[]>) => {
    setBoardFilters(prev => ({ ...prev, [activeBoardId]: { ...(prev[activeBoardId] || { searchTerm: '', activeFilters: {} }), activeFilters: filters } }));
  }, [activeBoardId]);

  const handleCollapseAll = useCallback(() => {
    if (!activeBoard) return;
    setCollapsedGroups(new Set(activeBoard.groups.map(g => g.id)));
  }, [activeBoard]);

  const handleExpandAll = useCallback(() => {
    setCollapsedGroups(new Set());
  }, []);

  const toggleGroup = useCallback((id: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const filteredBoard = useMemo(() => {
    if (!activeBoard) return null;

    const s = (searchTerm || "").toLowerCase().trim();
    const isSearching = s.length > 0;
    const isFiltering = Object.values(activeFilters).some(v => v && v.length > 0);

    // 1. Caso base: sem filtros ativos
    if (!isSearching && !isFiltering) {
      return {
        ...activeBoard,
        groups: activeBoard.groups.filter(g => !g.archived).map(g => ({
          ...g,
          tasks: g.tasks.filter(t => !t.archived)
        }))
      };
    }

    // 2. Aplicar lógica de filtragem
    const processedGroups = activeBoard.groups.filter(g => !g.archived).map(group => {
      const gTitle = group.title.toLowerCase();
      const groupMatchesSearch = isSearching && gTitle.includes(s);
      
      const filteredTasks = group.tasks.filter(task => {
        if (task.archived) return false;

        // A. Validar Texto de Busca (MATCH GLOBAL)
        let passSearch = !isSearching || groupMatchesSearch || task.name.toLowerCase().includes(s);
        
        // Se ainda não deu match e temos busca, procuramos nas colunas
        if (!passSearch && isSearching) {
          passSearch = Object.values(task.columnValues).some(v => String(v).toLowerCase().includes(s));
        }

        if (!passSearch) return false;

        // B. Validar Categorias
        if (isFiltering) {
          for (const [catId, selected] of Object.entries(activeFilters)) {
            if (!selected || selected.length === 0) continue;
            
            let passCat = false;
            if (catId === 'group') {
              passCat = selected.includes(group.title);
            } else if (catId === 'name') {
              passCat = selected.includes(task.name);
            } else if (catId === 'person' || catId.includes('assignee')) {
              const personsNames: string[] = [];
              Object.values(task.columnValues).forEach(val => {
                if (Array.isArray(val)) val.forEach(p => p?.name && personsNames.push(p.name));
                else if (val && typeof val === 'object' && 'name' in val) personsNames.push((val as any).name);
              });
              passCat = personsNames.some(nm => selected.includes(nm));
            } else {
              const val = task.columnValues[catId];
              const col = activeBoard.columns.find(c => c.id === catId);
              let dispVal = 'Sem valor';
              if (val !== undefined && val !== null) {
                if (col?.type === 'status') dispVal = STATUS_LABELS[val as any] || 'Não iniciado';
                else if (col?.type === 'priority') dispVal = PRIORITY_LABELS[val as any] || 'Média';
                else dispVal = String(val);
              }
              passCat = selected.includes(dispVal);
            }
            if (!passCat) return false;
          }
        }
        return true;
      });

      return { ...group, tasks: filteredTasks };
    });

    // 3. Resultado Final
    return {
      ...activeBoard,
      groups: processedGroups.filter(g => g.tasks.length > 0 || (isSearching && g.title.toLowerCase().includes(s)))
    };
  }, [activeBoard, searchTerm, activeFilters]);

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
        onSelectBoard={(id) => { setActiveBoardId(id); setViewMode('table'); }}
        onAddBoard={handleAddBoard}
        onRenameBoard={handleRenameBoard}
        onDeleteBoard={handleDeleteBoard}
        onDuplicateBoard={handleDuplicateBoard}
        onSelectTeam={() => setViewMode('team')}
        onSelectGenerator={() => setViewMode('generator')}
      />

      <main className="flex-1 overflow-y-auto">
        {viewMode === 'team' ? <TeamView /> : viewMode === 'generator' ? (
          <GroupGenerator 
            boards={boards} 
            onAddColumn={handleAddColumn as (type: any, title: string, forBoardId?: string) => Promise<string | undefined>}
            onGeneratorComplete={(boardId) => {
            fetchBoards().then(data => {
              setBoards([...data, ...sampleBoards]);
              setActiveBoardId(boardId);
              setViewMode('table');
            });
          }} />
        ) : (
          <>
            <BoardHeader
              title={activeBoard?.title || 'Sem título'}
              board={activeBoard}
              viewMode={viewMode}
              onViewChange={setViewMode}
              onAddTask={handleAddTask}
              onAddGroup={handleAddGroup}
              onAutomationsClick={() => setIsAutomationOpen(true)}
              automationsCount={automations.length}
              searchTerm={searchTerm}
              onSearchChange={onSearchChange}
              activeFilters={activeFilters}
              onFilterChange={onFilterChange}
              onImportClick={() => setIsImportOpen(true)}
              onShowArchived={() => setIsArchivedOpen(true)}
              collapsedCount={collapsedGroups.size}
              totalGroups={activeBoard?.groups.length || 0}
              onCollapseAll={handleCollapseAll}
              onExpandAll={handleExpandAll}
              teamMembers={teamMembers}
            />

            {viewMode === 'table' && filteredBoard && (
              <TableView 
                board={filteredBoard} onTaskClick={setSelectedTask} onAddTask={handleAddTask} onAddGroup={handleAddGroup}
                onRenameGroup={handleRenameGroup} onDeleteGroup={handleDeleteGroup} onArchiveGroup={handleArchiveGroup}
                onDuplicateGroup={handleDuplicateGroup} onUpdateGroupBudget={handleUpdateGroupBudget}
                onAddColumn={handleAddColumn} onUpdateColumn={handleUpdateColumn} onRemoveColumn={handleRemoveColumn}
                onMoveColumn={handleMoveColumn}
                onDeleteTask={handleDeleteTask} onDuplicateTask={handleDuplicateTask} onArchiveTask={handleArchiveTask}
                onUpdateTask={handleTaskUpdate} searchTerm={searchTerm}
                collapsedGroups={collapsedGroups} onToggleGroup={toggleGroup}
                teamMembers={teamMembers}
              />
            )}

            {viewMode === 'gantt' && filteredBoard && <GanttView board={filteredBoard} />}
            {viewMode === 'dashboard' && filteredBoard && <ExecDashboard board={filteredBoard} />}
          </>
        )}
      </main>

      <AutomationCenter open={isAutomationOpen} onClose={() => setIsAutomationOpen(false)} automations={automations} onToggle={(id) => setAutomations(prev => prev.map(a => a.id === id ? { ...a, isActive: !a.isActive } : a))} onDelete={(id) => setAutomations(prev => prev.filter(a => a.id !== id))} />
      <ImportDialog open={isImportOpen} onClose={() => setIsImportOpen(false)} onImport={handleImport} existingColumns={activeBoard?.columns || []} />
      <ArchivedItemsDialog open={isArchivedOpen} onClose={() => setIsArchivedOpen(false)} board={activeBoard} onUnarchiveGroup={handleUnarchiveGroup} onDeleteGroup={handleDeleteGroup} onUnarchiveTask={handleUnarchiveTask} onDeleteTask={handleDeleteTask} />
      {selectedTask && <TaskDialog task={selectedTask} columns={activeBoard?.columns || []} open={!!selectedTask} onClose={() => setSelectedTask(null)} onUpdate={handleTaskUpdate} onDelete={handleDeleteTask} />}
    </div>
  );
}
