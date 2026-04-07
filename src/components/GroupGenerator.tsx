import { useState, useMemo } from 'react';
import { Board, TaskGroup, Task, BoardColumn } from '@/types/board';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, addDays, subDays, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, LayoutGrid, Package, Construction, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';

interface GroupGeneratorProps {
  boards: Board[];
  onAddColumn?: (type: any, title: string, forBoardId?: string) => Promise<string | undefined>;
  onGeneratorComplete?: (boardId: string) => void;
}

const ITENS_PROD = [
  "3D", "IMPRESSÃO 3D", "ROUTER", "ESCULTURA", "FORMA", "LAMINAÇÃO",
  "SERRALHERIA", "CENOTECNICA", "ACABAMENTO", "PINTURA",
  "ADESIVO", "ADEREÇO", "FINALIZAÇÃO"
];

const MAPA_PORC: Record<string, Record<string, number>> = {
  "JOB - Pequeno": {
    "3D": 2, "IMPRESSÃO 3D": 1, "ROUTER": 7, "ESCULTURA": 15,
    "FORMA": 14, "LAMINAÇÃO": 15, "SERRALHERIA": 7, "CENOTECNICA": 6,
    "ACABAMENTO": 18, "PINTURA": 11, "ADESIVO": 1, "ADEREÇO": 2,
    "FINALIZAÇÃO": 1
  },
  "JOB - Médio": {
    "3D": 2, "IMPRESSÃO 3D": 1, "ROUTER": 7, "ESCULTURA": 13,
    "FORMA": 12, "LAMINAÇÃO": 13, "SERRALHERIA": 10, "CENOTECNICA": 9,
    "ACABAMENTO": 18, "PINTURA": 11, "ADESIVO": 1, "ADEREÇO": 2,
    "FINALIZAÇÃO": 1
  },
  "JOB - Grande": {
    "3D": 2, "IMPRESSÃO 3D": 1, "ROUTER": 5, "ESCULTURA": 12,
    "FORMA": 10, "LAMINAÇÃO": 10, "SERRALHERIA": 15, "CENOTECNICA": 15,
    "ACABAMENTO": 15, "PINTURA": 11, "ADESIVO": 1, "ADEREÇO": 2,
    "FINALIZAÇÃO": 1
  },
  "Exclusivo de Marcenaria": {
    "3D": 2, "IMPRESSÃO 3D": 1, "ROUTER": 5, "ESCULTURA": 0,
    "FORMA": 0, "LAMINAÇÃO": 0, "SERRALHERIA": 28, "CENOTECNICA": 34,
    "ACABAMENTO": 15, "PINTURA": 11, "ADESIVO": 1, "ADEREÇO": 2,
    "FINALIZAÇÃO": 1
  },
  "Exclusivo de Serralheria": {
    "3D": 2, "IMPRESSÃO 3D": 1, "ROUTER": 5, "ESCULTURA": 0,
    "FORMA": 0, "LAMINAÇÃO": 0, "SERRALHERIA": 50, "CENOTECNICA": 13,
    "ACABAMENTO": 14, "PINTURA": 11, "ADESIVO": 1, "ADEREÇO": 2,
    "FINALIZAÇÃO": 1
  },
};

export default function GroupGenerator({ boards, onAddColumn, onGeneratorComplete }: GroupGeneratorProps) {
  const [template, setTemplate] = useState<'producao' | 'montagem'>('producao');
  const [jobNumber, setJobNumber] = useState('JOB-1234');
  const [description, setDescription] = useState('');
  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>(new Date());
  const [selectedBoardIds, setSelectedBoardIds] = useState<string[]>([]);
  const [isSelectOpen, setIsSelectOpen] = useState(false);
  const [applyFactorPerBoard, setApplyFactorPerBoard] = useState<Record<string, boolean>>({});

  // Produção
  const [jobType, setJobType] = useState('JOB - Pequeno');
  const [totalBudget, setTotalBudget] = useState('100,00');
  const [distributionFactor, setDistributionFactor] = useState(49);
  const [naSectors, setNaSectors] = useState<Set<string>>(new Set());
  const [receptorSectors, setReceptorSectors] = useState<Set<string>>(new Set());

  // Montagem
  const [local, setLocal] = useState<'dentro' | 'fora'>('dentro');
  const [translado, setTranslado] = useState<'sem' | 'aviao' | 'onibus'>('sem');

  const [isGenerating, setIsGenerating] = useState(false);

  const redistributeFromNa = (baseMap: Record<string, number>, na: Set<string>, receptores: Set<string>) => {
    const itens = ITENS_PROD;
    const cleanNa = new Set([...na].filter(s => itens.includes(s) && !receptores.has(s)));
    
    const sumNa = Array.from(cleanNa).reduce((acc, s) => acc + (baseMap[s] || 0), 0);
    const ativos = itens.filter(s => !cleanNa.has(s));
    
    const result: Record<string, number> = {};
    itens.forEach(k => {
      result[k] = cleanNa.has(k) ? 0 : (baseMap[k] || 0);
    });

    if (sumNa <= 0) return result;

    if (receptores.size === 0) {
      const pesoTotalAtivos = ativos.reduce((acc, s) => acc + (baseMap[s] || 0), 0);
      if (pesoTotalAtivos > 0) {
        ativos.forEach(s => {
          result[s] += sumNa * (baseMap[s] / pesoTotalAtivos);
        });
      }
      return result;
    }

    if (receptores.size === 1) {
      const rec = Array.from(receptores)[0];
      result[rec] += sumNa;
      return result;
    }

    const receptorList = Array.from(receptores);
    const pesoReceptores = receptorList.reduce((acc, s) => acc + (baseMap[s] || 0), 0);
    if (pesoReceptores > 0) {
      receptorList.forEach(s => {
        result[s] += sumNa * (baseMap[s] / pesoReceptores);
      });
    } else {
      const part = sumNa / receptores.size;
      receptorList.forEach(s => {
        result[s] += part;
      });
    }
    return result;
  };

  const handleGenerate = async () => {
    if (isGenerating) return;
    if (!description) {
      toast.error('Informe a descrição do JOB');
      return;
    }
    if (selectedBoardIds.length === 0) {
      toast.error('Selecione ao menos um projeto de destino');
      return;
    }

    setIsGenerating(true);
    try {
      const groupTitle = `${description} - ${jobNumber}`;

      for (const boardId of selectedBoardIds) {
        const targetBoard = boards.find(b => b.id === boardId);
        if (!targetBoard) {
          console.warn(`[GroupGenerator] Board ${boardId} não encontrado.`);
          continue;
        }

        // Fetch live column data directly from Supabase to get real IDs
        const { data: liveColumns } = await supabase
          .from('board_columns')
          .select('*')
          .eq('board_id', boardId);
        
        // Use live columns if available AND non-empty, otherwise fallback to local board state
        const allColumns = (liveColumns && liveColumns.length > 0)
          ? liveColumns.map((c: any) => ({
              id: c.id as string, 
              type: c.type as string, 
              title: c.title as string
            }))
          : targetBoard.columns.map(c => ({ id: c.id, type: c.type, title: c.title }));

        console.log(`[GroupGenerator] Columns found for board ${boardId}:`, allColumns.map(c => `"${c.title}" (${c.type}) → ${c.id}`));

        // TITLE-ONLY matching to avoid two number columns resolving to the same one
        const findByTitle = (titles: string[]): string | undefined => {
          return allColumns.find(c => 
            titles.some(t => c.title.toLowerCase().trim() === t.toLowerCase().trim())
          )?.id;
        };

        // Type-based matching (only used as fallback for unique types like status, date, timeline)
        const findByType = (type: string): string | undefined => {
          return allColumns.find(c => c.type === type)?.id;
        };

        // Map columns:
        const colIds = {
          status:       findByTitle(['Status', 'Status Setor', 'Setor']) || findByType('status'),
          deliveryDate: findByTitle(['Data de Entr.', 'Data de Entrega', 'Entrega', 'Data']) || findByType('date'),
          budget:       findByTitle(['Orçamento Job', 'Orçado', 'Orçamento', 'Custo']),
          percentage:   findByTitle(['%', 'Progresso', 'Percentual', 'Percentual (%)']),
          timeline:     findByTitle(['Cronograma', 'Timeline', 'Prazo']) || findByType('timeline'),
        };

        console.log(`[GroupGenerator] Mapped colIds for board ${boardId}:`, JSON.stringify(colIds));

        const { data: newGroup, error: groupErr } = await supabase.from('task_groups').insert({
          board_id: boardId,
          title: groupTitle,
          color: template === 'producao' ? 'orange' : 'teal'
        }).select().single();

        if (groupErr) throw groupErr;

        const tasksToInsert: any[] = [];
        const colValuesToInsert: any[] = [];

        if (template === 'producao') {
          const baseMap = { ...MAPA_PORC[jobType] };
          ITENS_PROD.forEach(it => { if (!(it in baseMap)) baseMap[it] = 0; });

          const percFinal = redistributeFromNa(baseMap, naSectors, receptorSectors);
          const parseMoney = (s: string) => {
            const cleaned = s.replace(/\s/g, '');
            if (cleaned.includes(',') && cleaned.includes('.')) {
              return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
            }
            return parseFloat(cleaned.replace(',', '.'));
          };
          const totalBudgetVal = parseMoney(totalBudget) || 0;
          const totalRedistribuivel = totalBudgetVal * (distributionFactor / 100);

          console.log('[GroupGenerator] Budget:', { totalBudgetVal, distributionFactor, totalRedistribuivel });

        const taskIds: string[] = [];
        const taskBudgets: number[] = [];

        ITENS_PROD.forEach((nome) => {
          const perc = parseFloat(percFinal[nome].toFixed(6));
          const isNa = naSectors.has(nome);
          const orcamentoJob = parseFloat(((perc / 100) * totalRedistribuivel).toFixed(2));
          
          const taskId = crypto.randomUUID();
          taskIds.push(taskId);
          taskBudgets.push(orcamentoJob);

          tasksToInsert.push({
            id: taskId,
            group_id: newGroup.id,
            name: nome,
            position: tasksToInsert.length
          });

          // Build column values INDIVIDUALLY (no batching with Object.entries to avoid key collision)
          if (colIds.status) {
            colValuesToInsert.push({ task_id: taskId, column_id: colIds.status, value: isNa ? 'N/A' : 'default' });
          }
          if (colIds.deliveryDate && deliveryDate) {
            colValuesToInsert.push({ task_id: taskId, column_id: colIds.deliveryDate, value: format(deliveryDate, 'yyyy-MM-dd') });
          }
          if (colIds.percentage) {
            colValuesToInsert.push({ task_id: taskId, column_id: colIds.percentage, value: perc });
          }
          // Budget is added after rounding adjustment below
        });

        // Adjustment for rounding then add budget values
        const shouldApplyFactor = applyFactorPerBoard[boardId] !== false;
        
        if (colIds.budget && shouldApplyFactor) {
          const sumDistributed = taskBudgets.reduce((a, b) => a + b, 0);
          const diff = parseFloat((totalRedistribuivel - sumDistributed).toFixed(2));
          if (Math.abs(diff) >= 0.01) {
            const maxIdx = taskBudgets.indexOf(Math.max(...taskBudgets));
            taskBudgets[maxIdx] = parseFloat((taskBudgets[maxIdx] + diff).toFixed(2));
          }
          
          taskIds.forEach((id, i) => {
            colValuesToInsert.push({ task_id: id, column_id: colIds.budget!, value: taskBudgets[i] });
          });
        }

      } else {
        // Montagem
        const itensMain = [
          "CONTRATOS / DOCUMENTOS", "MODELO DE CONTRATO", "PLANTA E ARQUIVOS", "VISITA",
          "DEFINIÇÃO DE EQUIPE", "CARTÃO FLASH", "FERRAMENTAS / EPI'S", "MATERIAL",
          "FRETE", "HOTEL", "TRANSLADO", "ALIMENTAÇÃO", "UBER", "PROGRAMAÇÃO DE RETORNO"
        ];
        const itensSubGerais = [
          "PRODUÇÃO","CENOTÉCNICOS","TAPEÇARIA","SERRALHERIA","ACABAMENTO",
          "PINTURA - TERCEIRIZADOS","PINTURA","ADEREÇO","CARGA DE TRANSPORTE",
          "TRANSPORTE DO CAMINHÃO","DESCARGA DE TRANSPORTE","LIMPEZA DO LOCAL","RETOQUES/FINALIZAÇÃO"
        ];

        let freteIni = '', freteFim = '', hotelIni = '', hotelFim = '', transladoIni = '', transladoFim = '';
        let statusHotel = 'default', statusTranslado = 'default';

        if (deliveryDate) {
          if (local === 'fora') {
             freteIni = format(subDays(deliveryDate, 15), 'yyyy-MM-dd');
             freteFim = format(subDays(deliveryDate, 7), 'yyyy-MM-dd');
             hotelIni = format(subDays(deliveryDate, 5), 'yyyy-MM-dd');
             hotelFim = hotelIni;
          } else {
             freteIni = format(subDays(deliveryDate, 2), 'yyyy-MM-dd');
             freteFim = freteIni;
             statusHotel = 'N/A';
          }

          if (translado === 'aviao') {
            transladoIni = format(subDays(deliveryDate, 7), 'yyyy-MM-dd');
            transladoFim = transladoIni;
          } else if (translado === 'onibus') {
            transladoIni = format(subDays(deliveryDate, 2), 'yyyy-MM-dd');
            transladoFim = transladoIni;
          } else {
            statusTranslado = 'N/A';
          }
        }

        let currentPos = 0;
        const addMontagemTask = (nome: string, subelements = '', statusOverride?: string, timeline?: {from: string, to: string}) => {
          const taskId = crypto.randomUUID();
          tasksToInsert.push({ id: taskId, group_id: newGroup.id, name: nome, position: currentPos++ });
          
          if (colIds.status) {
            colValuesToInsert.push({ task_id: taskId, column_id: colIds.status, value: statusOverride || 'default' });
          }
          if (colIds.deliveryDate && deliveryDate) {
            colValuesToInsert.push({ task_id: taskId, column_id: colIds.deliveryDate, value: format(deliveryDate, 'yyyy-MM-dd') });
          }
          if (colIds.timeline && timeline?.from && timeline.to) {
            colValuesToInsert.push({ task_id: taskId, column_id: colIds.timeline, value: { from: timeline.from, to: timeline.to } });
          }
        };

        itensMain.forEach(nome => {
          let status = 'default';
          let timeline = undefined;

          if (nome === 'FRETE') timeline = { from: freteIni, to: freteFim };
          if (nome === 'HOTEL') { timeline = { from: hotelIni, to: hotelFim }; status = statusHotel; }
          if (nome === 'TRANSLADO') { timeline = { from: transladoIni, to: transladoFim }; status = statusTranslado; }

          addMontagemTask(nome, '', status, timeline);

          if (nome === 'DEFINIÇÃO DE EQUIPE') {
            itensSubGerais.forEach(sub => addMontagemTask(sub));
          }
          if (nome === 'HOTEL') {
            addMontagemTask('Contato do Anfitrião', 'HOTEL', statusHotel);
          }
        });
      }

        // Final insertion WITH error handling
        console.log(`[GroupGenerator] Inserting ${tasksToInsert.length} tasks and ${colValuesToInsert.length} values for board ${boardId}`);
        
        if (tasksToInsert.length > 0) {
          const { error: taskErr } = await supabase.from('tasks').insert(tasksToInsert);
          if (taskErr) {
            console.error('[GroupGenerator] Tasks insert error:', taskErr);
            throw new Error(`Erro ao inserir tarefas no projeto ${targetBoard.title}: ` + taskErr.message);
          }
          
          if (colValuesToInsert.length > 0) {
            const { error: valErr } = await supabase.from('task_values').insert(colValuesToInsert);
            if (valErr) {
              console.error('[GroupGenerator] Values insert error:', valErr);
              toast.warning(`Valores falharam no projeto ${targetBoard.title}: ` + valErr.message);
            }
          }
        }
      } // Fim do loop de projetos

      toast.success('Grupos gerados com sucesso nos projetos selecionados!');
      if (onGeneratorComplete && selectedBoardIds.length > 0) {
        onGeneratorComplete(selectedBoardIds[0]); // Atualiza a tela com o primeiro projeto selecionado
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao gerar grupos: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#333333] tracking-tight">Gerador de Grupo</h1>
          <p className="text-muted-foreground mt-1 text-sm">Crie grupos de tarefas automatizados para Produção ou Montagem</p>
        </div>
        <LayoutGrid className="w-10 h-10 text-blue-500 opacity-20" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 border shadow-sm">
          <CardHeader className="bg-slate-50/50">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-500" />
              Configurações do JOB
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="template">Tipo de Template</Label>
                <Select value={template} onValueChange={(v: any) => setTemplate(v)}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="producao">Produção</SelectItem>
                    <SelectItem value="montagem">Montagem</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="jobNum">Numeração (JOB)</Label>
                <Input 
                  id="jobNum" 
                  value={jobNumber} 
                  onChange={e => setJobNumber(e.target.value)} 
                  placeholder="Ex: JOB-1234"
                  className="h-10"
                />
              </div>

              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="desc">Descrição do JOB</Label>
                <Input 
                  id="desc" 
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                  placeholder="Ex: Cenografia Feira X"
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label>Data de Entrega</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full h-10 justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {deliveryDate ? format(deliveryDate, 'PPP', { locale: ptBR }) : <span>Selecione a data</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={deliveryDate}
                      onSelect={setDeliveryDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="targetBoard">Projetos de Destino</Label>
                <Popover open={isSelectOpen} onOpenChange={setIsSelectOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={isSelectOpen}
                      className="w-full h-10 justify-between text-left font-normal truncate"
                    >
                      {selectedBoardIds.length > 0
                        ? `${selectedBoardIds.length} projeto(s) selecionado(s)`
                        : "Selecione os projetos"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[380px] sm:w-[450px] p-2" align="start">
                    <ScrollArea className="h-48">
                      <div className="space-y-1 p-1">
                        {boards.map(b => (
                          <div
                            key={b.id}
                            className="flex items-center space-x-2 py-1.5 px-2 hover:bg-slate-100 rounded-sm cursor-pointer"
                            onClick={() => {
                              setSelectedBoardIds(prev => 
                                prev.includes(b.id) 
                                  ? prev.filter(id => id !== b.id)
                                  : [...prev, b.id]
                              );
                            }}
                          >
                            <Checkbox
                              checked={selectedBoardIds.includes(b.id)}
                              onCheckedChange={(checked) => {
                                setSelectedBoardIds(prev =>
                                  checked 
                                    ? [...prev, b.id] 
                                    : prev.filter(id => id !== b.id)
                                );
                              }}
                            />
                            <span className="text-sm border-0 bg-transparent flex-1 text-left select-none truncate min-w-0 pr-2">
                              {b.title}
                            </span>
                            
                            {selectedBoardIds.includes(b.id) && template === 'producao' && (
                              <div 
                                className="flex items-center gap-1.5 ml-auto pl-2 border-l shrink-0"
                                onClick={(e) => e.stopPropagation()}
                                title="Aplicar Fator de Orçamento neste projeto?"
                              >
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                  {applyFactorPerBoard[b.id] !== false ? 'Com Valor' : 'Sem Valor'}
                                </span>
                                <Switch 
                                  checked={applyFactorPerBoard[b.id] !== false}
                                  onCheckedChange={(checked) => setApplyFactorPerBoard(prev => ({ ...prev, [b.id]: checked }))}
                                  className="scale-75 data-[state=checked]:bg-blue-500"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {template === 'producao' && (
              <div className="pt-6 border-t space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="jobType">Tipo de JOB</Label>
                    <Select value={jobType} onValueChange={setJobType}>
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(MAPA_PORC).map(k => (
                          <SelectItem key={k} value={k}>{k}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="budget">Orçamento Total (R$)</Label>
                    <Input 
                      id="budget" 
                      value={totalBudget} 
                      onChange={e => setTotalBudget(e.target.value)}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="factor">Fator de Distribuição (%)</Label>
                    <Input 
                      id="factor" 
                      type="number" 
                      value={distributionFactor} 
                      onChange={e => setDistributionFactor(Number(e.target.value))}
                      className="h-10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-4">
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-orange-500" />
                      Setores N/A (excluir da divisão)
                    </Label>
                    <ScrollArea className="h-48 border rounded-md p-3 bg-slate-50/30">
                      {ITENS_PROD.map(sector => (
                        <div key={sector} className="flex items-center space-x-2 py-1.5 hover:bg-slate-100/50 px-2 rounded-sm transition-colors">
                          <Checkbox 
                            id={`na-${sector}`} 
                            checked={naSectors.has(sector)}
                            onCheckedChange={(checked) => {
                              const newSet = new Set(naSectors);
                              if (checked) newSet.add(sector); else newSet.delete(sector);
                              setNaSectors(newSet);
                            }}
                          />
                          <label htmlFor={`na-${sector}`} className="text-xs font-medium leading-none cursor-pointer">
                            {sector}
                          </label>
                        </div>
                      ))}
                    </ScrollArea>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      Setores Receptores (% dos N/A)
                    </Label>
                    <ScrollArea className="h-48 border rounded-md p-3 bg-slate-50/30">
                      {ITENS_PROD.map(sector => (
                        <div key={sector} className="flex items-center space-x-2 py-1.5 hover:bg-slate-100/50 px-2 rounded-sm transition-colors">
                          <Checkbox 
                            id={`rec-${sector}`} 
                            checked={receptorSectors.has(sector)}
                            onCheckedChange={(checked) => {
                              const newSet = new Set(receptorSectors);
                              if (checked) newSet.add(sector); else newSet.delete(sector);
                              setReceptorSectors(newSet);
                            }}
                          />
                          <label htmlFor={`rec-${sector}`} className="text-xs font-medium leading-none cursor-pointer">
                            {sector}
                          </label>
                        </div>
                      ))}
                    </ScrollArea>
                  </div>
                </div>
              </div>
            )}

            {template === 'montagem' && (
              <div className="pt-6 border-t space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Local da Montagem</Label>
                    <Select value={local} onValueChange={(v: any) => setLocal(v)}>
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dentro">Dentro do estado</SelectItem>
                        <SelectItem value="fora">Fora do estado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Modo de Translado</Label>
                    <Select value={translado} onValueChange={(v: any) => setTranslado(v)}>
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sem">Sem translado</SelectItem>
                        <SelectItem value="aviao">Avião</SelectItem>
                        <SelectItem value="onibus">Ônibus</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border shadow-sm bg-blue-50/30">
            <CardHeader>
              <CardTitle className="text-lg">Resumo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm space-y-2">
                <p className="flex justify-between border-b pb-1">
                   <span className="text-muted-foreground font-medium">Template:</span> 
                   <span className="capitalize">{template}</span>
                </p>
                <p className="flex justify-between border-b pb-1">
                   <span className="text-muted-foreground font-medium">JOB:</span> 
                   <span>{jobNumber}</span>
                </p>
                {template === 'producao' && (
                  <>
                    <p className="flex justify-between border-b pb-1">
                       <span className="text-muted-foreground font-medium">Tipo:</span> 
                       <span>{jobType}</span>
                    </p>
                    <p className="flex justify-between border-b pb-1">
                       <span className="text-muted-foreground font-medium">Orçamento:</span> 
                       <span className="font-bold text-blue-600">R$ {totalBudget}</span>
                    </p>
                    <p className="flex justify-between border-b pb-1">
                       <span className="text-muted-foreground font-medium">Fator:</span> 
                       <span>{distributionFactor}%</span>
                    </p>
                  </>
                )}
                {template === 'montagem' && (
                  <>
                    <p className="flex justify-between border-b pb-1">
                       <span className="text-muted-foreground font-medium">Local:</span> 
                       <span>{local === 'fora' ? 'Fora' : 'Dentro'} do estado</span>
                    </p>
                    <p className="flex justify-between border-b pb-1">
                       <span className="text-muted-foreground font-medium">Translado:</span> 
                       <span className="capitalize">{translado}</span>
                    </p>
                  </>
                )}
              </div>
              
              <Button 
                onClick={handleGenerate} 
                className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-white font-semibold transition-all shadow-md"
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Gerando...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Construction className="w-4 h-4" />
                    Gerar Grupo no Projeto
                  </div>
                )}
              </Button>
            </CardContent>
          </Card>
          
          <div className="p-4 rounded-lg bg-slate-100 border text-xs text-muted-foreground leading-relaxed italic">
            Dica: O gerador identificará automaticamente as colunas de "Status", "Data de Entrega", "Orçamento" e "Cronograma" no projeto de destino.
          </div>
        </div>
      </div>
    </div>
  );
}
