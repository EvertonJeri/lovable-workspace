import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://lxsobpccduvcgmmxvuvr.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

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
        board_columns (
          id, title, type, width, unit, summary_type, position
        ),
        task_groups (
          id, title, color, position,
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
      console.warn('Supabase fetch error (using local data):', error.message);
      return [];
    }

    return (boards || []).map(board => ({
      ...board,
      columns: (board.board_columns || []).sort((a: any, b: any) => a.position - b.position),
      groups: (board.task_groups || []).sort((a: any, b: any) => a.position - b.position).map((group: any) => ({
        ...group,
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
