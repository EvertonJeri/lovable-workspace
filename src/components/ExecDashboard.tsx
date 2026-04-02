import React, { useMemo, useState } from 'react';
import { Board, Task } from '@/types/board';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, Cell
} from 'recharts';
import { 
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle, 
  Briefcase, Activity, Target, Zap
} from 'lucide-react';

interface ExecDashboardProps {
  board: Board;
}

const TABLEAU10 = ['#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f', '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab'];
const SET2 = ['#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854', '#ffd92f', '#e5c494', '#b3b3b3'];

export default function ExecDashboard({ board }: ExecDashboardProps) {
  const [selectedWeek, setSelectedWeek] = useState<string>('all');

  // Mapeamento extraindo os dados de acordo com a regra orientada
  const allItems = useMemo(() => {
    return board.groups.flatMap(g => g.tasks.map(t => {
      // Usar a lógica robusta de extração, tolerando chaves diretas ou mapeamento pelo título da coluna
      const val = (key: string, alternatives: string[]) => {
        if (t.columnValues[key] !== undefined) return t.columnValues[key];
        for (const alt of alternatives) {
          const col = board.columns.find(c => c.title.toLowerCase().replace(/[^a-z0-9]/g, '') === alt.toLowerCase().replace(/[^a-z0-9]/g, ''));
          if (col && t.columnValues[col.id] !== undefined) return t.columnValues[col.id];
          if (t.columnValues[alt] !== undefined) return t.columnValues[alt];
        }
        return '';
      };
      
      const percentual = parseFloat(val('percentual', ['conclusao', '%'])) || 0;
      const orado = parseFloat(val('orado', ['orcado', 'budget'])) || 0;
      const semana01 = parseFloat(val('semana01', ['sem01', 's1'])) || 0;
      const semana02 = parseFloat(val('semana02', ['sem02', 's2'])) || 0;
      const semana03 = parseFloat(val('semana03', ['sem03', 's3'])) || 0;
      const semana04 = parseFloat(val('semana04', ['sem04', 's4'])) || 0;
      const semana05 = parseFloat(val('semana05', ['sem05', 's5'])) || 0;

      return {
        id: t.id,
        name: t.name,
        groupName: g.title,
        groupId: g.id,
        subitemName: String(val('subitemName', ['setor', 'subitem'])) || '',
        percentual,
        orado,
        semana01,
        semana02,
        semana03,
        semana04,
        semana05,
        status: String(val('status', [])) || 'default'
      };
    }));
  }, [board]);

  const workItems = useMemo(() => {
    return allItems.filter(item => item.subitemName && item.subitemName.trim() !== '');
  }, [allItems]);

  const {
    uniqueProjects,
    totalValueByWeek,
    conclusaoGeral,
    projetosEmRisco,
    topPerformer,
    velocidadeSemanal,
    groupSummaries,
    setorRanking,
    criticalItems
  } = useMemo(() => {
    
    // 1. Projetos Únicos
    const projSet = new Set<string>();
    workItems.forEach(i => projSet.add(i.groupId));
    const uniqueProjects = projSet.size;

    // 2. Conclusão Geral
    const percentSum = workItems.reduce((acc, curr) => acc + curr.percentual, 0);
    const conclusaoGeral = workItems.length > 0 ? percentSum / workItems.length : 0;

    // 3. Total/Budget por Semana
    const semanas = ['semana01', 'semana02', 'semana03', 'semana04', 'semana05'] as const;
    const valueByWeek: Record<string, number> = {
      semana01: 0, semana02: 0, semana03: 0, semana04: 0, semana05: 0
    };
    
    semanas.forEach(semana => {
      const globalUniqueValues = new Set<string>();
      workItems.forEach(item => {
        const weekPercent = item[semana];
        const budget = item.orado;
        
        if (weekPercent > 0 && budget > 0) {
          const valueKey = `${weekPercent}_${budget}`;
          if (!globalUniqueValues.has(valueKey)) {
            globalUniqueValues.add(valueKey);
            const itemValue = (weekPercent * budget) / 100;
            valueByWeek[semana] += itemValue;
          }
        }
      });
    });

    const totalValueByWeek = Object.entries(valueByWeek).map(([name, val]) => ({
      name: name.replace('semana0', 'Semana '),
      key: name,
      valor: val
    }));

    // 4. Group Summaries & Projetos em Risco
    const gs: Record<string, any> = {};
    workItems.forEach(i => {
      if (!gs[i.groupId]) gs[i.groupId] = { id: i.groupId, name: i.groupName, percentSum: 0, oradoSum: 0, count: 0, pendentes: 0 };
      gs[i.groupId].percentSum += i.percentual;
      gs[i.groupId].oradoSum += i.orado;
      gs[i.groupId].count += 1;
      if (i.percentual < 100) gs[i.groupId].pendentes += 1;
    });

    let riskCount = 0;
    const groupSummaries = Object.values(gs).map(g => {
      const avgPercent = g.count > 0 ? g.percentSum / g.count : 0;
      if (avgPercent < 50 && g.oradoSum > 5000) riskCount += 1;
      return { ...g, avgPercent };
    });
    
    // 5. Ranking de Setores & Top Performer
    const ss: Record<string, any> = {};
    workItems.forEach(i => {
      const setor = i.subitemName.trim();
      if (!ss[setor]) ss[setor] = { name: setor, percentSum: 0, count: 0 };
      ss[setor].percentSum += i.percentual;
      ss[setor].count += 1;
    });

    const setorRanking = Object.values(ss).map(s => ({
      name: s.name,
      avgPercent: s.count > 0 ? s.percentSum / s.count : 0
    })).sort((a, b) => b.avgPercent - a.avgPercent);
    const topPerformer = setorRanking.length > 0 ? setorRanking[0].name : '-';

    // 6. Velocidade Semanal (Semana 5 vs Semana 1 em Produção de Valor)
    const vS1 = valueByWeek.semana01;
    const vS5 = valueByWeek.semana05;
    let velocidadeSemanal = 0;
    if (vS1 > 0) {
      velocidadeSemanal = ((vS5 - vS1) / Math.abs(vS1)) * 100;
    }

    // 7. Critical Items
    const criticalItems = [...workItems]
      .filter(i => i.percentual < 30 && i.orado > 3000)
      .sort((a, b) => b.orado - a.orado)
      .slice(0, 10);

    return {
      uniqueProjects, totalValueByWeek, conclusaoGeral, projetosEmRisco: riskCount, topPerformer, velocidadeSemanal, groupSummaries, setorRanking, criticalItems
    };
  }, [workItems]);

  const filteredChartData = selectedWeek === 'all' 
    ? totalValueByWeek 
    : totalValueByWeek.filter(tw => tw.key === selectedWeek);

  const totalFilteredValue = filteredChartData.reduce((acc, curr) => acc + curr.valor, 0);

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
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600 font-medium">Filtrar Semana:</label>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
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
          title="Valor Produzido" 
          value={formatCompactBRL(totalFilteredValue)} 
          subtitle={selectedWeek === 'all' ? 'Total 5 Semanas' : `Total ${selectedWeek.replace('semana0', 'Semana ')}`}
          icon={<Activity size={20} className="text-emerald-500"/>} 
        />
        
        <KPICard 
          title="Projetos em Risco" 
          value={projetosEmRisco} 
          subtitle="<50% progresso & >5k budget"
          icon={<AlertTriangle size={20} className="text-red-500" />} 
          isWarning={projetosEmRisco > 0}
        />
        
        <KPICard 
          title="Top Performer" 
          value={topPerformer} 
          subtitle="Setor liderando concl."
          icon={<CheckCircle size={20} className="text-violet-500" />} 
        />

        <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Velocidade Semanal</span>
            <Zap size={20} className="text-amber-500" />
          </div>
          <div className="flex items-end gap-2">
            <div className={`text-2xl font-bold ${velocidadeSemanal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {velocidadeSemanal > 0 ? '+' : ''}{velocidadeSemanal.toFixed(1)}%
            </div>
          </div>
          <div className="text-xs text-slate-400 mt-1 flex items-center">
             {velocidadeSemanal >= 0 ? <TrendingUp size={12} className="text-emerald-500 mr-1"/> : <TrendingDown size={12} className="text-red-500 mr-1"/>}
             vs Semana 1
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de Valor Produzido */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm lg:col-span-2 flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-4 tracking-tight">Valor Produzido (Deduplicado)</h3>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 13}} />
                <YAxis tickFormatter={formatCompactBRL} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 13}} />
                <Tooltip 
                  formatter={(val: number) => formatBRL(val)} 
                  cursor={{fill: '#f1f5f9'}}
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'}}
                />
                <Bar dataKey="valor" radius={[4, 4, 0, 0]} maxBarSize={60}>
                  {filteredChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={TABLEAU10[index % TABLEAU10.length]} />
                  ))}
                  <LabelList dataKey="valor" position="top" formatter={formatCompactBRL} fill="#0f172a" fontSize={11} fontWeight="bold" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Resumo de Projetos */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
          <h3 className="text-lg font-bold text-slate-800 mb-4 tracking-tight">Projetos</h3>
          <div className="flex-1 overflow-y-auto pr-2 space-y-3">
             {groupSummaries.map(proj => (
               <div key={proj.id} className="border border-slate-100 rounded-md p-3 hover:bg-slate-50 transition-colors">
                  <div className="flex justify-between items-center mb-2">
                     <span className="font-semibold text-sm text-slate-800 truncate" title={proj.name}>{proj.name}</span>
                     <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${proj.avgPercent >= 90 ? 'bg-emerald-100 text-emerald-700' : proj.avgPercent < 50 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                       {proj.avgPercent.toFixed(0)}%
                     </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2">
                    <div className="bg-slate-800 h-1.5 rounded-full transition-all duration-500" style={{ width: `${Math.min(proj.avgPercent, 100)}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{proj.pendentes} pendentes</span>
                    <span className="font-medium">{formatCompactBRL(proj.oradoSum)} orçado</span>
                  </div>
               </div>
             ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico Ranking de Setores */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
           <h3 className="text-lg font-bold text-slate-800 mb-4 tracking-tight">Ranking de Setores (Conclusão %)</h3>
           <div className="h-[300px]">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={setorRanking.slice(0, 8)} layout="vertical" margin={{ top: 20, right: 30, left: 40, bottom: 5 }}>
                 <XAxis type="number" domain={[0, 100]} hide />
                 <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 12, fontWeight: 500}} width={100} />
                 <Tooltip formatter={(val: number) => `${val.toFixed(1)}%`} cursor={{fill: '#f1f5f9'}} />
                 <Bar dataKey="avgPercent" radius={[0, 4, 4, 0]} barSize={20}>
                    {setorRanking.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={SET2[index % SET2.length]} />
                    ))}
                    <LabelList dataKey="avgPercent" position="right" formatter={(v: number) => `${v.toFixed(0)}%`} fill="#475569" fontSize={11} />
                 </Bar>
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>

        {/* Tabela de Itens Críticos */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col overflow-hidden">
           <div className="flex items-center justify-between mb-4">
             <h3 className="text-lg font-bold text-slate-800 tracking-tight">Caminho Crítico</h3>
             <span className="text-xs bg-red-100 text-red-700 font-semibold px-2 py-1 rounded">{'<'}30% & {'>'}3k</span>
           </div>
           
           <div className="flex-1 overflow-x-auto">
             <table className="w-full text-sm text-left">
               <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                 <tr>
                   <th className="px-4 py-2 font-semibold">Produto</th>
                   <th className="px-4 py-2 font-semibold">Setor</th>
                   <th className="px-4 py-2 text-right font-semibold">Conclusão</th>
                   <th className="px-4 py-2 text-right font-semibold">Orçado</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                 {criticalItems.length > 0 ? criticalItems.map(item => (
                   <tr key={item.id} className="hover:bg-slate-50">
                     <td className="px-4 py-3 font-medium text-slate-800 max-w-[150px] truncate" title={item.name}>{item.name}</td>
                     <td className="px-4 py-3 text-slate-600">{item.subitemName}</td>
                     <td className="px-4 py-3 text-right">
                        <span className="inline-block bg-red-50 text-red-700 px-1.5 py-0.5 rounded text-xs font-semibold">
                          {item.percentual.toFixed(1)}%
                        </span>
                     </td>
                     <td className="px-4 py-3 text-right font-medium text-slate-700">
                       {formatCompactBRL(item.orado)}
                     </td>
                   </tr>
                 )) : (
                   <tr>
                     <td colSpan={4} className="px-4 py-8 text-center text-slate-400">Nenhum item crítico encontrado.</td>
                   </tr>
                 )}
               </tbody>
             </table>
           </div>
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
