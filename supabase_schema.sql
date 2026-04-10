-- EXECUTE ESTE SCRIPT NO EDITOR SQL DO SUPABASE (LOVABLE)

-- 1. Tabela de Quadros (Boards)
CREATE TABLE IF NOT EXISTS boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  workspace_id TEXT DEFAULT 'default',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabela de Colunas do Quadro (Board Columns)
CREATE TABLE IF NOT EXISTS board_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID REFERENCES boards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL, -- 'status', 'priority', 'date', 'number', 'formula', etc.
  width INTEGER DEFAULT 160,
  position INTEGER DEFAULT 0,
  formula_expr TEXT,
  unit TEXT,
  summary_type TEXT DEFAULT 'none'
);

-- 3. Tabela de Grupos de Tarefas (Task Groups)
CREATE TABLE IF NOT EXISTS task_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID REFERENCES boards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  color TEXT DEFAULT 'blue',
  position INTEGER DEFAULT 0,
  budget NUMERIC
);

-- 4. Tabela de Tarefas (Tasks)
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES task_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Tabela de Valores das Colunas (Task Values - EAV Model)
CREATE TABLE IF NOT EXISTS task_values (
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  column_id TEXT NOT NULL, -- Referencia virtualmente o id da board_columns (string ou UUID)
  value JSONB, -- Armazena strings, números, datas ou objetos (como timeline)
  PRIMARY KEY (task_id, column_id)
);

-- Habilitar Realtime (Opcional no Supabase para ver updates na hora)
-- ALTER PUBLICATION supabase_realtime ADD TABLE boards, board_columns, task_groups, tasks, task_values, team_members;

-- 6. Tabela de Membros da Equipe (Team Members)
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Tabela de Metas Mensais (Monthly Goals)
CREATE TABLE IF NOT EXISTS monthly_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month_idx INTEGER NOT NULL,
  year INTEGER NOT NULL,
  value NUMERIC DEFAULT 0,
  include_saturdays BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(month_idx, year)
);

-- Inserir Board Inicial para teste (Se desejar que o banco não comece vazio)
-- INSERT INTO boards (title) VALUES ('Meu Primeiro Quadro');
