import React, { useMemo, useState } from 'react';
import { Board, Task } from '@/types/board';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, Cell,
  Line, ComposedChart, Area
} from 'recharts';
import { 
  TrendingUp, TrendingDown, CheckCircle, 
  Briefcase, Activity, Target, Zap, History, Layout
} from 'lucide-react';
import { format, isSameMonth, parseISO, startOfMonth, subMonths, getMonth, setMonth } from 'date-fns';
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

  // Mapeamento extraindo os dados de acordo com a regra orientada
  const allItems = useMemo(() => {
    return board.groups.flatMap(g => g.tasks.map(t => {
      // Normalização de string para matching tolerante a acentos e caracteres especiais
      const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');

      // Usar a lógica robusta de extração, tolerando chaves diretas ou mapeamento pelo título da coluna
      const val = (key: string, alternatives: string[]) => {
        if (t.columnValues[key] !== undefined) return t.columnValues[key];
        const allAlts = [key, ...alternatives];
        for (const alt of allAlts) {
          const normAlt = normalize(alt);
          const col = board.columns.find(c => normalize(c.title) === normAlt);
          if (col && t.columnValues[col.id] !== undefined) return t.columnValues[col.id];
          if (t.columnValues[alt] !== undefined) return t.columnValues[alt];
        }
        return '';
      };

      // Parser robusto para números, lidando com formatos brasileiros R$ 1.000,00 etc
      const parseNum = (v: any): number => {
        if (v === undefined || v === null || v === '') return 0;
        if (typeof v === 'number') return v;
        const s = String(v).replace('R$', '').replace('$', '').replace('%', '').trim();
        // Se houver vírgula e ponto, assumimos BR 1.000,00 -> 1000.00
        // Se houver apenas ponto (ex: 1.000.000), tratamos como separador de milhar brasileiro
        let cleaned = s;
        if (s.includes(',') && s.includes('.')) {
          cleaned = s.replace(/\./g, '').replace(',', '.');
        } else if (s.includes(',')) {
          cleaned = s.replace(',', '.');
        } else if (s.includes('.') && s.length - s.lastIndexOf('.') > 3) {
          // Ex: 1.000.000 -> 1000000
          cleaned = s.replace(/\./g, '');
        }
        return parseFloat(cleaned) || 0;
      };
      
      const percentual = parseNum(val('percentual', ['conclusao', '%', 'progress', 'progresso']));
      const orado = parseNum(val('orado', ['orcado', 'budget', 'orçamento', 'orcamento', 'valor']));
      const semana01 = parseNum(val('semana01', ['sem01', 's1', 'semana 01']));
      const semana02 = parseNum(val('semana02', ['sem02', 's2', 'semana 02']));
      const semana03 = parseNum(val('semana03', ['sem03', 's3', 'semana 03']));
      const semana04 = parseNum(val('semana04', ['sem04', 's4', 'semana 04']));
      const semana05 = parseNum(val('semana05', ['sem05', 's5', 'semana 05']));
      const mesAnterior = parseNum(val('mesAnterior', ['Mês anterior', 'Mês Anterior', 'Mês ant', 'Mes Anterior']));

      const dataEntregaRaw = val('dataEntrega', ['entrega', 'data de entrega', 'prazo', 'delivery']);
      let dataEntrega: Date | null = null;
      if (dataEntregaRaw) {
        try { 
          // Suporte a ISO ou datas BR simplificadas
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

  const now = new Date();
  
  // Nomes dinâmicos baseados no mês selecionado
  const displayMonthDate = selectedMonth === 'all' ? now : setMonth(now, parseInt(selectedMonth));
  const currentMonthName = format(displayMonthDate, 'MMMM', { locale: ptBR });
  const prevMonthName = format(subMonths(displayMonthDate, 1), 'MMMM', { locale: ptBR });

  const workItems = useMemo(() => {
    return allItems.filter(item => {
      if (!item.name && !item.subitemName) return false;
      // Regra: Projetos com Entrega no mês selecionado (se não for "todos")
      if (!item.dataEntrega) return false;
      if (selectedMonth === 'all') return true;
      return getMonth(item.dataEntrega) === parseInt(selectedMonth);
    });
  }, [allItems, selectedMonth]);

  const {
    uniqueProjects,
    totalValueByWeek,
    conclusaoGeral,
    valueMesAnterior,
    groupSummaries,
    historicalData,
    historyGroupId
  } = useMemo(() => {
    
    const historicalData: any[] = [];
    const normalizeSearch = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');

    // 0. Active Items for Percentage filtering
    const activeItems = workItems.map(item => ({
      ...item,
      activePercentual: selectedWeek === 'all' ? item.percentual : (item[selectedWeek as keyof typeof item] as number || 0)
    }));

    // 1. Projetos Únicos
    const projSet = new Set<string>();
    activeItems.forEach(i => projSet.add(i.groupId));
    const uniqueProjects = projSet.size;

    const historyGroup = board.groups.find(g => normalizeSearch(g.title).includes('historico'));
    const historyGroupId = historyGroup?.id;

    // 2. Conclusão Geral
    const percentSum = activeItems.reduce((acc, curr) => acc + curr.activePercentual, 0);
    const conclusaoGeral = activeItems.length > 0 ? percentSum / activeItems.length : 0;

    // 3. Total/Budget por Semana
    const semanas = ['semana01', 'semana02', 'semana03', 'semana04', 'semana05'] as const;
    const valueByWeek: Record<string, number> = {
      semana01: 0, semana02: 0, semana03: 0, semana04: 0, semana05: 0
    };
    
    activeItems.forEach(item => {
      const isFromHistory = historyGroupId && item.groupId === historyGroupId;
      const budget = item.orado || 0;
      const statusNorm = normalizeSearch(item.status);
      const isConcluido = statusNorm.includes('concluido') || statusNorm.includes('feito') || statusNorm.includes('done') || statusNorm.includes('pago');

      // Regra de Filtro de Exibição: Se o filtro global for "Todos os Meses",
      // mostramos no Detalhamento Semanal apenas o que pertence ao mês REAL atual
      // para evitar conflito de semanas entre meses diferentes.
      const isCurrentRealMonth = getMonth(item.dataEntrega!) === now.getMonth();
      const shouldShowInWeekly = selectedMonth === 'all' ? isCurrentRealMonth : true;

      if (!shouldShowInWeekly) return;

      if (isFromHistory) {
        if (!isConcluido) return;
        semanas.forEach(semana => {
          valueByWeek[semana] += item[semana] || 0;
        });
      } else if (isConcluido) {
        // Regra Concluido: Se houver detalhamento de semanas preenchido, respeitamos ele.
        // Se estiver vazio, jogamos o total na última semana.
        const weeklyPctSum = (item.semana01 || 0) + (item.semana02 || 0) + (item.semana03 || 0) + (item.semana04 || 0) + (item.semana05 || 0);
        
        if (weeklyPctSum > 0) {
          semanas.forEach(semana => {
            const weekPercent = item[semana] || 0;
            valueByWeek[semana] += (weekPercent * budget) / 100;
          });
        } else {
          const lastSem = item.semana05 ? 'semana05' : item.semana04 ? 'semana04' : item.semana03 ? 'semana03' : item.semana02 ? 'semana02' : 'semana01';
          valueByWeek[lastSem] += budget;
        }
      } else {
        semanas.forEach(semana => {
          const weekPercent = item[semana] || 0;
          if (weekPercent > 0 && budget > 0) {
            valueByWeek[semana] += (weekPercent * budget) / 100;
          }
        });
      }
    });

    const totalValueByWeek = Object.entries(valueByWeek).map(([name, val]) => ({
      name: name.replace('semana0', 'Semana '),
      key: name,
      valor: val
    }));

    // 3.5 Mês Anterior
    const prevMonthIdx = selectedMonth === 'all' ? -1 : (parseInt(selectedMonth) - 1 + 12) % 12;
    let valueMesAnterior = 0;
    
    if (prevMonthIdx !== -1) {
      allItems.forEach(item => {
        if (item.dataEntrega && getMonth(item.dataEntrega) === prevMonthIdx) {
          const statusNorm = normalizeSearch(item.status);
          const isConcluido = statusNorm.includes('concluido') || statusNorm.includes('feito') || statusNorm.includes('done') || statusNorm.includes('pago');
          
          if (isConcluido) {
            valueMesAnterior += item.orado || 0;
          } else {
            const totalWeeksPercent = (item.semana01 || 0) + (item.semana02 || 0) + (item.semana03 || 0) + (item.semana04 || 0) + (item.semana05 || 0);
            const budget = item.orado || 0;
            if (totalWeeksPercent > 0 && budget > 0) {
              valueMesAnterior += (totalWeeksPercent * budget) / 100;
            }
          }
        }
      });
    }

    if (valueMesAnterior === 0) {
      activeItems.forEach(item => {
        const p = item.mesAnterior || 0;
        const b = item.orado || 0;
        if (p > 0 && b > 0) valueMesAnterior += (p * b) / 100;
      });
    }

    // 4. Group Summaries
    const gs: Record<string, any> = {};
    activeItems.forEach(i => {
      if (!gs[i.groupId]) gs[i.groupId] = { id: i.groupId, name: i.groupName, percentSum: 0, oradoSum: 0, count: 0, pendentes: 0 };
      gs[i.groupId].percentSum += i.activePercentual;
      gs[i.groupId].oradoSum += i.orado;
      gs[i.groupId].count += 1;
      if (i.activePercentual < 100) gs[i.groupId].pendentes += 1;
    });

    const groupSummaries = Object.values(gs).map(g => {
      const avgPercent = g.count > 0 ? g.percentSum / g.count : 0;
      return { ...g, avgPercent };
    }).sort((a, b) => {
      if (a.id === historyGroupId) return -1;
      if (b.id === historyGroupId) return 1;
      return b.oradoSum - a.oradoSum;
    });
    
    if (historyGroup) {
      const monthlyTotals: Record<number, number> = {};
      allItems.forEach(item => {
        if (item.groupId === historyGroup.id && item.dataEntrega) {
          const m = getMonth(item.dataEntrega);
          const statusNorm = normalizeSearch(item.status);
          const isConcluido = statusNorm.includes('concluido') || statusNorm.includes('feito') || statusNorm.includes('done') || statusNorm.includes('pago');
          
          // No histórico, priorizamos a soma direta das semanas. Se vazio e estiver concluído, fallback para Orçado.
          const weeklySum = (item.semana01 || 0) + (item.semana02 || 0) + (item.semana03 || 0) + (item.semana04 || 0) + (item.semana05 || 0);
          
          let value = 0;
          if (weeklySum > 0) {
            value = weeklySum;
          } else if (isConcluido) {
            value = item.orado || 0;
          }
            
          monthlyTotals[m] = (monthlyTotals[m] || 0) + value;
        }
      });

      const months = Array.from({ length: 12 }).map((_, i) => ({
        name: format(setMonth(new Date(), i), 'MMM', { locale: ptBR }),
        valor: monthlyTotals[i] || 0
      })).filter(h => h.valor > 0);
      historicalData.push(...months);
    }

    return {
      uniqueProjects, totalValueByWeek, conclusaoGeral, valueMesAnterior, groupSummaries, historicalData, historyGroupId
    };
  }, [workItems, selectedWeek]);

  const filteredChartData = useMemo(() => {
    const raw = selectedWeek === 'all' 
      ? totalValueByWeek 
      : totalValueByWeek.filter(tw => tw.key === selectedWeek);
    return calculateTrend(raw, 'valor');
  }, [totalValueByWeek, selectedWeek]);

  const historicalChartData = useMemo(() => {
    return calculateTrend(historicalData, 'valor');
  }, [historicalData]);

  const totalFilteredValue = filteredChartData.reduce((acc, curr) => acc + curr.valor, 0);

  const comparativo = valueMesAnterior > 0 
    ? ((totalFilteredValue - valueMesAnterior) / Math.abs(valueMesAnterior)) * 100 
    : 0;

  const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const formatCompactBRL = (val: number) => {
    if (val >= 1000000) return `R$ ${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `R$ ${(val / 1000).toFixed(1)}K`;
    return `R$ ${val.toFixed(0)}`;
  };

  return (
    <div className="p-6 bg-[#f5f6f8] min-h-full space-y-6">
      {/* Header e Filtros */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Desempenho Oficial</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600 font-medium whitespace-nowrap">Mês:</label>
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
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
            <select 
              value={selectedWeek} 
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="border-slate-300 rounded-md shadow-sm text-sm p-1.5 focus:border-blue-500 focus:ring-blue-500 bg-white"
            >
              <option value="all">Todas as Semanas</option>
              <option value="semana01">Semana 1</option>
              <option value="semana02">Semana 2</option>
              <option value="semana03">Semana 3</option>
              <option value="semana04">Semana 4</option>
              <option value="semana05">Semana 5</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard title="Projetos Ativos" value={uniqueProjects} icon={<Briefcase size={20} />} />
        
        <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Conclusão Geral</span>
            <Target size={20} className="text-blue-500" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">{conclusaoGeral.toFixed(1)}%</div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
              <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(conclusaoGeral, 100)}%` }} />
            </div>
          </div>
        </div>

        <KPICard 
          title={`Valor em ${currentMonthName}`} 
          value={formatBRL(totalFilteredValue)} 
          subtitle={selectedWeek === 'all' ? `Total 5 Semanas (${currentMonthName})` : `Referente à ${selectedWeek.replace('semana0', 'Semana ')}`}
          icon={<Activity size={20} className="text-emerald-500"/>} 
        />
        
        <KPICard 
          title={`Produzido em ${prevMonthName}`} 
          value={formatBRL(valueMesAnterior)} 
          subtitle={`Histórico de ${prevMonthName}`}
          icon={<History size={20} className="text-slate-500" />} 
        />

        <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Comparativo Mês</span>
            <Zap size={20} className="text-amber-500" />
          </div>
          <div className="flex items-end gap-2">
            <div className={`text-2xl font-bold ${comparativo >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {comparativo > 0 ? '+' : ''}{comparativo.toFixed(1)}%
            </div>
          </div>
          <div className="text-xs text-slate-400 mt-1 flex items-center">
             {comparativo >= 0 ? <TrendingUp size={12} className="text-emerald-500 mr-1"/> : <TrendingDown size={12} className="text-red-500 mr-1"/>}
             vs Mês Anterior
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de Valor Produzido (Principal) */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm lg:col-span-2 flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-4 tracking-tight">Detalhamento Semanal ({currentMonthName})</h3>
          <div className="flex-1 min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={filteredChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 13}} />
                <YAxis tickFormatter={formatCompactBRL} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 13}} />
                <Tooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload.find(p => p.dataKey === 'valor');
                      if (!data) return null;
                      return (
                        <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg">
                          <p className="text-sm font-bold text-slate-800 mb-1">{label}</p>
                          <div className="flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-slate-800" />
                             <p className="text-sm text-slate-600 font-medium">
                               Produzido: <span className="text-slate-900">{formatBRL(Number(data.value))}</span>
                             </p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="valor" radius={[4, 4, 0, 0]} maxBarSize={60}>
                  {filteredChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={TABLEAU10[index % TABLEAU10.length]} />
                  ))}
                  <LabelList dataKey="valor" position="top" formatter={formatCompactBRL} fill="#0f172a" fontSize={11} fontWeight="bold" />
                </Bar>
                <Line
                  type="linear"
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

        {/* Resumo de Projetos */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
          <h3 className="text-lg font-bold text-slate-800 mb-4 tracking-tight">Status dos Projetos ({currentMonthName})</h3>
          <div className="overflow-y-auto pr-2 space-y-3" style={{ height: '280px' }}>
             {groupSummaries.map(proj => {
               const isHistory = proj.id === historyGroupId;
               return (
                 <div key={proj.id} className={`border rounded-md p-3 transition-colors ${isHistory ? 'bg-slate-900 border-slate-800 text-white shadow-md' : 'bg-white border-slate-100 text-slate-800 hover:bg-slate-50'}`}>
                    <div className="flex justify-between items-center mb-2">
                       <span className={`font-semibold text-sm truncate ${isHistory ? 'text-white' : 'text-slate-800'}`} title={proj.name}>{proj.name}</span>
                       <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${isHistory ? 'bg-amber-500 text-amber-950' : proj.avgPercent >= 90 ? 'bg-emerald-100 text-emerald-700' : proj.avgPercent < 50 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                         {proj.avgPercent.toFixed(0)}%
                       </span>
                    </div>
                    <div className={`w-full rounded-full h-1.5 mb-2 ${isHistory ? 'bg-slate-700' : 'bg-slate-100'}`}>
                      <div className={`${isHistory ? 'bg-amber-500' : 'bg-slate-800'} h-1.5 rounded-full transition-all duration-500`} style={{ width: `${Math.min(proj.avgPercent, 100)}%` }} />
                    </div>
                    <div className={`flex justify-between text-xs ${isHistory ? 'text-slate-400' : 'text-slate-500'}`}>
                      <span>{proj.pendentes} pendentes</span>
                      <span className={`font-medium ${isHistory ? 'text-slate-200' : 'text-slate-700'}`}>{formatCompactBRL(proj.oradoSum)} orçado</span>
                    </div>
                 </div>
               );
             })}
          </div>
        </div>
      </div>

      {/* Gráfico de Evolução Histórica (Posição Final) */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
         <div className="flex items-center justify-between mb-6">
           <div className="flex items-center gap-2">
             <div className="p-2 bg-slate-800 rounded-md text-white">
               <Activity size={20} />
             </div>
             <h3 className="text-xl font-bold text-slate-800 tracking-tight">Faturamento e Produção Mensal (Histórico)</h3>
           </div>
           <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Ano: {new Date().getFullYear()}</span>
         </div>
         
         <div className="h-[350px] w-full">
           {historicalChartData.length > 0 ? (
             <ResponsiveContainer width="100%" height="100%">
               <ComposedChart data={historicalChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                 <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 13}} />
                 <YAxis tickFormatter={formatCompactBRL} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 13}} />
                 <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload.find(p => p.dataKey === 'valor');
                        if (!data) return null;
                        return (
                          <div className="bg-white p-3 border border-slate-100 shadow-xl rounded-xl">
                            <p className="text-sm font-bold text-slate-800 mb-2 truncate">{label}</p>
                            <div className="flex items-center gap-2">
                               <div className="w-2.5 h-2.5 rounded-full bg-slate-800" />
                               <p className="text-sm text-slate-600 font-semibold whitespace-nowrap">
                                 Faturamento: <span className="text-slate-900">{formatBRL(Number(data.value))}</span>
                               </p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                    cursor={{fill: '#f1f5f9'}}
                  />
                 <Bar dataKey="valor" radius={[6, 6, 0, 0]} maxBarSize={100} fill="#0f172a">
                    {historicalChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={TABLEAU10[index % TABLEAU10.length]} />
                    ))}
                    <LabelList dataKey="valor" position="top" formatter={formatCompactBRL} fill="#334155" fontSize={12} fontWeight="bold" />
                 </Bar>
                 <Line
                    type="linear"
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
    <div className={`bg-white rounded-lg p-4 border ${isWarning ? 'border-red-200 bg-red-50' : 'border-slate-200'} shadow-sm flex flex-col justify-between`}>
      <div className="flex items-center justify-between text-slate-500 pb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 truncate mr-2 flex-1">{title}</span>
        {icon}
      </div>
      <div>
        <div className={`text-2xl font-bold truncate ${isWarning ? 'text-red-700' : 'text-slate-800'}`}>{value}</div>
        {subtitle && <div className="text-xs text-slate-400 mt-1 truncate">{subtitle}</div>}
      </div>
    </div>
  );
}
