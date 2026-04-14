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
    // Busca simplificada sem ordenação complexa no servidor para evitar erros de sintaxe
    // Simplificando a busca para o nível mais básico: buscar apenas os quadros primeiro
    const { data: boards, error } = await supabase
      .from('boards')
      .select('id, title, workspace_id')
      .order('title', { ascending: true });

    if (error) throw error;

    // Depois buscamos os detalhes de cada um (colunas e grupos) sem travar a lista
    const boardsWithDetails = await Promise.all((boards || []).map(async (board) => {
      const { data: cols } = await supabase.from('board_columns').select('*').eq('board_id', board.id).order('position', { ascending: true });
      const { data: groups } = await supabase.from('task_groups').select('*, tasks(*, task_values(*))').eq('board_id', board.id).order('position', { ascending: true });

      return {
        id: board.id,
        title: board.title,
        workspaceId: board.workspace_id || 'default',
        columns: (cols || []).map(c => ({
          id: c.id, title: c.title, type: c.type, width: c.width, unit: c.unit, summaryType: c.summary_type, position: c.position, formulaExpr: c.formula_expr
        })),
        groups: (groups || []).map(g => ({
          id: g.id, title: g.title, color: g.color, archived: !!g.is_archived, position: g.position || 0, budget: g.budget,
          tasks: (g.tasks || []).map((t: any) => ({
            id: t.id, name: t.name || '', groupId: g.id, orderIndex: t.position || 0, createdAt: t.created_at,
            columnValues: (t.task_values || []).reduce((acc: any, v: any) => ({ ...acc, [v.column_id]: v.value }), {})
          })).sort((a: any, b: any) => (a.orderIndex || 0) - (b.orderIndex || 0))
        }))
      };
    }));

    return boardsWithDetails;
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

export async function createTask(groupId: string, name: string, position?: number) {
  const { data, error } = await supabase
    .from('tasks')
    .insert([{ group_id: groupId, name, ...(position !== undefined ? { position } : {}) }])
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

export async function fetchTeamMembers() {
  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return data.map(m => ({
    id: m.id,
    name: m.name,
    role: m.role,
    avatar: m.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=random`
  }));
}

export async function fetchMonthlyGoals(year: number) {
  const { data, error } = await supabase
    .from('monthly_goals')
    .select('*')
    .eq('year', year);

  if (error) throw error;
  return data;
}

export async function updateMonthlyGoals(year: number, goals: Record<number, { value: number, includeSaturdays: boolean }>) {
  try {
    const upsertData = Object.entries(goals).map(([idx, goal]) => ({
      month_idx: parseInt(idx),
      year: year,
      value: goal.value,
      include_saturdays: goal.includeSaturdays,
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('monthly_goals')
      .upsert(upsertData, { onConflict: 'month_idx,year' });

    if (error) {
      console.error('Supabase bulk upsert error:', error);
      throw error;
    }
  } catch (err) {
    console.error('Failed to update monthly goals:', err);
    throw err;
  }
}

export async function uploadFile(file: File) {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    // Note: This assumes a bucket named 'task_files' exists and is public
    const { error: uploadError } = await supabase.storage
      .from('task_files')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('task_files')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (error) {
    console.error('Error uploading file:', error);
    return null;
  }
}
