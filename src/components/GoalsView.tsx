import React, { useState, useEffect } from 'react';
import { Target, Calendar, TrendingUp, Info, Save, Check, X, Loader2 } from 'lucide-react';
import { format, getDaysInMonth, setMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { fetchMonthlyGoals, updateMonthlyGoals } from '../lib/supabase';

interface MonthGoal {
  value: number;
  includeSaturdays: boolean;
}

export default function GoalsView() {
  const [goals, setGoals] = useState<Record<number, MonthGoal>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [year] = useState(new Date().getFullYear());

  useEffect(() => {
    async function loadGoals() {
      setIsLoading(true);
      try {
        const data = await fetchMonthlyGoals(year);
        const map: Record<number, MonthGoal> = {};
        
        // Initialize with defaults
        for (let i = 0; i < 12; i++) {
          map[i] = { value: 300000, includeSaturdays: false };
        }

        // Fill with DB data
        data?.forEach(g => {
          map[g.month_idx] = { value: Number(g.value), includeSaturdays: !!g.include_saturdays };
        });

        // Migration from localStorage if needed (only if DB is mostly empty)
        if (!data || data.length === 0) {
          const saved = localStorage.getItem('executive_monthly_goals_v2');
          if (saved) {
            const local = JSON.parse(saved);
            Object.keys(local).forEach(k => {
              const idx = parseInt(k);
              map[idx] = local[k];
            });
          }
        }

        setGoals(map);
      } catch (err) {
        console.error('Error loading goals:', err);
        toast.error('Erro ao carregar metas do banco de dados');
      } finally {
        setIsLoading(false);
      }
    }
    loadGoals();
  }, [year]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateMonthlyGoals(year, goals);
      localStorage.setItem('executive_monthly_goals_v2', JSON.stringify(goals));
      toast.success('Configurações de metas salvas no banco de dados!');
    } catch (err) {
      console.error('Error saving goals:', err);
      toast.error('Erro ao salvar metas no banco de dados');
    } finally {
      setIsSaving(false);
    }
  };

  const updateGoalValue = (monthIdx: number, value: number) => {
    setGoals(prev => ({ ...prev, [monthIdx]: { ...prev[monthIdx], value } }));
  };

  const toggleSaturdays = (monthIdx: number) => {
    setGoals(prev => ({ ...prev, [monthIdx]: { ...prev[monthIdx], includeSaturdays: !prev[monthIdx].includeSaturdays } }));
  };

  const totalAnnual = Object.values(goals).reduce((a, b) => a + b.value, 0);

  const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="p-8 bg-[#f5f6f8] min-h-full space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Planejamento Estratégico</h2>
          <p className="text-slate-500 mt-1">Configure metas e escalas de trabalho para o ano de {year}</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving || Object.keys(goals).length === 0}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-semibold shadow-lg shadow-blue-200 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100"
        >
          {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {isSaving ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 size={48} className="animate-spin mb-4" />
          <p className="font-medium">Carregando metas do banco de dados...</p>
        </div>
      ) : (
        <>
          {/* Resumo Anual */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between relative overflow-hidden">
            <div className="z-10">
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Faturamento Previsto p/ {year}</p>
              <h3 className="text-4xl font-black text-slate-900">{formatBRL(totalAnnual)}</h3>
            </div>
            <div className="p-4 bg-blue-50 rounded-2xl text-blue-600 z-10">
              <TrendingUp size={40} />
            </div>
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-blue-50/50 rounded-full blur-3xl" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 12 }).map((_, i) => {
              const monthDate = setMonth(new Date(year, 0, 1), i);
              const monthName = format(monthDate, 'MMMM', { locale: ptBR });
              const daysInMonth = getDaysInMonth(monthDate);
              const monthGoal = goals[i] || { value: 0, includeSaturdays: false };
              
              return (
                <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group overflow-hidden flex flex-col">
                  <div className="p-5 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-lg shadow-sm text-blue-600">
                        <Calendar size={18} />
                      </div>
                      <span className="font-bold text-slate-800 capitalize leading-none">{monthName}</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{year}</span>
                  </div>
                  
                  <div className="p-5 space-y-6 flex-1">
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Meta do Mês (R$)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium tracking-tight">R$</span>
                        <input 
                          type="number"
                          value={monthGoal.value}
                          onChange={(e) => updateGoalValue(i, Number(e.target.value))}
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl text-lg font-bold text-slate-800 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">Escala de Trabalho</label>
                      <button 
                        onClick={() => toggleSaturdays(i)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                          monthGoal.includeSaturdays 
                          ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' 
                          : 'bg-slate-50 border-slate-100 text-slate-600'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`p-1 rounded-md ${monthGoal.includeSaturdays ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                            {monthGoal.includeSaturdays ? <Check size={12} /> : <X size={12} />}
                          </div>
                          <span className="text-xs font-bold uppercase tracking-wide">Incluir Sábados</span>
                        </div>
                        <span className="text-[10px] font-bold bg-white/50 px-2 py-0.5 rounded-full">
                          {monthGoal.includeSaturdays ? '6 DIAS/SEM' : '5 DIAS/SEM'}
                        </span>
                      </button>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-slate-50/30 flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-widest border-t border-slate-50">
                    <div className="flex items-center gap-2">
                      <Info size={12} />
                      <span>{daysInMonth} dias totais</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
