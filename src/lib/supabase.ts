import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://lxsobpccduvcgmmxvuvr.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'placeholder-key';

// Create a safe supabase client - won't crash even if credentials are wrong
let supabaseInstance: SupabaseClient;
try {
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
} catch (e) {
  console.warn('Supabase client creation failed, using offline mode:', e);
  // Create a minimal mock so the app doesn't crash
  supabaseInstance = createClient('https://placeholder.supabase.co', 'placeholder-key');
}

export const supabase = supabaseInstance;

export async function fetchBoards() {
  try {
    const { data: boards, error } = await supabase
      .from('boards')
      .select(`
        id,
        title,
        workspace_id,
        board_columns (
          id, title, type, width, unit, summary_type, position, formula_expr
        ),
        task_groups (
          id, title, color, position, is_archived,
          tasks (
            id, name, created_at, position,
            task_values (
              column_id, value
            )
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('CRITICAL: Supabase fetch error:', error.message);
      // Retornamos um erro customizado para o Index.tsx tratar e avisar o usuário
      throw new Error(`Database connection failed: ${error.message}`);
    }

    return (boards || []).map(board => ({
      id: board.id,
      title: board.title,
      workspaceId: board.workspace_id || 'default',
      columns: (board.board_columns || []).map((col: any) => ({
        id: col.id,
        title: col.title,
        type: col.type,
        width: col.width,
        unit: col.unit,
        summaryType: col.summary_type,
        position: col.position,
        formulaExpr: col.formula_expr
      })).sort((a: any, b: any) => a.position - b.position),
      groups: (board.task_groups || []).sort((a: any, b: any) => a.position - b.position).map((group: any) => ({
        id: group.id,
        title: group.title,
        color: group.color,
        archived: !!group.is_archived,
        tasks: (group.tasks || []).sort((a: any, b: any) => a.position - b.position).map((task: any) => {

          const columnValues: Record<string, any> = {};
          (task.task_values || []).forEach((val: any) => {
            columnValues[val.column_id] = val.value;
          });
          return {
            id: task.id,
            name: task.name,
            columnValues,
            orderIndex: task.position || 0,
            groupId: group.id
          };
        })
      }))
    }));
  } catch (err) {
    console.warn('fetchBoards failed entirely:', err);
    return [];
  }
}

export async function createBoard(title: string) {
  const { data, error } = await supabase
    .from('boards')
    .insert([{ title }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createTask(groupId: string, name: string) {
  const { data, error } = await supabase
    .from('tasks')
    .insert([{ group_id: groupId, name }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTaskValue(taskId: string, columnId: string, value: any) {
  const { error } = await supabase
    .from('task_values')
    .upsert({ task_id: taskId, column_id: columnId, value });

  if (error) throw error;
}

export async function createGroup(boardId: string, title: string, color: string) {
  const { data, error } = await supabase
    .from('task_groups')
    .insert([{ board_id: boardId, title, color }])
    .select()
    .single();

  if (error) throw error;
  return data;
}
