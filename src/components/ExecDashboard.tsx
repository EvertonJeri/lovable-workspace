import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Board, Task } from '@/types/board';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, Cell,
  Line, ComposedChart, Area
} from 'recharts';
import { 
  TrendingUp, TrendingDown, CheckCircle, 
  Briefcase, Activity, Target, Zap, History, Layout, Archive, Loader2, Box
} from 'lucide-react';
import { format, parseISO, subMonths, getMonth, getDaysInMonth, getYear, startOfMonth, endOfMonth, getWeeksInMonth, setMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { createTask, updateTaskValue, fetchMonthlyGoals } from '@/lib/supabase';
import { toast } from 'sonner';

const normalizeSearch = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');

// Função utilitária para calcular a Linha de Tendência Linear (Regressão)
const calculateTrend = (data: any[], key: string) => {
  if (data.length < 2) return data.map(d => ({ ...d, trend: d[key] }));
  const n = data.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

  for (let i = 0; i < n; i++) {
    const y = data[i][key];
    sumX += i;
    sumY += y;
    sumXY += i * y;
    sumXX += i * i;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return data.map((d, i) => ({
    ...d,
    trend: slope * i + intercept
  }));
};

interface ExecDashboardProps {
  board: Board;
  selectedMonthExternal?: string;
  onMonthChangeExternal?: (month: string) => void;
  onBoardRefresh?: () => void;
}

const TABLEAU10 = ['#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f', '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab'];

export default function ExecDashboard({ board, selectedMonthExternal, onMonthChangeExternal, onBoardRefresh }: ExecDashboardProps) {
  const [selectedWeek, setSelectedWeek] = useState<string>('all');
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const selectedMonth = selectedMonthExternal || String(new Date().getMonth());
  const [monthlyGoal, setMonthlyGoal] = useState<number>(300000);
  const [includeSaturdays, setIncludeSaturdays] = useState<boolean>(false);

  const uniqueSectors = useMemo(() => {
    const sectorsMap = new Map<string, string>(); // normalized -> display
    board.groups.forEach(g => {
      if (normalizeSearch(g.title).includes('historico')) return;
      g.tasks.forEach(t => {
        const val = (key: string, alternatives: string[]) => {
          if (t.columnValues[key] !== undefined) return t.columnValues[key];
          for (const alt of alternatives) {
            const normAlt = normalizeSearch(alt);
            const col = board.columns.find(c => normalizeSearch(c.title) === normAlt);
            if (col && t.columnValues[col.id] !== undefined) return t.columnValues[col.id];
          }
          return '';
        };
        const sectorRaw = String(val('subitemName', ['setor', 'subitem', 'subitem name', 'responsável', 'assignee'])) || t.name;
        const norm = normalizeSearch(sectorRaw);
        if (norm && !sectorsMap.has(norm)) {
          // Salva o primeiro encontrado para exibição
          sectorsMap.set(norm, sectorRaw);
        }
      });
    });
    return Array.from(sectorsMap.values()).filter(s => s && s.trim() !== '').sort();
  }, [board.groups, board.columns]);


  // Função para calcular dias úteis reais por semana no mês selecionado
  const getWeekDaysData = () => {
    const year = new Date().getFullYear();
    const monthIdx = parseInt(selectedMonth === 'all' ? String(new Date().getMonth()) : selectedMonth);
    const totalDays = getDaysInMonth(new Date(year, monthIdx));
    
    // 5 slots de semanas (baseadas no calendário real)
    const weekWorkingDays = [0, 0, 0, 0, 0];
    let currentWeekIdx = 0;

    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(year, monthIdx, day);
      const dayOfWeek = date.getDay(); // 0 = Dom, 6 = Sab
      const isWeekend = includeSaturdays ? (dayOfWeek === 0) : (dayOfWeek === 0 || dayOfWeek === 6);
      
      if (!isWeekend) {
        weekWorkingDays[currentWeekIdx] = (weekWorkingDays[currentWeekIdx] || 0) + 1;
      }

      // Se for domingo, pula para a próxima semana calendário (máximo 5 slots)
      if (dayOfWeek === 0 && currentWeekIdx < 4) {
        // Alinhamento inteligente: só avança se a semana atual teve algum trabalho OU se já passou tempo demais
        if (weekWorkingDays[currentWeekIdx] > 0 || day > 6) {
          currentWeekIdx++;
        }
      }
    }
    return weekWorkingDays;
  };



  // Helper: find column ID by normalized title
  const findColId = useCallback((titles: string[]) => {
    for (const t of titles) {
      const norm = normalizeSearch(t);
      const col = board.columns.find(c => normalizeSearch(c.title) === norm);
      if (col) return col.id;
    }
    return titles[0]; // fallback to first name as key
  }, [board.columns]);

  // === INICIALIZAR SUB-LINHAS DO HISTÓRICO ===
  // Cria antecipadamente as linhas "Produção - mês/ano" e "Montagem - mês/ano"
  // para todos os 12 meses, posicionadas logo após a linha pai correspondente.
  const initializeHistorySubRows = useCallback(async () => {
    try {
      const histGroup = board.groups.find(g => normalizeSearch(g.title).includes('historico'));
      if (!histGroup) {
        toast.error('Grupo Histórico não encontrado.');
        return;
      }

      const dateColId = findColId(['dataEntrega', 'entrega', 'data de entrega', 'prazo', 'DATA DE ENTREGA']);
      const currentYear = new Date().getFullYear();
      let created = 0;

      // Ordenar as linhas pai por orderIndex para ter referência de posição
      const parentTasks = [...histGroup.tasks].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

      for (const parentTask of parentTasks) {
        // Só processar linhas pai (não são sub-linhas)
        const nameNorm = normalizeSearch(parentTask.name);
        if (nameNorm.startsWith('producao') || nameNorm.startsWith('montagem')) continue;

        // Extrair ano do nome se possível
        let taskYear = currentYear;
        const yearMatch = parentTask.name.match(/\b(20\d{2})\b/);
        if (yearMatch) {
          taskYear = parseInt(yearMatch[1]);
        }

        // Descobrir o mês desta linha pelo nome ou pela data
        let monthIdx = -1;
        const dateVal = parentTask.columnValues[dateColId] as string;
        if (dateVal) {
          try {
            const s = String(dateVal);
            let d: Date;
            if (s.includes('/') && s.length <= 10) {
              const [dd, mm, yy] = s.split('/');
              d = new Date(parseInt(yy), parseInt(mm)-1, parseInt(dd));
            } else { d = parseISO(s); }
            monthIdx = d.getMonth();
          } catch {}
        }
        // Fallback: tentar pelo nome da tarefa (ex: "Janeiro / 2026")
            if (monthIdx === -1) {
          const monthNames = ['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
          monthIdx = monthNames.findIndex(m => nameNorm.includes(m));
        }
        if (monthIdx === -1) continue;

        // Tentar extrair ano da data se o math do nome falhou ou para confirmar
        if (dateVal) {
          try {
            const s = String(dateVal);
            let d: Date;
            if (s.includes('/') && s.length <= 10) {
              const [dd, mm, yy] = s.split('/');
              d = new Date(parseInt(yy), parseInt(mm)-1, parseInt(dd));
            } else { d = parseISO(s); }
            taskYear = d.getFullYear();
          } catch {}
        }

        const monthLabel = format(new Date(taskYear, monthIdx, 1), 'MMMM/yyyy', { locale: ptBR });
        const lastDayStr = format(lastDayOfMonth(new Date(taskYear, monthIdx, 1)), 'yyyy-MM-dd');

        const subDefs = [
          { name: `Produção - ${monthLabel}` },
          { name: `Montagem - ${monthLabel}` },
        ];

        for (const sub of subDefs) {
          // Check ignoring case and accents
          const subNameNorm = normalizeSearch(sub.name);
          const exists = histGroup.tasks.some(t => normalizeSearch(t.name) === subNameNorm);
          if (!exists) {
            try {
              const newSub = await createTask(histGroup.id, sub.name);
              await updateTaskValue(newSub.id, dateColId, lastDayStr);
              // Também copiar a data e status para a sub-linha
              await updateTaskValue(newSub.id, statusColId, 'Concluído');
              created++;
            } catch (err) {
              console.warn(`Erro ao criar ${sub.name}:`, err);
            }
          }
        }
      }

      if (created > 0) {
        toast.success(`${created} sub-linhas criadas no Histórico!`, {
          description: 'Produção e Montagem prontas para receber os fechamentos mensais.'
        });
        onBoardRefresh?.();
      } else {
        toast.info('Todas as sub-linhas já existem ou nenhum mês válido foi encontrado.', {
          description: 'Não havia nada de novo para criar.'
        });
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao inicializar sub-linhas.');
    }
  }, [board.groups, findColId, onBoardRefresh]);

  // Verificar na inicialização se as sub-linhas já existem
  useEffect(() => {
    const histGroup = board.groups.find(g => normalizeSearch(g.title).includes('historico'));
    if (!histGroup || histGroup.tasks.length === 0) return;

    // Contar sub-linhas existentes
    const subRowCount = histGroup.tasks.filter(t => {
      const n = normalizeSearch(t.name);
      return n.startsWith('producao') || n.startsWith('montagem');
    }).length;

    // Se há linhas pai mas nenhuma sub-linha, inicializar
    const parentCount = histGroup.tasks.length - subRowCount;
    if (parentCount > 0 && subRowCount === 0) {
      setTimeout(() => initializeHistorySubRows(), 1500);
    }
  }, [board.id]);

  const closeMonthToHistory = useCallback(async (monthIdx: number, year: number, forceSubRows = false) => {
    const histGroup = board.groups.find(g => normalizeSearch(g.title).includes('historico'));
    if (!histGroup) {
      toast.error('Grupo "Histórico de Desempenho" não encontrado.');
      return false;
    }

    const parseNum = (v: any): number => {
      if (!v && v !== 0) return 0;
      if (typeof v === 'number') return v;
      return parseFloat(String(v).replace(/[R$\s%]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
    };

    const dateColId = findColId(['dataEntrega', 'entrega', 'data de entrega', 'prazo', 'DATA DE ENTREGA']);
    const statusColId = findColId(['status', 'STATUS']);

    // Procurar linha EXISTENTE do mês no histórico (pelo campo DATA DE ENTREGA)
    const existingTask = histGroup.tasks.find(t => {
      const dateVal = t.columnValues[dateColId] as string;
      if (!dateVal) return false;
      try {
        let d: Date;
        const s = String(dateVal);
        if (s.includes('/') && s.length <= 10) {
          const [dd, mm, yy] = s.split('/');
          d = new Date(parseInt(yy), parseInt(mm)-1, parseInt(dd));
        } else {
          d = parseISO(s);
        }
        return d.getMonth() === monthIdx && d.getFullYear() === year;
      } catch { return false; }
    });

    // Verificar se já foi fechado (só bloqueia se não for forceSubRows)
    if (!forceSubRows && existingTask) {
      const statusNorm = normalizeSearch(String(existingTask.columnValues[statusColId] || ''));
      const alreadyClosed = statusNorm.includes('concluido') || statusNorm.includes('feito');
      if (alreadyClosed) {
        return false; // Já fechado, não sobrescrever
      }
    }

    // Calcular produção do mês por item ativo (excluindo histórico)
    const semanas = ['semana01', 'semana02', 'semana03', 'semana04', 'semana05'] as const;
    const fabByWeek: Record<string, number> = { semana01: 0, semana02: 0, semana03: 0, semana04: 0, semana05: 0 };
    const monByWeek: Record<string, number> = { semana01: 0, semana02: 0, semana03: 0, semana04: 0, semana05: 0 };

    const groupTaskCount: Record<string, number> = {};
    board.groups.forEach(g => { groupTaskCount[g.id] = g.tasks.filter(t => !(t as any).archived).length; });

    board.groups.forEach(g => {
      if (normalizeSearch(g.title).includes('historico')) return;
      g.tasks.forEach(t => {
        const cv = t.columnValues;
        const getVal = (keys: string[]) => {
          for (const k of keys) {
            if (cv[k] !== undefined) return cv[k];
            const col = board.columns.find(c => normalizeSearch(c.title) === normalizeSearch(k));
            if (col && cv[col.id] !== undefined) return cv[col.id];
          }
          return '';
        };

        const dateRaw = getVal(['dataEntrega', 'entrega', 'data de entrega', 'prazo']);
        if (!dateRaw) return;
        let taskDate: Date | null = null;
        try {
          const s = String(dateRaw);
          if (s.includes('/') && s.length <= 10) {
            const [d, m, y] = s.split('/');
            taskDate = new Date(parseInt(y), parseInt(m)-1, parseInt(d));
          } else { taskDate = parseISO(s); }
        } catch { return; }
        if (!taskDate || taskDate.getMonth() !== monthIdx || taskDate.getFullYear() !== year) return;

        const orado = parseNum(getVal(['orado', 'orcado', 'budget', 'orçamento', 'valor']));
        const statusRaw = normalizeSearch(String(getVal(['status']) || ''));
        const isConcluido = statusRaw.includes('concluido') || statusRaw.includes('feito') || statusRaw.includes('done') || statusRaw.includes('pago');
        const isMontagem = groupTaskCount[g.id] === 1;
        const target = isMontagem ? monByWeek : fabByWeek;

        const weeklyPctSum = semanas.reduce((s, k) => s + parseNum(getVal([k])), 0);
        if (isConcluido) {
          if (weeklyPctSum > 0) {
            semanas.forEach(k => { target[k] += (parseNum(getVal([k])) * orado) / 100; });
          } else {
            const lastSem = semanas.slice().reverse().find(k => parseNum(getVal([k])) > 0) || 'semana05';
            target[lastSem] += orado;
          }
        } else {
          semanas.forEach(k => { target[k] += (parseNum(getVal([k])) * orado) / 100; });
        }
      });
    });

    const totalFabrica = Object.values(fabByWeek).reduce((a, b) => a + b, 0);
    const totalMontagem = Object.values(monByWeek).reduce((a, b) => a + b, 0);
    const totalGeral = totalFabrica + totalMontagem;

    if (totalGeral === 0) return false;

    const monthName = format(new Date(year, monthIdx, 1), 'MMMM yyyy', { locale: ptBR });

    try {
      setIsClosingMonth(true);

      let taskId: string;
      if (existingTask) {
        // ATUALIZAR linha existente (ou apenas criar sub-linhas se forceSubRows)
        taskId = existingTask.id;
      } else {
        // CRIAR nova linha apenas se não existe nenhuma para este mês
        const lastDay = format(lastDayOfMonth(new Date(year, monthIdx, 1)), 'yyyy-MM-dd');
        const newTask = await createTask(histGroup.id, monthName);
        taskId = newTask.id;
        await updateTaskValue(taskId, dateColId, lastDay);
      }

      // Salvar totais semanais (Fábrica + Montagem) — apenas se não for forceSubRows
      if (!forceSubRows) {
        for (const sem of semanas) {
          const total = (fabByWeek[sem] || 0) + (monByWeek[sem] || 0);
          await updateTaskValue(taskId, findColId([sem, `${sem.replace('semana', 'semana ')}`, `${sem} (%)`]), total);
        }
        await updateTaskValue(taskId, 'fabricaTotal', totalFabrica);
        await updateTaskValue(taskId, 'montagemTotal', totalMontagem);
        await updateTaskValue(taskId, statusColId, 'Concluído');
      }

      // === CRIAR/ATUALIZAR LINHAS DE BREAKDOWN (Produção e Montagem) ===
      const lastDayStr = format(lastDayOfMonth(new Date(year, monthIdx, 1)), 'yyyy-MM-dd');
      const monthLabel = format(new Date(year, monthIdx, 1), 'MMMM/yyyy', { locale: ptBR });
      // Posição da linha pai para colocar sub-linhas logo abaixo
      const parentOrderIndex = existingTask ? (existingTask.orderIndex ?? 0) : 999;

      const subRows = [
        { name: `Produção - ${monthLabel}`, byWeek: fabByWeek, total: totalFabrica, pos: parentOrderIndex + 0.1 },
        { name: `Montagem - ${monthLabel}`, byWeek: monByWeek, total: totalMontagem, pos: parentOrderIndex + 0.2 },
      ];

      for (const sub of subRows) {
        if (sub.total <= 0) continue;

        // Verificar se sub-linha já existe (Busca por Tipo + Data para ser resiliente a erros no nome)
        const existingSubRow = histGroup.tasks.find(t => {
          const n = normalizeSearch(t.name);
          const subType = sub.name.toLowerCase().startsWith('produção') || sub.name.toLowerCase().startsWith('producao') ? 'producao' : 'montagem';
          if (!n.startsWith(subType)) return false;
          
          const dateVal = t.columnValues[dateColId] as string;
          if (!dateVal) return false;
          try {
            let d: Date;
            const s = String(dateVal);
            if (s.includes('/') && s.length <= 10) {
              const [dd, mm, yy] = s.split('/');
              d = new Date(parseInt(yy), parseInt(mm)-1, parseInt(dd));
            } else { d = parseISO(s); }
            return d.getMonth() === monthIdx && d.getFullYear() === year;
          } catch { return false; }
        });

        let subTaskId: string;
        if (existingSubRow) {
          subTaskId = existingSubRow.id;
          // Corrigir nome se estiver diferente (ex: erro de ano no nome)
          if (existingSubRow.name !== sub.name) {
             await supabase.from('tasks').update({ name: sub.name }).eq('id', subTaskId);
          }
        } else {
          // Criar com posição logo após a linha pai
          const newSub = await createTask(histGroup.id, sub.name, sub.pos);
          subTaskId = newSub.id;
          await updateTaskValue(subTaskId, dateColId, lastDayStr);
        }

        // Salvar valores semanais individuais
        for (const sem of semanas) {
          const v = sub.byWeek[sem] || 0;
          await updateTaskValue(subTaskId, findColId([sem, `${sem.replace('semana', 'semana ')}`, `${sem} (%)`]), v);
        }
        await updateTaskValue(subTaskId, statusColId, 'Concluído');
      }

      toast.success(`Mês de ${monthName} ${forceSubRows ? 'sub-linhas criadas!' : 'fechado!'}`, {
        description: `Fábrica: ${totalFabrica.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} | Montagem: ${totalMontagem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
      });

      onBoardRefresh?.();
      return true;
    } catch (err) {
      console.error('Erro ao fechar mês:', err);
      toast.error('Erro ao fechar o mês no histórico.');
      return false;
    } finally {
      setIsClosingMonth(false);
    }
  }, [board, findColId, onBoardRefresh]);


  const allItems = useMemo(() => {
    // Contar tasks por grupo antes de mapear
    const groupTaskCount: Record<string, number> = {};
    board.groups.forEach(g => { groupTaskCount[g.id] = g.tasks.length; });

    // Encontrar ID da coluna de fórmula/faturamento uma vez para ser certeiro
    const formulaCol = (board.columns || []).find(c => {
      const n = normalizeSearch(c.title);
      return n === 'mesformula' || n === 'formula' || n.includes('formula') || n.includes('faturamento');
    });
    const formulaColId = formulaCol?.id;

    return board.groups.flatMap(g => g.tasks.map(t => {
      const gTitleNorm = normalizeSearch(g.title);
      const isHistoryGroup = gTitleNorm.includes('historico');
      // Sub-linhas de breakdown ("Produção - X" e "Montagem - X") não devem ser contabilizadas nos totais
      const tNameNorm = normalizeSearch(t.name);
      const isHistorySubrow = isHistoryGroup && (tNameNorm.startsWith('producao') || tNameNorm.startsWith('montagem'));
      // Regra: 1 tarefa no grupo = Montagem/Desmontagem, 2+ = Produção (Fábrica). No Histórico, checa pelo nome.
      const isMontagem = !isHistoryGroup ? (groupTaskCount[g.id] === 1) : tNameNorm.startsWith('montagem');
      
      const val = (key: string, alternatives: string[]) => {
        if (t.columnValues[key] !== undefined) return t.columnValues[key];
        for (const alt of [key, ...alternatives]) {
          const normAlt = normalizeSearch(alt);
          const col = board.columns.find(c => normalizeSearch(c.title) === normAlt);
          if (col && t.columnValues[col.id] !== undefined) return t.columnValues[col.id];
          if (t.columnValues[alt] !== undefined) return t.columnValues[alt];
        }
        return '';
      };

      const parseNum = (v: any): number => {
        if (v === undefined || v === null || v === '') return 0;
        if (typeof v === 'number') return v;
        const s = String(v).replace(/[R$\s%]/g, '').replace(/\./g, '').replace(',', '.').trim();
        return parseFloat(s) || 0;
      };
      
      const percentual = parseNum(val('percentual', ['conclusao', '%', 'progress', 'progresso']));
      const orado = parseNum(val('orado', ['orcado', 'budget', 'orçamento', 'orcamento', 'valor']));
      const semana01 = parseNum(val('semana01', ['sem01', 's1', 'semana01', 'semana 01']));
      const semana02 = parseNum(val('semana02', ['sem02', 's2', 'semana02', 'semana 02']));
      const semana03 = parseNum(val('semana03', ['sem03', 's3', 'semana03', 'semana 03']));
      const semana04 = parseNum(val('semana04', ['sem04', 's4', 'semana04', 'semana 04']));
      const semana05 = parseNum(val('semana05', ['sem05', 's5', 'semana05', 'semana 05']));
      
      // Scanner inteligente de faturamento/produção acumulada
      let mes_fechado = 0;
      // Para itens ATIVOS, priorizamos buscar a coluna que se chama literalmente "Mês anterior"
      const mesAnteriorCol = (board.columns || []).find(c => {
        const n = normalizeSearch(c.title);
        return n === 'mesanterior' || n.includes('anterior');
      });
      const mesAnteriorId = mesAnteriorCol?.id;

      const rawMesFechado = mesAnteriorId ? t.columnValues[mesAnteriorId] : (formulaColId ? t.columnValues[formulaColId] : val('mes_fechado', ['mês anterior', 'Mês anterior', 'Mês Formula', 'formula']));
      mes_fechado = parseNum(rawMesFechado);

      // No Histórico (Linha Pai), o total é a SOMA das semanas (que são valores absolutos lá)
      if (isHistoryGroup && !isHistorySubrow) {
        const weeklySum = semana01 + semana02 + semana03 + semana04 + semana05;
        // Pega o maior entre a coluna de fórmula e a soma das semanas
        mes_fechado = Math.max(mes_fechado, weeklySum);
        
        // Se ainda for 1 (orçamento placeholder), tenta escanear qualquer valor alto na linha
        if (mes_fechado <= 1) {
          Object.entries(t.columnValues).forEach(([colId, v]) => {
            const col = board.columns.find(c => c.id === colId);
            if (!col) return;
            const parsed = parseNum(v);
            if (parsed > 100 && !normalizeSearch(col.title).includes('data')) {
              mes_fechado = Math.max(mes_fechado, parsed);
            }
          });
        }
      }

      const dataEntregaRaw = val('dataEntrega', ['entrega', 'data de entrega', 'prazo', 'delivery']);
      let dataEntrega: Date | null = null;
      if (dataEntregaRaw) {
        try { 
          const sDate = String(dataEntregaRaw);
          if (sDate.includes('/') && sDate.length <= 10) {
            const [d, m, y] = sDate.split('/');
            dataEntrega = new Date(parseInt(y), parseInt(m)-1, parseInt(d));
          } else {
            dataEntrega = parseISO(sDate); 
          }
        } catch(e) { }
      }

      return {
        id: t.id,
        name: t.name,
        groupName: g.title,
        groupId: g.id,
        subitemName: String(val('subitemName', ['setor', 'subitem', 'subitem name', 'responsável', 'assignee'])) || t.name,
        percentual,
        orado,
        semana01,
        semana02,
        semana03,
        semana04,
        semana05,
        mes_fechado,
        dataEntrega,
        status: String(val('status', ['status'])) || 'default',
        isHistory: isHistoryGroup,
        isHistorySubrow,
        isMontagem,
        // Breakdown salvo no fechamento automático
        fabricaTotal: parseNum(val('fabricaTotal', ['fabricaTotal'])),
        montagemTotal: parseNum(val('montagemTotal', ['montagemTotal'])),
      };
    }));
  }, [board]);

  const [now] = useState(new Date());
  const displayMonthDate = useMemo(() => selectedMonth === 'all' ? now : setMonth(now, parseInt(selectedMonth)), [selectedMonth, now]);
  const currentMonthName = useMemo(() => format(displayMonthDate, 'MMMM', { locale: ptBR }), [displayMonthDate]);
  const prevMonthName = useMemo(() => format(subMonths(displayMonthDate, 1), 'MMMM', { locale: ptBR }), [displayMonthDate]);
  const isSelectedMonthPast = useMemo(() => (getYear(displayMonthDate) < getYear(now)) || (getYear(displayMonthDate) === getYear(now) && getMonth(displayMonthDate) < getMonth(now)), [displayMonthDate, now]);
  
  const historyGroup = useMemo(() => board.groups.find(g => normalizeSearch(g.title).includes('historico')), [board.groups]);
  const historyGroupId = historyGroup?.id;

  const [isClosingMonth, setIsClosingMonth] = useState(false);
  const [isLoadingGoals, setIsLoadingGoals] = useState(true);
  const [yearlyGoals, setYearlyGoals] = useState<Record<number, any>>({});

  // Carregar meta do storage/DB quando o mês ou ano mudar
  useEffect(() => {
    async function loadMonthlyGoals() {
      setIsLoadingGoals(true);
      try {
        const year = getYear(now);
        const data = await fetchMonthlyGoals(year);
        
        const goalsMap: Record<number, any> = {};
        data?.forEach(g => {
          goalsMap[g.month_idx] = { value: Number(g.value), includeSaturdays: !!g.include_saturdays };
        });

        // Fallback p/ localStorage (Migração)
        const savedV2 = localStorage.getItem('executive_monthly_goals_v2');
        if (savedV2 && Object.keys(goalsMap).length === 0) {
          const local = JSON.parse(savedV2);
          Object.keys(local).forEach(k => {
            const idx = parseInt(k);
            goalsMap[idx] = local[k];
          });
        }

        setYearlyGoals(goalsMap);

        if (selectedMonth !== 'all') {
          const mIdx = parseInt(selectedMonth);
          const config = goalsMap[mIdx] || { value: 0, includeSaturdays: false };
          setMonthlyGoal(config.value);
          setIncludeSaturdays(config.includeSaturdays);
        } else {
          setMonthlyGoal(0);
          setIncludeSaturdays(false);
        }
      } catch (err) {
        console.error('Error loading goals in dashboard:', err);
      } finally {
        setIsLoadingGoals(false);
      }
    }

    loadMonthlyGoals();
  }, [selectedMonth, now]);

  const workItems = useMemo(() => {
    return allItems.filter(item => {
      // Regra: Itens de Histórico só entram se o mês selecionado já foi concluído ou se é o mês atual
      if (item.isHistory) {
        if (selectedMonth === 'all') return true;
        if (!item.dataEntrega) return false;
        // Itens de histórico devem bater exatamente com o mês selecionado
        // Permitir histórico do mês atual para não sumirem do dashboard assim que fechados
        const itemMonth = getMonth(item.dataEntrega);
        const itemYear = getYear(item.dataEntrega);
        const currentMonthIdx = now.getMonth();
        const currentYear = now.getFullYear();
        
        const isSelectedMonth = itemMonth === parseInt(selectedMonth);
        const isCurrentYear = itemYear === currentYear;
        
        return isSelectedMonth && isCurrentYear;
      }

      if (!item.name && !item.subitemName) return false;
      
      // Filtro por Setor (Case-Insensitive)
      if (selectedSector !== 'all') {
        if (normalizeSearch(item.subitemName) !== normalizeSearch(selectedSector)) return false;
      }

      // Para itens normais, seguimos a data de entrega, mas permitimos adiantamento
      if (selectedMonth === 'all') {
        const currentMonthStart = startOfMonth(now);
        return item.dataEntrega && item.dataEntrega >= currentMonthStart;
      } else {
        const monthIdx = parseInt(selectedMonth);
        const currentYear = now.getFullYear();
        const isSelectedCurrentMonth = monthIdx === now.getMonth() && currentYear === now.getFullYear();

        const matchesDate = item.dataEntrega && 
                           getMonth(item.dataEntrega) === monthIdx && 
                           getYear(item.dataEntrega) === currentYear;
        
        // Regra de Adiantamento: Se for futuro, mas tiver progresso nas semanas, no percentual geral ou status alterado, entra no mês vigente
        const hasWeeklyProgress = (item.semana01 || 0) + (item.semana02 || 0) + (item.semana03 || 0) + (item.semana04 || 0) + (item.semana05 || 0) > 0;
        const hasGeneralProgress = (item.percentual || 0) > 0;
        const statusNorm = normalizeSearch(item.status);
        const hasActiveStatus = statusNorm !== "" && statusNorm !== "nao iniciado" && statusNorm !== "pendente";
        
        const isFutureAdvance = isSelectedCurrentMonth && item.dataEntrega && item.dataEntrega > endOfMonth(now) && (hasWeeklyProgress || hasGeneralProgress || hasActiveStatus);

        return matchesDate || isFutureAdvance;
      }
    });
  }, [allItems, selectedMonth, isSelectedMonthPast, selectedSector]);

  const {
    uniqueProjects, totalValueByWeek, conclusaoGeral, valueMesAnterior, groupSummaries, historicalData, valorProjetadoMes, weeklyBreakdown, breakdownTotals
  } = useMemo(() => {
    // 0. Valor Projetado (Orçado) - Estritamente o que vence no mês selecionado
    let valorProjetadoMes = 0;
    if (selectedMonth === 'all') {
      const currentMonthStart = startOfMonth(now);
      allItems.forEach(item => {
        if (!item.isHistory && item.dataEntrega && item.dataEntrega >= currentMonthStart) {
          valorProjetadoMes += (item.orado || 0);
        }
      });
    } else {
      const monthIdx = parseInt(selectedMonth);
      const currentYear = now.getFullYear();
      allItems.forEach(item => {
        if (!item.isHistory && item.dataEntrega && getMonth(item.dataEntrega) === monthIdx && getYear(item.dataEntrega) === currentYear) {
          valorProjetadoMes += (item.orado || 0);
        }
      });
    }

    const currentMonthStart = startOfMonth(now);

    const activeItems = workItems.map(item => ({
      ...item,
      activePercentual: selectedWeek === 'all' ? item.percentual : (item[selectedWeek as keyof typeof item] as number || 0)
    }));

    // ScopedItems para meta do mês (Orçado/Saldo): Apenas itens datados para o mês selecionado
    const monthIdx = selectedMonth === 'all' ? -1 : parseInt(selectedMonth);
    const metaMonthItems = activeItems.filter(item => {
      if (item.isHistory) return false;
      if (selectedMonth === 'all') return item.dataEntrega && item.dataEntrega >= currentMonthStart;
      return item.dataEntrega && getMonth(item.dataEntrega) === monthIdx && getYear(item.dataEntrega) === now.getFullYear();
    });

    // Itens estendidos para Produção/Gráficos/Status: Inclui adiantamentos (já estão no activeItems do workItems)
    const scopedItems = activeItems.filter(item => !item.isHistory);

    const projectSet = new Set<string>();
    metaMonthItems.forEach(item => {
      if (item.groupId && item.groupId !== historyGroupId) {
        projectSet.add(item.groupId);
      }
    });
    const uniqueProjects = projectSet.size;

    // Calcular conclusão baseada na produção do mês vs orçado (apenas itens oficiais do mês)
    let totalProducedInScope = 0;
    let totalBudgetInScope = 0;
    metaMonthItems.forEach(item => {
      const budget = item.orado || 0;
      if (budget <= 0) return;
      
      const statusNorm = normalizeSearch(item.status);
      const isConcluido = statusNorm.includes('concluido') || statusNorm.includes('feito') || statusNorm.includes('done') || statusNorm.includes('pago');
      const weeklySumPerc = (item.semana01 || 0) + (item.semana02 || 0) + (item.semana03 || 0) + (item.semana04 || 0) + (item.semana05 || 0);
      
      // Se concluído e sem semanas preenchidas, assume 100%. Senão, usa as semanas.
      let producedValue = 0;
      if (isConcluido && weeklySumPerc === 0) {
        producedValue = budget;
      } else {
        producedValue = (weeklySumPerc * budget) / 100;
      }
      
      totalProducedInScope += producedValue;
      totalBudgetInScope += budget;
    });
    const conclusaoGeral = totalBudgetInScope > 0 ? (totalProducedInScope / totalBudgetInScope) * 100 : 0;

    const semanas = ['semana01', 'semana02', 'semana03', 'semana04', 'semana05'] as const;
    const valueByWeek: Record<string, number> = { semana01: 0, semana02: 0, semana03: 0, semana04: 0, semana05: 0 };
    
    // Mapear também por tipo (Produção vs Montagem)
    const valueByWeekFabrica: Record<string, number> = { semana01: 0, semana02: 0, semana03: 0, semana04: 0, semana05: 0 };
    const valueByWeekMontagem: Record<string, number> = { semana01: 0, semana02: 0, semana03: 0, semana04: 0, semana05: 0 };

    // Indexar quais meses têm sub-linhas de Produção/Montagem para evitar duplicidade no total
    const monthsWithSubrowsInCurrentView = new Set<string>();
    activeItems.forEach(item => {
      if (item.isHistory && (item as any).isHistorySubrow && item.dataEntrega) {
        const key = `${getYear(item.dataEntrega)}-${getMonth(item.dataEntrega)}`;
        monthsWithSubrowsInCurrentView.add(key);
      }
    });

    activeItems.forEach(item => {
      const isHistory = item.isHistory;
      const budget = item.orado || 0;
      const statusNorm = normalizeSearch(item.status);
      const isConcluido = statusNorm.includes('concluido') || statusNorm.includes('feito') || statusNorm.includes('done') || statusNorm.includes('pago');
      const targetMap = (item as any).isMontagem ? valueByWeekMontagem : valueByWeekFabrica;

      // Já que os itens já foram filtrados no workItems, permitimos que todos entrem no cálculo semanal
      const shouldShowInWeekly = true;
      if (!shouldShowInWeekly) return;

      if (isHistory) {
        // Evitar duplicidade: se o mês tem sub-linhas, ignoramos a linha pai.
        const isSubrow = (item as any).isHistorySubrow;
        const monthKey = item.dataEntrega ? `${getYear(item.dataEntrega)}-${getMonth(item.dataEntrega)}` : '';
        if (monthKey && monthsWithSubrowsInCurrentView.has(monthKey) && !isSubrow) return;

        const weeklyPctSum = semanas.reduce((acc, sem) => acc + (item[sem] || 0), 0);
        
        if (weeklyPctSum > 0) {
          // Se o histórico já tem o detalhamento semanal, usamos ele
          semanas.forEach(sem => { 
            const val = (item[sem] || 0);
            valueByWeek[sem] += val; 
            targetMap[sem] += val; 
          });
        } else if (budget > 0 && item.dataEntrega) {
          // Se não tem detalhamento, distribuímos o Orçado total
          const itemMonth = getMonth(item.dataEntrega);
          const itemYear = getYear(item.dataEntrega);
          
          // Para Jan, Fev, Mar de 2026, forçamos 4 semanas conforme solicitado
          let numWeeks = getWeeksInMonth(item.dataEntrega, { weekStartsOn: 0 });
          if (itemYear === 2026 && itemMonth <= 2) { // 0=Jan, 1=Feb, 2=Mar
            numWeeks = 4;
          }
          
          const distributedValue = budget / numWeeks;
          
          semanas.forEach((sem, idx) => {
            if (idx < numWeeks) {
              valueByWeek[sem] += distributedValue;
              targetMap[sem] += distributedValue;
            }
          });
        }
      } else if (isConcluido) {
        const weeklyPctSum = (item.semana01 || 0) + (item.semana02 || 0) + (item.semana03 || 0) + (item.semana04 || 0) + (item.semana05 || 0);
        if (weeklyPctSum > 0) {
          semanas.forEach(sem => { const v = ((item[sem] || 0) * budget) / 100; valueByWeek[sem] += v; targetMap[sem] += v; });
        } else {
          const lastSem = item.semana05 ? 'semana05' : item.semana04 ? 'semana04' : item.semana03 ? 'semana03' : item.semana02 ? 'semana02' : 'semana01';
          valueByWeek[lastSem] += budget;
          targetMap[lastSem] += budget;
        }
      } else {
        semanas.forEach(sem => { const v = ((item[sem] || 0) * budget) / 100; valueByWeek[sem] += v; targetMap[sem] += v; });
      }
    });

    // Para Jan, Fev, Mar 2026 (dados importados), limitamos a 4 semanas no gráfico
    const selectedMonthIdx = selectedMonth === 'all' ? now.getMonth() : parseInt(selectedMonth);
    const selectedYear = now.getFullYear();
    const maxWeeks = (selectedYear === 2026 && selectedMonthIdx <= 2) ? 4 : 5;

    const totalValueByWeek = Object.entries(valueByWeek)
      .map(([name, val], idx) => ({ 
        name: name.replace('semana0', 'Semana '), 
        key: name, 
        valor: val,
        fabrica: valueByWeekFabrica[name] || 0,
        montagem: valueByWeekMontagem[name] || 0,
        _idx: idx,
      }))
      .filter(d => d._idx < maxWeeks);

    // Tabela de Breakdown por tipo
    const weeklyBreakdown = semanas.map((sem, i) => {
      const total = valueByWeek[sem];
      const fabrica = valueByWeekFabrica[sem];
      const montagem = valueByWeekMontagem[sem];
      return {
        label: `Semana ${i + 1}`,
        total,
        fabrica,
        montagem,
        pctFabrica: total > 0 ? (fabrica / total) * 100 : 0,
        pctMontagem: total > 0 ? (montagem / total) * 100 : 0,
      };
    }).filter((w, i) => i < maxWeeks && w.total > 0);

    // Totais gerais
    const totalGeral = Object.values(valueByWeek).reduce((a, b) => a + b, 0);
    const totalFabrica = Object.values(valueByWeekFabrica).reduce((a, b) => a + b, 0);
    const totalMontagem = Object.values(valueByWeekMontagem).reduce((a, b) => a + b, 0);
    const displayTotalFilteredValue = totalGeral; // Tudo o que foi produzido (incluindo adiantamentos)
    const totalSaldoProduzir = Math.max(0, valorProjetadoMes - displayTotalFilteredValue);

    const breakdownTotals = {
      total: totalGeral,
      fabrica: totalFabrica,
      montagem: totalMontagem,
      pctFabrica: totalGeral > 0 ? (totalFabrica / totalGeral) * 100 : 0,
      pctMontagem: totalGeral > 0 ? (totalMontagem / totalGeral) * 100 : 0,
      saldoProduzir: totalSaldoProduzir,
      displayProduction: displayTotalFilteredValue
    };


    let valueMesAnterior = 0;
    const prevMonthIdx = selectedMonth === 'all' ? (now.getMonth() - 1 + 12) % 12 : (parseInt(selectedMonth) - 1 + 12) % 12;
    const prevMonthName = format(setMonth(new Date(), prevMonthIdx), 'MMMM', { locale: ptBR });
    const prevMonthNameNorm = normalizeSearch(prevMonthName);

    // 1. Prioridade Absoluta: Buscar a linha pai no histórico que tem o nome do mês anterior (ex: "Março / 2026")
    allItems.forEach(item => {
      if (item.isHistory && !item.isHistorySubrow) {
        const nameNorm = normalizeSearch(item.name);
        if (nameNorm.includes(prevMonthNameNorm)) {
          // No histórico consolidado, PRIORIZAMOS o mes_fechado (Mês Formula)
          // Se o valor estiver zerado na coluna formula, tenta o orçado como backup
          const val = item.mes_fechado || item.orado || 0;
          valueMesAnterior += val;
        }
      }
    });

    // 2. Fallback de Segurança: Se não achou pelo nome, tenta por data de entrega no histórico
    if (valueMesAnterior === 0) {
      allItems.forEach(item => {
        if (item.isHistory && !item.isHistorySubrow && item.dataEntrega && getMonth(item.dataEntrega) === prevMonthIdx) {
          valueMesAnterior += (item.mes_fechado || item.orado || 0);
        }
      });
    }

    // 1. Mapear produção histórica por nome de projeto (apenas linhas pai no grupo histórico)
    const historicalProdByName: Record<string, number> = {};
    allItems.forEach(i => {
      if (i.isHistory && !i.isHistorySubrow) {
        const normName = normalizeSearch(i.name);
        historicalProdByName[normName] = (historicalProdByName[normName] || 0) + (i.orado || 0);
      }
    });

    const gs: Record<string, any> = {};
    scopedItems.forEach(i => {
      if (i.isHistory) return; // Filtramos aqui pois queremos os cards dos projetos ATIVOS
      const budget = i.orado || 0;
      if (budget <= 0) return; // IGNORAR LINHAS SEM ORÇAMENTO NO STATUS DO PROJETO
      
      if (!gs[i.groupId]) {
        // Buscar se existe histórico acumulado para este projeto pelo nome do grupo
        const groupNameNorm = normalizeSearch(i.groupName);
        const accumulatedFromHistory = historicalProdByName[groupNameNorm] || 0;
        
        gs[i.groupId] = { 
          id: i.groupId, 
          name: i.groupName, 
          histSum: accumulatedFromHistory, // Valor vindo do grupo Histórico
          producedSum: 0, 
          oradoSum: 0, 
          count: 0, 
          pendentes: 0 
        };
      }
      
      const weeklySumPerc = (i.semana01 || 0) + (i.semana02 || 0) + (i.semana03 || 0) + (i.semana04 || 0) + (i.semana05 || 0);
      const currentWeeksProduced = (weeklySumPerc * budget) / 100;
      
      // Para itens ATIVOS, o mes_fechado (Mês anterior) costuma ser uma porcentagem (ex: 40%)
      const prevMonthProduced = i.isHistory ? (i.mes_fechado || 0) : ((i.mes_fechado || 0) * budget) / 100;
      
      gs[i.groupId].producedSum += prevMonthProduced + currentWeeksProduced;
      gs[i.groupId].oradoSum += budget;
      gs[i.groupId].count += 1;
      
      const totalItemProduced = prevMonthProduced + currentWeeksProduced;
      const itemPercent = budget > 0 ? (totalItemProduced / budget) * 100 : 0;
      if (itemPercent < 99) gs[i.groupId].pendentes += 1;
    });

    const groupSummaries = Object.values(gs).map(g => {
      const totalProduced = g.histSum + g.producedSum; // Soma Histórico (Pai) + Colunas (Mês Anterior + Semanas)
      return { 
        ...g, 
        avgPercent: g.oradoSum > 0 ? (totalProduced / g.oradoSum) * 100 : 0 
      };
    }).sort((a, b) => b.avgPercent - a.avgPercent);

    const historicalData: any[] = [];
    if (historyGroup) {
      const monthlyTotals: Record<number, number> = {};
      const monthlyFabrica: Record<number, number> = {};
      const monthlyMontagem: Record<number, number> = {};

      // Primeiro, indexar quais meses têm sub-linhas de Produção/Montagem (Composta por Ano-Mês)
      const monthsWithSubrows = new Set<string>();
      allItems.forEach(item => {
        if (item.isHistory && (item as any).isHistorySubrow && item.dataEntrega) {
          const key = `${getYear(item.dataEntrega)}-${getMonth(item.dataEntrega)}`;
          monthsWithSubrows.add(key);
        }
      });

      allItems.forEach(item => {
        if (item.isHistory && item.dataEntrega) {
          const m = getMonth(item.dataEntrega);
          const y = getYear(item.dataEntrega);
          const monthKey = `${y}-${m}`;
          const isSubrow = (item as any).isHistorySubrow;
          
          // Se o mês tem sub-linhas, ignoramos a linha Pai para não duplicar.
          // Se não tem, usamos a linha Pai.
          if (monthsWithSubrows.has(monthKey) && !isSubrow) return;

          const weeklySumValue = (item.semana01 || 0) + (item.semana02 || 0) + (item.semana03 || 0) + (item.semana04 || 0) + (item.semana05 || 0);
          monthlyTotals[m] = (monthlyTotals[m] || 0) + (weeklySumValue || item.orado || 0);
          // Ler fabricaTotal e montagemTotal salvos no fechamento automático
          const fab = (item as any).fabricaTotal || 0;
          const mon = (item as any).montagemTotal || 0;
          monthlyFabrica[m] = (monthlyFabrica[m] || 0) + fab;
          monthlyMontagem[m] = (monthlyMontagem[m] || 0) + mon;
        }
      });
      
      const monthlyGoals = yearlyGoals;

      historicalData.push(...Array.from({ length: 12 }).map((_, i) => {
        const goal = monthlyGoals[i]?.value || 0;
        const total = monthlyTotals[i] || 0;
        const fabrica = monthlyFabrica[i] || 0;
        const montagem = monthlyMontagem[i] || 0;
        return { 
          name: format(setMonth(new Date(), i), 'MMM', { locale: ptBR }), 
          valor: total,
          fabrica,
          montagem,
          meta: goal,
          isCurrent: i === now.getMonth()
        };
      }).filter(h => h.valor > 0 || h.meta > 0 || h.isCurrent));
    }

    return { uniqueProjects, totalValueByWeek, conclusaoGeral, valueMesAnterior, groupSummaries, historicalData, valorProjetadoMes, weeklyBreakdown, breakdownTotals };
  }, [workItems, selectedWeek, board.groups, allItems, historyGroupId, selectedMonth, isSelectedMonthPast, now]);


  const weeklyChartData = useMemo(() => {
    const raw = selectedWeek === 'all' ? totalValueByWeek : totalValueByWeek.filter(tw => tw.key === selectedWeek);
    const productionByWeek = totalValueByWeek.map(tw => tw.valor);
    
    // Pegar dias úteis REAIS por semana
    const weekWorkingDays = getWeekDaysData();
    const totalWorkingDays = weekWorkingDays.reduce((a, b) => a + b, 0);

    let currentRemainingGoal = monthlyGoal;
    let currentRemainingDays = totalWorkingDays;
    const metas = new Array(5).fill(0);
    const originalMetas = new Array(5).fill(0);
    
    const year = getYear(displayMonthDate);
    const monthIdx = getMonth(displayMonthDate);
    const totalDays = new Date(year, monthIdx + 1, 0).getDate();
    
    const weekEndDates: number[] = [];
    let tempIdx = 0;
    let skipCount = 0;
    
    // Recalcular weekEndDates ignorando semanas iniciais vazias (alinhamento com DB)
    for (let day = 1; day <= totalDays; day++) {
        const d = new Date(year, monthIdx, day);
        const dayOfWeek = d.getDay();
        const isWeekend = includeSaturdays ? (dayOfWeek === 0) : (dayOfWeek === 0 || dayOfWeek === 6);
        
        if (dayOfWeek === 0 || day === totalDays) {
            // Verificamos se essa semana que acabou de fechar teve algum dia útil
            let hasWork = false;
            for (let j = Math.max(1, day - 6); j <= day; j++) {
                const dj = new Date(year, monthIdx, j);
                if (dj.getMonth() !== monthIdx) continue;
                const dwj = dj.getDay();
                const isWj = includeSaturdays ? (dwj === 0) : (dwj === 0 || dwj === 6);
                if (!isWj) { hasWork = true; break; }
            }

            if (hasWork || day > 7) {
                weekEndDates[tempIdx] = day;
                tempIdx++;
            }
        }
    }

    const isMonthPast = isSelectedMonthPast;
    for (let i = 0; i < 5; i++) {
        const d = weekWorkingDays[i];
        if (d > 0 && totalWorkingDays > 0) {
            metas[i] = (monthlyGoal * d) / totalWorkingDays;
        } else {
            metas[i] = 0;
        }
        originalMetas[i] = metas[i];
    }

    const finalData = totalValueByWeek
      .map((d, i) => {
        const d_meta = metas[i] || 0;
        const d_original = originalMetas[i] || 0;
        const d_hasDays = weekWorkingDays[i] > 0;
        return { ...d, meta: d_meta, metaOriginal: d_original, hasDays: d_hasDays };
      })
      .filter(d => (selectedWeek === 'all' ? true : d.key === selectedWeek));

    return calculateTrend(finalData, 'valor');
  }, [totalValueByWeek, selectedWeek, monthlyGoal, displayMonthDate, now, includeSaturdays, isSelectedMonthPast]);

  const historicalChartData = useMemo(() => calculateTrend(historicalData, 'valor'), [historicalData]);
  const totalFilteredValue = weeklyChartData.reduce((acc, curr) => acc + curr.valor, 0);

  const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const formatCompactBRL = (val: number) => {
    if (val >= 1000000) return `R$ ${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `R$ ${(val / 1000).toFixed(1)}K`;
    return `R$ ${val.toFixed(0)}`;
  };

  return (
    <div className="p-4 md:p-6 bg-[#f5f6f8] min-h-full space-y-6 overflow-x-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <h2 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight">Desempenho Oficial</h2>
        <div className="flex flex-wrap items-center gap-3 md:gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600 font-medium whitespace-nowrap">Mês:</label>
            <select 
              value={selectedMonth} 
              onChange={(e) => onMonthChangeExternal?.(e.target.value)} 
              className="border-slate-300 rounded-md shadow-sm text-sm p-1.5 focus:border-blue-500 focus:ring-blue-500 bg-white"
            >
              <option value="all">Todos os Meses</option>
              {Array.from({ length: 12 }).map((_, i) => (
                <option key={i} value={i}>
                  {format(setMonth(new Date(), i), 'MMMM', { locale: ptBR })}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600 font-medium whitespace-nowrap">Semana:</label>
            <select value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)} className="border-slate-300 rounded-md shadow-sm text-sm p-1.5 focus:border-blue-500 focus:ring-blue-500 bg-white">
              <option value="all">Todas as Semanas</option>
              {['01','02','03','04','05'].map(s => <option key={s} value={`semana${s}`}>Semana {parseInt(s)}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600 font-medium whitespace-nowrap">Setor:</label>
            <select 
              value={selectedSector} 
              onChange={(e) => setSelectedSector(e.target.value)} 
              className="border-slate-300 rounded-md shadow-sm text-sm p-1.5 focus:border-blue-500 focus:ring-blue-500 bg-white max-w-[200px]"
            >
              <option value="all">Todos os Setores</option>
              {uniqueSectors.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => {
              const prevDate = subMonths(new Date(), 1);
              closeMonthToHistory(prevDate.getMonth(), prevDate.getFullYear());
            }}
            disabled={isClosingMonth}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-md transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            <Archive size={14} />
            {isClosingMonth ? 'Fechando...' : 'Fechar Mês'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12 gap-3 md:gap-4 items-stretch">
        <div className="col-span-1 xl:col-span-1 h-full">
          <KPICard title="Projetos" value={uniqueProjects} icon={<Briefcase size={20} />} />
        </div>
        
        <div className="bg-white rounded-lg p-3 md:p-4 border border-slate-200 shadow-sm flex flex-col justify-between col-span-1 xl:col-span-1 h-full min-h-[90px] md:min-h-[100px]">
          <div className="flex items-center justify-between text-slate-500 pb-1 md:pb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Conclusão</span>
            <Target size={16} className="text-blue-500" />
          </div>
          <div>
            <div className="text-lg md:text-xl font-bold text-slate-800">{conclusaoGeral.toFixed(1)}%</div>
          </div>
        </div>

        <div className="col-span-2 md:col-span-2 xl:col-span-2 h-full">
          <KPICard 
            title={selectedMonth === 'all' ? "Produção Real (Total)" : `Produção (${currentMonthName})`} 
            value={formatBRL(breakdownTotals.displayProduction)} 
            subtitle={selectedWeek === 'all' ? `Acumulado no período` : `Semana ${selectedWeek.replace('semana0', '')}`} 
            icon={<Activity size={20} className="text-emerald-500"/>} 
          />
        </div>

        <div className="col-span-2 md:col-span-2 xl:col-span-2 h-full">
          <KPICard 
            title="Saldo a Produzir" 
            value={formatBRL(breakdownTotals.saldoProduzir)} 
            subtitle="Pendente na fábrica" 
            icon={<Box size={20} className="text-indigo-500" />} 
          />
        </div>

        <div className="col-span-1 md:col-span-2 xl:col-span-2 h-full">
          <KPICard 
            title={selectedMonth === 'all' ? "Orçado (Geral)" : `Orçado (${currentMonthName})`} 
            value={formatBRL(valorProjetadoMes)} 
            subtitle="Projetado p/ entrega" 
            icon={<Zap size={20} className="text-amber-500" />} 
          />
        </div>
        
        <div className="col-span-2 md:col-span-2 xl:col-span-2 h-full">
          <KPICard title={`Fechado (${prevMonthName})`} value={formatBRL(valueMesAnterior)} subtitle="Faturamento anterior" icon={<History size={20} className="text-slate-400" />} />
        </div>

        <div className="bg-white rounded-lg p-3 md:p-4 border border-slate-200 shadow-sm flex flex-col justify-between col-span-1 md:col-span-2 xl:col-span-1 h-full min-h-[90px] md:min-h-[100px]">
          <div className="flex items-center justify-between text-slate-500 pb-1 md:pb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">MoM</span>
            {breakdownTotals.displayProduction >= valueMesAnterior ? <TrendingUp size={16} className="text-emerald-500" /> : <TrendingDown size={16} className="text-red-600" />}
          </div>
          <div>
            <div className={`text-lg md:text-xl font-bold ${breakdownTotals.displayProduction >= valueMesAnterior ? 'text-emerald-600' : 'text-red-600'}`}>
              {valueMesAnterior > 0 ? (((breakdownTotals.displayProduction - valueMesAnterior) / valueMesAnterior) * 100).toFixed(0) : '100'}%
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-3 md:p-4 border border-slate-200 shadow-sm flex flex-col justify-between col-span-1 md:col-span-2 xl:col-span-1 h-full min-h-[90px] md:min-h-[100px]">
          <div className="flex items-center justify-between text-slate-500 pb-1 md:pb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Atingimento</span>
            <TrendingUp size={16} className={breakdownTotals.displayProduction >= monthlyGoal ? "text-emerald-500" : "text-amber-500"} />
          </div>
          <div>
            <div className={`text-lg md:text-xl font-bold ${breakdownTotals.displayProduction >= monthlyGoal ? 'text-emerald-600' : 'text-slate-800'}`}>
              {monthlyGoal > 0 ? ((breakdownTotals.displayProduction / monthlyGoal) * 100).toFixed(0) : 0}%
            </div>
            <div className="text-[9px] text-slate-400 font-medium mt-1">Em relação a meta</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm lg:col-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800 tracking-tight">Detalhamento Semanal ({currentMonthName})</h3>
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-2 flex flex-col items-end shadow-sm">
              <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest leading-tight mb-1">Meta do Mês</span>
              <span className="text-lg font-black text-indigo-700 leading-none">{formatBRL(monthlyGoal)}</span>
            </div>
          </div>
          <div className="flex-1 min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={weeklyChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} barGap={4}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 13}} />
                <YAxis hide tickFormatter={formatCompactBRL} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 13}} />
                <Tooltip content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const prodData = payload.find(p => p.dataKey === 'valor');
                    const metaData = payload.find(p => p.dataKey === 'meta');
                    // The raw entry carries fabrica/montagem from totalValueByWeek
                    const entry = payload[0]?.payload as any;
                    const fabrica = entry?.fabrica || 0;
                    const montagem = entry?.montagem || 0;
                    const total = Number(prodData?.value || 0);
                    return (
                      <div className="bg-white p-3 border border-slate-200 shadow-xl rounded-xl min-w-[210px]">
                        <p className="text-sm font-bold text-slate-800 mb-2">{label}</p>
                        <div className="space-y-1.5">
                          {prodData && (
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: prodData.color }} />
                                <p className="text-xs text-slate-500 font-medium">Total</p>
                              </div>
                              <p className="text-xs font-bold text-slate-900">{formatBRL(total)}</p>
                            </div>
                          )}
                          {fabrica > 0 && (
                            <div className="flex items-center justify-between gap-4 pl-3 border-l-2 border-blue-100">
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                <p className="text-xs text-slate-400 font-medium">Fábrica</p>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-bold text-blue-700">{formatBRL(fabrica)}</p>
                                {total > 0 && <span className="text-[10px] bg-blue-50 text-blue-600 px-1 rounded font-bold">{((fabrica/total)*100).toFixed(0)}%</span>}
                              </div>
                            </div>
                          )}
                          {montagem > 0 && (
                            <div className="flex items-center justify-between gap-4 pl-3 border-l-2 border-amber-100">
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-amber-400" />
                                <p className="text-xs text-slate-400 font-medium">Montagem</p>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-bold text-amber-700">{formatBRL(montagem)}</p>
                                {total > 0 && <span className="text-[10px] bg-amber-50 text-amber-600 px-1 rounded font-bold">{((montagem/total)*100).toFixed(0)}%</span>}
                              </div>
                            </div>
                          )}
                          {metaData && (
                            <div className="flex flex-col gap-1 pt-1 border-t border-slate-100 mt-1">
                              {payload[0].payload.metaOriginal !== undefined && Math.abs(payload[0].payload.metaOriginal - Number(metaData.value)) > 1 && (
                                <div className="flex items-center justify-between gap-4">
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-slate-100" />
                                    <p className="text-[10px] text-slate-400 font-medium whitespace-nowrap">Meta Original</p>
                                  </div>
                                  <p className="text-[10px] font-bold text-slate-400 line-through">{formatBRL(payload[0].payload.metaOriginal)}</p>
                                </div>
                              )}
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2 h-2 rounded-full bg-slate-300" />
                                  <p className="text-xs text-slate-500 font-bold whitespace-nowrap">Meta Atualizada</p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <p className="text-xs font-bold text-slate-600">{formatBRL(Number(metaData.value))}</p>
                                  {Number(metaData.value) > 0 && (() => {
                                    const pct = ((total - Number(metaData.value)) / Number(metaData.value)) * 100;
                                    const isAbove = pct >= 0;
                                    return (
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-black ${isAbove ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                                        {isAbove ? '+' : ''}{pct.toFixed(0)}%
                                      </span>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }} />
                <Bar dataKey="meta" radius={[4, 4, 0, 0]} fill="#e2e8f0" barSize={22}>
                  <LabelList dataKey="meta" position="top" formatter={formatBRL} fill="#94a3b8" fontSize={9} fontWeight="medium" />
                </Bar>
                <Bar dataKey="valor" radius={[4, 4, 0, 0]} barSize={22}>
                  {weeklyChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={TABLEAU10[index % TABLEAU10.length]} />)}
                  <LabelList dataKey="valor" position="top" formatter={formatBRL} fill="#0f172a" fontSize={10} fontWeight="bold" />
                </Bar>
                <Line type="monotone" dataKey="trend" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={false} animationDuration={1000} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
          <h3 className="text-lg font-bold text-slate-800 mb-4 tracking-tight">Status dos Projetos ({currentMonthName})</h3>
          <div className="overflow-y-auto pr-2 space-y-3" style={{ height: '280px' }}>
             {groupSummaries.map(proj => (
               <div key={proj.id} className="bg-white border border-slate-100 rounded-md p-3 hover:bg-slate-50 transition-colors">
                  <div className="flex justify-between items-center mb-2">
                     <span className="font-semibold text-sm truncate text-slate-800" title={proj.name}>{proj.name}</span>
                     <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${proj.avgPercent >= 90 ? 'bg-emerald-100 text-emerald-700' : proj.avgPercent < 50 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{proj.avgPercent.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2"><div className="bg-slate-800 h-1.5 rounded-full transition-all duration-500" style={{ width: `${Math.min(proj.avgPercent, 100)}%` }} /></div>
                  <div className="flex justify-between text-xs text-slate-500"><span>{proj.pendentes} pendentes</span><span className="font-medium text-slate-700">{formatCompactBRL(proj.oradoSum)} orçado</span></div>
               </div>
             ))}
          </div>
        </div>
      </div>

      {/* Breakdown: Produção vs Montagem */}
      {(weeklyBreakdown.length > 0 || breakdownTotals.total > 0) && (
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-slate-100 rounded-md">
                <Layout size={18} className="text-slate-600" />
              </div>
              <h3 className="text-base font-bold text-slate-800 tracking-tight">Produção vs Montagem ({currentMonthName})</h3>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block"/>Fábrica/Produção</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block"/>Montagem/Desmontagem</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Semana</th>
                  <th className="text-right py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Total</th>
                  <th className="text-right py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-blue-400">Fábrica (R$)</th>
                  <th className="text-right py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-blue-400">%</th>
                  <th className="text-right py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-amber-500">Montagem (R$)</th>
                  <th className="text-right py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-amber-500">%</th>
                </tr>
              </thead>
              <tbody>
                {weeklyBreakdown.map((row, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-700">{row.label}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-800">{formatBRL(row.total)}</td>
                    <td className="py-2.5 px-3 text-right text-blue-700 font-medium">{formatBRL(row.fabrica)}</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-bold text-[11px]">{row.pctFabrica.toFixed(0)}%</span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-amber-700 font-medium">{formatBRL(row.montagem)}</td>
                    <td className="py-2.5 px-3 text-right">
                      {row.montagem > 0 ? (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded font-bold text-[11px]">{row.pctMontagem.toFixed(0)}%</span>
                      ) : (
                        <span className="text-slate-300 text-[11px]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-800">
                  <td className="py-3 px-3 font-black text-white text-[11px] uppercase tracking-wider rounded-bl-lg">TOTAL</td>
                  <td className="py-3 px-3 text-right font-black text-white">{formatBRL(breakdownTotals.total)}</td>
                  <td className="py-3 px-3 text-right font-bold text-blue-200">{formatBRL(breakdownTotals.fabrica)}</td>
                  <td className="py-3 px-3 text-right">
                    <span className="px-2 py-0.5 bg-blue-700 text-white rounded font-black text-[11px]">{breakdownTotals.pctFabrica.toFixed(0)}%</span>
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-amber-200">{formatBRL(breakdownTotals.montagem)}</td>
                  <td className="py-3 px-3 text-right rounded-br-lg">
                    {breakdownTotals.montagem > 0 ? (
                      <span className="px-2 py-0.5 bg-amber-600 text-white rounded font-black text-[11px]">{breakdownTotals.pctMontagem.toFixed(0)}%</span>
                    ) : (
                      <span className="text-slate-500 text-[11px]">—</span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
         <div className="flex items-center justify-between mb-6">
           <div className="flex items-center gap-2">
             <div className="p-2 bg-slate-800 rounded-md text-white">
               <Activity size={20} />
             </div>
             <h3 className="text-xl font-bold text-slate-800 tracking-tight">Histórico de Produção Mensal</h3>
           </div>
           <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Ano: {new Date().getFullYear()}</span>
         </div>
         
         <div className="h-[350px] w-full">
           <ResponsiveContainer width="100%" height="100%">
             <ComposedChart data={historicalChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} barGap={6}>
               <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 13}} />
               <YAxis hide tickFormatter={formatCompactBRL} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 13}} />
               <Tooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload.find(p => p.dataKey === 'valor');
                      const meta = payload.find(p => p.dataKey === 'meta');
                      const entry = historicalChartData.find(d => d.name === label);
                      return (
                        <div className="bg-white p-3 border border-slate-100 shadow-xl rounded-xl">
                          <p className="text-sm font-bold text-slate-800 mb-2 truncate capitalize">{label}</p>
                          <div className="space-y-1.5">
                            {data && (
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-slate-800" />
                                <p className="text-sm text-slate-600 font-semibold whitespace-nowrap">
                                  Total: <span className="text-slate-900">{formatBRL(Number(data.value))}</span>
                                </p>
                              </div>
                            )}
                            {entry?.fabrica > 0 && (
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                                <p className="text-xs text-slate-500 whitespace-nowrap">
                                  Fábrica: <span className="font-bold text-blue-700">{formatBRL(entry.fabrica)}</span>
                                </p>
                              </div>
                            )}
                            {entry?.montagem > 0 && (
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                                <p className="text-xs text-slate-500 whitespace-nowrap">
                                  Montagem: <span className="font-bold text-amber-700">{formatBRL(entry.montagem)}</span>
                                </p>
                              </div>
                            )}
                            {meta && (
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-slate-200" />
                                <p className="text-sm text-slate-500 font-medium whitespace-nowrap">
                                  Meta: <span className="text-slate-900">{formatBRL(Number(meta.value))}</span>
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                  cursor={{fill: '#f1f5f9'}}
                />
               <Bar dataKey="meta" radius={[4, 4, 0, 0]} fill="#e2e8f0" barSize={30}>
                  <LabelList dataKey="meta" position="top" formatter={formatBRL} fill="#94a3b8" fontSize={9} fontWeight="medium" />
                </Bar>
               <Bar dataKey="valor" radius={[4, 4, 0, 0]} barSize={30}>
                  {historicalChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={TABLEAU10[index % TABLEAU10.length]} />
                  ))}
                  <LabelList dataKey="valor" position="top" formatter={formatBRL} fill="#334155" fontSize={11} fontWeight="bold" />
               </Bar>
               <Line
                  type="monotone"
                  dataKey="trend"
                  stroke="#ef4444"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  activeDot={false}
                  animationDuration={1500}
                />
             </ComposedChart>
           </ResponsiveContainer>
         </div>
      </div>
    </div>
  );
}

// Componente utilitário para KPIs simples
function KPICard({ title, value, subtitle, icon, isWarning = false }: any) {
  return (
    <div className={`bg-white rounded-lg p-4 border ${isWarning ? 'border-red-200 bg-red-50' : 'border-slate-200'} shadow-sm flex flex-col justify-between h-full min-h-[100px]`}>
      <div className="flex items-center justify-between text-slate-500 pb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate mr-2 flex-1">{title}</span>
        {icon}
      </div>
      <div>
        <div className={`text-xl font-bold truncate ${isWarning ? 'text-red-700' : 'text-slate-800'}`}>{value}</div>
        {subtitle && <div className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-tight truncate">{subtitle}</div>}
      </div>
    </div>
  );
}
