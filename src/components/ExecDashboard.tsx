import React, { useMemo, useState, useEffect } from 'react';
import { Board, Task } from '@/types/board';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, Cell,
  Line, ComposedChart, Area
} from 'recharts';
import { 
  TrendingUp, TrendingDown, CheckCircle, 
  Briefcase, Activity, Target, Zap, History, Layout
} from 'lucide-react';
import { format, isSameMonth, parseISO, startOfMonth, subMonths, getMonth, setMonth, getDaysInMonth, getYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
}

const TABLEAU10 = ['#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f', '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab'];

export default function ExecDashboard({ board }: ExecDashboardProps) {
  const [selectedWeek, setSelectedWeek] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(String(new Date().getMonth()));
  const [monthlyGoal, setMonthlyGoal] = useState<number>(300000);
  const [includeSaturdays, setIncludeSaturdays] = useState<boolean>(false);

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

  const normalizeSearch = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');

  const allItems = useMemo(() => {
    return board.groups.flatMap(g => g.tasks.map(t => {
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
      const mesAnterior = parseNum(val('mesAnterior', ['Mês anterior', 'Mês Anterior', 'Mês ant', 'Mes Anterior']));

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
        mesAnterior,
        dataEntrega,
        status: String(val('status', ['status'])) || 'default'
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

  // Carregar meta do storage quando o mês selecionado mudar
  useEffect(() => {
    if (selectedMonth === 'all') {
      setMonthlyGoal(0);
      setIncludeSaturdays(false);
      return;
    }
    
    // Tenta carregar do V2 (com escala de sábado)
    const savedV2 = localStorage.getItem('executive_monthly_goals_v2');
    if (savedV2) {
      const goals = JSON.parse(savedV2);
      const monthConfig = goals[parseInt(selectedMonth)];
      if (monthConfig) {
        setMonthlyGoal(monthConfig.value);
        setIncludeSaturdays(monthConfig.includeSaturdays);
        return;
      }
    }

    // Fallback para V1
    const savedV1 = localStorage.getItem('executive_monthly_goals');
    if (savedV1) {
      const goals = JSON.parse(savedV1);
      const monthGoal = goals[parseInt(selectedMonth)];
      if (monthGoal !== undefined) {
        setMonthlyGoal(monthGoal);
        setIncludeSaturdays(false);
      }
    }
  }, [selectedMonth]);

  const workItems = useMemo(() => {
    return allItems.filter(item => {
      const isHistoryItem = historyGroupId && item.groupId === historyGroupId;
      
      // Regra: Itens de Histórico só entram se o mês selecionado já foi concluído
      if (isHistoryItem && !isSelectedMonthPast && selectedMonth !== 'all') return false;
      
      if (!item.name && !item.subitemName) return false;
      if (selectedMonth === 'all') return true;
      
      // Regra da data de entrega (Somente mês selecionado)
      if (!item.dataEntrega) return false;
      return getMonth(item.dataEntrega) === parseInt(selectedMonth);
    });
  }, [allItems, selectedMonth, historyGroupId, isSelectedMonthPast]);

  const {
    uniqueProjects, totalValueByWeek, conclusaoGeral, valueMesAnterior, groupSummaries, historicalData, valorProjetadoMes
  } = useMemo(() => {
    // 0. Valor Projetado (Entrega no Mês)
    let valorProjetadoMes = 0;
    if (selectedMonth !== 'all') {
      const monthIdx = parseInt(selectedMonth);
      const groupsInMonth = new Set<string>();
      allItems.forEach(item => {
        const isHistory = historyGroupId && item.groupId === historyGroupId;
        if (isHistory && !isSelectedMonthPast) return;
        
        if (item.dataEntrega && getMonth(item.dataEntrega) === monthIdx) {
          groupsInMonth.add(item.groupId);
        }
      });
      groupsInMonth.forEach(id => {
        const g = board.groups.find(bg => bg.id === id);
        if (g) {
          const groupValue = g.budget || allItems.filter(i => i.groupId === id).reduce((s, t) => s + (t.orado || 0), 0);
          valorProjetadoMes += groupValue;
        }
      });
    }

    const activeItems = workItems.map(item => ({
      ...item,
      activePercentual: selectedWeek === 'all' ? item.percentual : (item[selectedWeek as keyof typeof item] as number || 0)
    }));

    const projSet = new Set(activeItems.map(i => i.groupId));
    const uniqueProjects = projSet.size;

    const percentSum = activeItems.reduce((acc, curr) => acc + curr.activePercentual, 0);
    const conclusaoGeral = activeItems.length > 0 ? percentSum / activeItems.length : 0;

    const semanas = ['semana01', 'semana02', 'semana03', 'semana04', 'semana05'] as const;
    const valueByWeek: Record<string, number> = { semana01: 0, semana02: 0, semana03: 0, semana04: 0, semana05: 0 };
    
    activeItems.forEach(item => {
      const isHistory = historyGroupId && item.groupId === historyGroupId;
      const budget = item.orado || 0;
      const statusNorm = normalizeSearch(item.status);
      const isConcluido = statusNorm.includes('concluido') || statusNorm.includes('feito') || statusNorm.includes('done') || statusNorm.includes('pago');

      const isCurrentRealMonth = item.dataEntrega && getMonth(item.dataEntrega) === now.getMonth();
      const shouldShowInWeekly = selectedMonth === 'all' ? isCurrentRealMonth : true;
      if (!shouldShowInWeekly) return;

      if (isHistory) {
        semanas.forEach(sem => valueByWeek[sem] += (item[sem] || 0));
      } else if (isConcluido) {
        const weeklyPctSum = (item.semana01 || 0) + (item.semana02 || 0) + (item.semana03 || 0) + (item.semana04 || 0) + (item.semana05 || 0);
        if (weeklyPctSum > 0) {
          semanas.forEach(sem => valueByWeek[sem] += ((item[sem] || 0) * budget) / 100);
        } else {
          const lastSem = item.semana05 ? 'semana05' : item.semana04 ? 'semana04' : item.semana03 ? 'semana03' : item.semana02 ? 'semana02' : 'semana01';
          valueByWeek[lastSem] += budget;
        }
      } else {
        semanas.forEach(sem => valueByWeek[sem] += ((item[sem] || 0) * budget) / 100);
      }
    });

    const totalValueByWeek = Object.entries(valueByWeek).map(([name, val]) => ({ name: name.replace('semana0', 'Semana '), key: name, valor: val }));

    let valueMesAnterior = 0;
    const prevMonthIdx = selectedMonth === 'all' ? -1 : (parseInt(selectedMonth) - 1 + 12) % 12;
    if (prevMonthIdx !== -1) {
      allItems.forEach(item => {
        if (item.dataEntrega && getMonth(item.dataEntrega) === prevMonthIdx) {
          const isConcluido = normalizeSearch(item.status).includes('concluido');
          if (isConcluido) valueMesAnterior += item.orado || 0;
          else {
            const weeklySum = (item.semana01 || 0) + (item.semana02 || 0) + (item.semana03 || 0) + (item.semana04 || 0) + (item.semana05 || 0);
            valueMesAnterior += (weeklySum * (item.orado || 0)) / 100;
          }
        }
      });
    }

    const gs: Record<string, any> = {};
    activeItems.forEach(i => {
      if (!gs[i.groupId]) gs[i.groupId] = { id: i.groupId, name: i.groupName, percentSum: 0, oradoSum: 0, count: 0, pendentes: 0 };
      gs[i.groupId].percentSum += i.activePercentual;
      gs[i.groupId].oradoSum += i.orado || 0;
      gs[i.groupId].count += 1;
      if (i.activePercentual < 100) gs[i.groupId].pendentes += 1;
    });
    const groupSummaries = Object.values(gs).map(g => ({ ...g, avgPercent: g.count > 0 ? g.percentSum / g.count : 0 })).sort((a, b) => b.oradoSum - a.oradoSum);

    const historicalData: any[] = [];
    if (historyGroup) {
      const monthlyTotals: Record<number, number> = {};
      allItems.forEach(item => {
        if (item.groupId === historyGroup.id && item.dataEntrega) {
          const m = getMonth(item.dataEntrega);
          const weeklySumValue = (item.semana01 || 0) + (item.semana02 || 0) + (item.semana03 || 0) + (item.semana04 || 0) + (item.semana05 || 0);
          monthlyTotals[m] = (monthlyTotals[m] || 0) + (weeklySumValue || item.orado || 0);
        }
      });
      
      const savedGoals = localStorage.getItem('executive_monthly_goals_v2');
      const monthlyGoals = savedGoals ? JSON.parse(savedGoals) : {};

      historicalData.push(...Array.from({ length: 12 }).map((_, i) => {
        const goal = monthlyGoals[i]?.value || 0;
        const total = monthlyTotals[i] || 0;
        return { 
          name: format(setMonth(new Date(), i), 'MMM', { locale: ptBR }), 
          valor: total,
          meta: goal,
          isCurrent: i === now.getMonth()
        };
      }).filter(h => h.valor > 0 || h.meta > 0 || h.isCurrent));
    }

    return { uniqueProjects, totalValueByWeek, conclusaoGeral, valueMesAnterior, groupSummaries, historicalData, valorProjetadoMes };
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
    const isMonthFuture = (getYear(displayMonthDate) > getYear(now)) || (getYear(displayMonthDate) === getYear(now) && getMonth(displayMonthDate) > getMonth(now));
    const isCurrentMonth = !isMonthPast && !isMonthFuture && getMonth(displayMonthDate) === getMonth(now);

    if (isCurrentMonth) {
      // Lógica de Redistribuição (somente mês ativo)
      for (let i = 0; i < 5; i++) {
        const d = weekWorkingDays[i];
        if (d <= 0) continue;
        const isWeekFinished = now.getDate() > (weekEndDates[i] || 99);
        if (isWeekFinished) {
          const actualProd = productionByWeek[i] || 0;
          metas[i] = actualProd;
          currentRemainingGoal -= actualProd;
          currentRemainingDays -= d;
        }
      }
      // Distribuir o que sobrou
      const goalToDistribute = Math.max(0, currentRemainingGoal);
      const daysToDistribute = currentRemainingDays;
      for (let i = 0; i < 5; i++) {
        const d = weekWorkingDays[i];
        if (d <= 0) continue;
        const isWeekFinished = now.getDate() > (weekEndDates[i] || 99);
        if (!isWeekFinished) {
          metas[i] = daysToDistribute > 0 ? (goalToDistribute * (d / daysToDistribute)) : 0;
        }
      }
    } else {
      // Lógica Estática (Proporcional) para meses passados ou futuros
      for (let i = 0; i < 5; i++) {
        const d = weekWorkingDays[i];
        if (d > 0 && totalWorkingDays > 0) {
          metas[i] = (monthlyGoal * d) / totalWorkingDays;
        }
      }
    }

    const finalData = totalValueByWeek
      .map((d, i) => {
        const d_meta = metas[i] || 0;
        const d_hasDays = weekWorkingDays[i] > 0;
        return { ...d, meta: d_meta, hasDays: d_hasDays };
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
    <div className="p-6 bg-[#f5f6f8] min-h-full space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Desempenho Oficial</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600 font-medium whitespace-nowrap">Mês:</label>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="border-slate-300 rounded-md shadow-sm text-sm p-1.5 focus:border-blue-500 focus:ring-blue-500 bg-white">
              <option value="all">Todos os Meses</option>
              {Array.from({ length: 12 }).map((_, i) => <option key={i} value={i}>{format(setMonth(new Date(), i), 'MMMM', { locale: ptBR })}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600 font-medium whitespace-nowrap">Semana:</label>
            <select value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)} className="border-slate-300 rounded-md shadow-sm text-sm p-1.5 focus:border-blue-500 focus:ring-blue-500 bg-white">
              <option value="all">Todas as Semanas</option>
              {['01','02','03','04','05'].map(s => <option key={s} value={`semana${s}`}>Semana {parseInt(s)}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Grid de KPIs - Altura Padronizada */}
      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12 gap-4 items-stretch">
        <div className="xl:col-span-1 h-full">
          <KPICard title="Projetos" value={uniqueProjects} icon={<Briefcase size={20} />} />
        </div>
        
        <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm flex flex-col justify-between xl:col-span-1 h-full min-h-[100px]">
          <div className="flex items-center justify-between text-slate-500 pb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Conclusão</span>
            <Target size={16} className="text-blue-500" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-800">{conclusaoGeral.toFixed(1)}%</div>
          </div>
        </div>

        <div className="xl:col-span-2 h-full">
          <KPICard title={`Produção (${currentMonthName})`} value={formatBRL(totalFilteredValue)} subtitle={selectedWeek === 'all' ? `Total acumulado` : `Semana ${selectedWeek.replace('semana0', '')}`} icon={<Activity size={20} className="text-emerald-500"/>} />
        </div>
        
        <div className="xl:col-span-2 h-full">
          <KPICard title={`Planejado (${currentMonthName})`} value={formatBRL(monthlyGoal)} subtitle="Meta estratégica" icon={<Target size={20} className="text-indigo-500" />} />
        </div>

        <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm flex flex-col justify-between xl:col-span-1 h-full min-h-[100px]">
          <div className="flex items-center justify-between text-slate-500 pb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Atingimento</span>
            <TrendingUp size={16} className={totalFilteredValue >= monthlyGoal ? "text-emerald-500" : "text-amber-500"} />
          </div>
          <div>
            <div className={`text-xl font-bold ${totalFilteredValue >= monthlyGoal ? 'text-emerald-600' : 'text-slate-800'}`}>
              {monthlyGoal > 0 ? ((totalFilteredValue / monthlyGoal) * 100).toFixed(0) : 0}%
            </div>
          </div>
        </div>

        <div className="xl:col-span-2 h-full">
          <KPICard title={`Orçado (${currentMonthName})`} value={formatBRL(valorProjetadoMes)} subtitle="Projetado p/ entrega" icon={<Zap size={20} className="text-amber-500" />} />
        </div>
        
        <div className="xl:col-span-2 h-full">
          <KPICard title={`Fechado (${prevMonthName})`} value={formatBRL(valueMesAnterior)} subtitle="Faturamento anterior" icon={<History size={20} className="text-slate-400" />} />
        </div>

        <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm flex flex-col justify-between xl:col-span-1 h-full min-h-[100px]">
          <div className="flex items-center justify-between text-slate-500 pb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">MoM</span>
            {totalFilteredValue >= valueMesAnterior ? <TrendingUp size={16} className="text-emerald-500" /> : <TrendingDown size={16} className="text-red-600" />}
          </div>
          <div>
            <div className={`text-xl font-bold ${totalFilteredValue >= valueMesAnterior ? 'text-emerald-600' : 'text-red-600'}`}>
              {valueMesAnterior > 0 ? (((totalFilteredValue - valueMesAnterior) / valueMesAnterior) * 100).toFixed(0) : '100'}%
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm lg:col-span-2 flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-4 tracking-tight">Detalhamento Semanal ({currentMonthName})</h3>
          <div className="flex-1 min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={weeklyChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} barGap={4}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 13}} />
                <YAxis tickFormatter={formatCompactBRL} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 13}} />
                <Tooltip content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const prodData = payload.find(p => p.dataKey === 'valor');
                    const metaData = payload.find(p => p.dataKey === 'meta');
                    return (
                      <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg">
                        <p className="text-sm font-bold text-slate-800 mb-1">{label}</p>
                        <div className="space-y-1">
                          {prodData && <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: prodData.color }} /><p className="text-sm text-slate-600 font-medium">Produzido: <span className="text-slate-900">{formatBRL(Number(prodData.value))}</span></p></div>}
                          {metaData && <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-slate-200" /><p className="text-sm text-slate-500 font-medium">Meta: <span className="text-slate-900">{formatBRL(Number(metaData.value))}</span></p></div>}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }} />
                <Bar dataKey="meta" radius={[4, 4, 0, 0]} fill="#e2e8f0" barSize={22} />
                <Bar dataKey="valor" radius={[4, 4, 0, 0]} barSize={22}>
                  {weeklyChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={TABLEAU10[index % TABLEAU10.length]} />)}
                  <LabelList dataKey="valor" position="top" formatter={formatCompactBRL} fill="#0f172a" fontSize={11} fontWeight="bold" />
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
           {historicalChartData.length > 0 ? (
             <ResponsiveContainer width="100%" height="100%">
               <ComposedChart data={historicalChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} barGap={6}>
                 <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 13}} />
                 <YAxis tickFormatter={formatCompactBRL} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 13}} />
                 <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload.find(p => p.dataKey === 'valor');
                        const meta = payload.find(p => p.dataKey === 'meta');
                        return (
                          <div className="bg-white p-3 border border-slate-100 shadow-xl rounded-xl">
                            <p className="text-sm font-bold text-slate-800 mb-2 truncate">{label}</p>
                            <div className="space-y-1.5">
                              {data && (
                                <div className="flex items-center gap-2">
                                  <div className="w-2.5 h-2.5 rounded-full bg-slate-800" />
                                  <p className="text-sm text-slate-600 font-semibold whitespace-nowrap">
                                    Produzido: <span className="text-slate-900">{formatBRL(Number(data.value))}</span>
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
                 <Bar dataKey="meta" radius={[4, 4, 0, 0]} fill="#e2e8f0" barSize={30} />
                 <Bar dataKey="valor" radius={[4, 4, 0, 0]} barSize={30}>
                    {historicalChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={TABLEAU10[index % TABLEAU10.length]} />
                    ))}
                    <LabelList dataKey="valor" position="top" formatter={formatCompactBRL} fill="#334155" fontSize={12} fontWeight="bold" />
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
           ) : (
             <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3 border-2 border-dashed border-slate-100 rounded-xl">
                <History size={48} className="opacity-20" />
                <div className="text-center font-medium">
                  <p>Nenhum dado histórico encontrado.</p>
                  <p className="text-xs font-normal opacity-60">Utilize o grupo "Histórico de Desempenho" para popular este gráfico.</p>
                </div>
             </div>
           )}
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
