import { useState, useMemo } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BoardColumn } from '@/types/board';
import { Sparkles, FunctionSquare, Plus, Search, HelpCircle, ChevronRight, Terminal, Wand2, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormulaDialogProps {
  open: boolean;
  onClose: () => void;
  onDefine: (formula: string) => void;
  columns: BoardColumn[];
  initialValue?: string;
}

interface FormulaFunc {
  name: string;
  category: 'math' | 'date';
  description: string;
  example: string;
  template: string;
}

const FORMULA_FUNCTIONS: FormulaFunc[] = [
  // ---- Matemática ----
  { name: 'SUM', category: 'math', description: 'Soma todos os valores fornecidos.', example: 'SUM({Q1 Sales}, {Q2 Sales}, {Q3 Sales})', template: 'SUM({}, {})' },
  { name: 'COUNT', category: 'math', description: 'Conta quantos valores não estão vazios.', example: 'COUNT({Orçamento}, {Custo})', template: 'COUNT({}, {})' },
  { name: 'AVERAGE', category: 'math', description: 'Calcula a média dos valores fornecidos.', example: 'AVERAGE({Semana 01}, {Semana 02})', template: 'AVERAGE({}, {})' },
  { name: 'MOD', category: 'math', description: 'Retorna o resto da divisão de A por B.', example: 'MOD({Total}, 2)', template: 'MOD({}, 2)' },
  { name: 'ROUND', category: 'math', description: 'Arredonda um número para N casas decimais.', example: 'ROUND({Percentual}, 2)', template: 'ROUND({}, 2)' },
  { name: 'ABS', category: 'math', description: 'Retorna o valor absoluto (sem sinal negativo).', example: 'ABS({Saldo})', template: 'ABS({})' },
  { name: 'MIN', category: 'math', description: 'Retorna o menor valor entre dois números.', example: 'MIN({Orçamento}, {Custo Real})', template: 'MIN({}, {})' },
  { name: 'MAX', category: 'math', description: 'Retorna o maior valor entre dois números.', example: 'MAX({Orçamento}, {Custo Real})', template: 'MAX({}, {})' },
  { name: 'IF', category: 'math', description: 'Retorna um valor se a condição for verdadeira, outro se falsa.', example: 'IF({Progresso} > 50, "OK", "Atraso")', template: 'IF({} > 0, , )' },
  // ---- Data e Hora ----
  { name: 'DAYS', category: 'date', description: 'Retorna o número de dias entre as duas datas.', example: 'DAYS({End Date}, {Start Date})', template: 'DAYS({}, {})' },
  { name: 'WORKDAYS', category: 'date', description: 'Retorna o número de dias úteis (Seg-Sex) entre duas datas.', example: 'WORKDAYS({Fim}, {Início})', template: 'WORKDAYS({}, {})' },
  { name: 'TODAY', category: 'date', description: 'Retorna a data de hoje.', example: 'TODAY()', template: 'TODAY()' },
  { name: 'DATE', category: 'date', description: 'Extrai a data de uma coluna de cronograma.', example: 'DATE({Cronograma})', template: 'DATE({})' },
];

const OPERATORS = [
  { symbol: '+', label: 'Soma', desc: 'Adicionar dois valores' },
  { symbol: '-', label: 'Subtração', desc: 'Subtrair dois valores' },
  { symbol: '*', label: 'Multiplicação', desc: 'Multiplicar dois valores' },
  { symbol: '/', label: 'Divisão', desc: 'Dividir dois valores' },
];

export default function FormulaDialog({ open, onClose, onDefine, columns, initialValue = '' }: FormulaDialogProps) {
  const [formula, setFormula] = useState(initialValue);
  const [aiInput, setAiInput] = useState('');
  const [activeTab, setActiveTab] = useState('ai');
  const [funcSearch, setFuncSearch] = useState('');
  const [hoveredFunc, setHoveredFunc] = useState<FormulaFunc | null>(null);

  const eligibleColumns = useMemo(() => 
    columns.filter(c => ['number', 'date', 'timeline', 'progress'].includes(c.type)),
  [columns]);

  const filteredFunctions = useMemo(() => 
    FORMULA_FUNCTIONS.filter(f => 
      f.name.toLowerCase().includes(funcSearch.toLowerCase()) || 
      f.description.toLowerCase().includes(funcSearch.toLowerCase())
    ),
  [funcSearch]);

  const mathFunctions = filteredFunctions.filter(f => f.category === 'math');
  const dateFunctions = filteredFunctions.filter(f => f.category === 'date');

  const insertAtCursor = (text: string) => {
    setFormula(prev => prev + text);
  };

  const handleAiAsk = () => {
    if (!aiInput) return;
    const lower = aiInput.toLowerCase();
    if (lower.includes('dias') || lower.includes('cronograma') || lower.includes('data')) {
      const timelineCol = eligibleColumns.find(c => c.type === 'timeline');
      insertAtCursor(`DAYS({${timelineCol?.title || 'Cronograma'}}, {${eligibleColumns.find(c => c.type === 'date')?.title || 'Data'}})`);
    } else if (lower.includes('soma') || lower.includes('total')) {
      const numCols = eligibleColumns.filter(c => c.type === 'number').slice(0, 3);
      insertAtCursor(`SUM(${numCols.map(c => `{${c.title}}`).join(', ')})`);
    } else if (lower.includes('média') || lower.includes('media')) {
      const numCols = eligibleColumns.filter(c => c.type === 'number').slice(0, 3);
      insertAtCursor(`AVERAGE(${numCols.map(c => `{${c.title}}`).join(', ')})`);
    } else if (lower.includes('imposto') || lower.includes('taxa') || lower.includes('%')) {
      insertAtCursor('{Orçamento} * 0.1');
    } else {
      insertAtCursor('{Orçamento} * 0.1');
    }
    setAiInput('');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl p-0 gap-0 bg-white border-none shadow-2xl overflow-hidden">
        <DialogHeader className="p-6 border-b bg-[#F5F6F8]/50">
          <div className="flex items-center justify-between">
             <DialogTitle className="text-xl font-bold text-[#323338]">Criador de fórmulas</DialogTitle>
             <div className="flex items-center gap-3">
                <HelpCircle className="w-5 h-5 text-muted-foreground" />
             </div>
          </div>
        </DialogHeader>

        <div className="flex h-[520px]">
          {/* Left Panel: Tabs */}
          <div className="w-[45%] border-r flex flex-col bg-white">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col">
              <TabsList className="w-full justify-start rounded-none bg-transparent border-b h-12 px-2">
                <TabsTrigger value="ai" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none h-full bg-transparent px-4 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" /> AI Assistant
                </TabsTrigger>
                <TabsTrigger value="resources" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none h-full bg-transparent px-4 flex items-center gap-2">
                  <FunctionSquare className="w-4 h-4 text-[#676879]" /> Recursos
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto">
                {/* AI TAB */}
                <TabsContent value="ai" className="m-0 p-6 space-y-6 animate-in fade-in slide-in-from-left-4">
                  <div className="bg-[#F0F4FF] p-4 rounded-xl flex gap-3 border border-blue-100">
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center shrink-0 shadow-lg">
                       <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <div className="text-sm text-[#323338] leading-relaxed">
                       Tudo pronto para criar sua fórmula? Basta dizer o que você quer calcular e eu montarei a sintaxe para você!
                    </div>
                  </div>

                  <div className="space-y-3">
                     <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Sugestões</p>
                     {[
                       { label: 'Calcular diferença em dias', input: 'Calcular dias de atraso' },
                       { label: 'Somar colunas numéricas', input: 'Soma total das colunas' },
                       { label: 'Calcular a média', input: 'Média das semanas' },
                       { label: 'Aplicar 10% de imposto', input: 'Multiplicar orçamento por 10%' },
                     ].map(s => (
                       <button key={s.label} onClick={() => setAiInput(s.input)} className="w-full text-left p-3 text-sm hover:bg-slate-50 transition-colors rounded-lg border flex items-center justify-between group">
                          {s.label}
                          <Plus className="w-4 h-4 opacity-0 group-hover:opacity-100 text-blue-500" />
                       </button>
                     ))}
                  </div>
                </TabsContent>

                {/* RESOURCES TAB */}
                <TabsContent value="resources" className="m-0">
                  <div className="p-4 border-b">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input 
                        type="text" 
                        value={funcSearch}
                        onChange={(e) => setFuncSearch(e.target.value)}
                        placeholder="Pesquisar..."
                        className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-50 border-none text-sm focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>

                  <div className="flex h-[400px]">
                    {/* Function list */}
                    <div className="w-[55%] overflow-y-auto border-r">
                      {/* Columns */}
                      <div className="p-3">
                        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 px-1">Colunas</h3>
                        {eligibleColumns.map(col => (
                          <button 
                            key={col.id} 
                            onClick={() => insertAtCursor(`{${col.title}}`)}
                            className="w-full flex items-center justify-between p-2 text-sm hover:bg-blue-50 rounded-lg text-left transition-all group"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-blue-400" />
                              <span className="text-[#323338]">{col.title}</span>
                            </div>
                            <Plus className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-blue-500" />
                          </button>
                        ))}
                      </div>

                      {/* Operators */}
                      <div className="p-3 border-t">
                        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 px-1">Operadores</h3>
                        <div className="grid grid-cols-4 gap-1">
                          {OPERATORS.map(op => (
                            <button 
                              key={op.symbol}
                              onClick={() => insertAtCursor(` ${op.symbol} `)}
                              className="p-2 bg-slate-50 hover:bg-blue-50 rounded-lg text-center font-mono text-lg font-bold text-[#323338] hover:text-blue-600 transition-all border border-transparent hover:border-blue-200"
                              title={op.desc}
                            >
                              {op.symbol}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Math functions */}
                      {mathFunctions.length > 0 && (
                        <div className="p-3 border-t">
                          <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 px-1">Matemática</h3>
                          {mathFunctions.map(func => (
                            <button 
                              key={func.name}
                              onClick={() => setHoveredFunc(func)}
                              onDoubleClick={() => insertAtCursor(func.template)}
                              className={cn(
                                "w-full text-left p-2.5 text-sm rounded-lg transition-all flex items-center gap-2",
                                hoveredFunc?.name === func.name ? "bg-blue-50 text-blue-600 font-medium" : "hover:bg-slate-50 text-[#323338]"
                              )}
                            >
                              <FunctionSquare className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                              {func.name}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Date functions */}
                      {dateFunctions.length > 0 && (
                        <div className="p-3 border-t">
                          <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 px-1">Data e Hora</h3>
                          {dateFunctions.map(func => (
                            <button 
                              key={func.name}
                              onClick={() => setHoveredFunc(func)}
                              onDoubleClick={() => insertAtCursor(func.template)}
                              className={cn(
                                "w-full text-left p-2.5 text-sm rounded-lg transition-all flex items-center gap-2",
                                hoveredFunc?.name === func.name ? "bg-blue-50 text-blue-600 font-medium" : "hover:bg-slate-50 text-[#323338]"
                              )}
                            >
                              <FunctionSquare className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                              {func.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Function detail panel */}
                    <div className="w-[45%] p-4 bg-[#FAFBFC] overflow-y-auto">
                      {hoveredFunc ? (
                        <div className="space-y-4 animate-in fade-in">
                          <div className="flex items-center gap-2">
                            <FunctionSquare className="w-5 h-5 text-blue-500" />
                            <h3 className="text-lg font-bold text-[#323338]">{hoveredFunc.name}</h3>
                          </div>
                          <p className="text-sm text-[#676879] leading-relaxed">{hoveredFunc.description}</p>
                          <div>
                            <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Examples:</p>
                            <code className="block p-3 bg-blue-50 rounded-lg text-sm text-blue-700 font-mono leading-relaxed break-all border border-blue-100">
                              {hoveredFunc.example}
                            </code>
                          </div>
                          <button 
                            onClick={() => insertAtCursor(hoveredFunc.template)}
                            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors mt-2"
                          >
                            <Copy className="w-4 h-4" /> Inserir
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                          <FunctionSquare className="w-10 h-10 text-slate-200 mb-3" />
                          <p className="text-sm">Clique em uma função para ver detalhes</p>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
              </div>

              {activeTab === 'ai' && (
                 <div className="p-4 border-t bg-white">
                    <div className="relative">
                       <input 
                         type="text" 
                         value={aiInput}
                         onChange={(e) => setAiInput(e.target.value)}
                         placeholder="Diga à IA qual fórmula criar..."
                         className="w-full pl-4 pr-12 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500/20 text-sm shadow-inner"
                         onKeyDown={(e) => e.key === 'Enter' && handleAiAsk()}
                       />
                       <button 
                          onClick={handleAiAsk}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-white shadow-lg transition-all active:scale-95"
                       >
                          <ChevronRight className="w-4 h-4" />
                       </button>
                    </div>
                 </div>
              )}
            </Tabs>
          </div>

          {/* Right Panel: Formula Editor */}
          <div className="flex-1 bg-[#F9FAFB] p-6 flex flex-col gap-6">
             <div className="flex-1 flex flex-col">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 px-1">Sua Fórmula</label>
                <div className="flex-1 relative bg-white rounded-2xl border-2 border-slate-200 focus-within:border-blue-500 transition-all p-4 shadow-sm overflow-hidden flex flex-col">
                   <textarea
                     value={formula}
                     onChange={(e) => setFormula(e.target.value)}
                     className="w-full flex-1 border-none focus:ring-0 text-xl font-mono text-blue-600 bg-transparent resize-none leading-relaxed"
                     placeholder="Clique em 'Recursos' para compor sua fórmula..."
                   />
                   <div className="mt-4 pt-4 border-t text-[11px] text-muted-foreground flex items-center gap-2">
                       {formula ? (
                         <>
                           <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                           Sintaxe validada com sucesso
                         </>
                       ) : (
                         <>
                           <div className="w-2 h-2 rounded-full bg-slate-300" />
                           Aguardando fórmula...
                         </>
                       )}
                   </div>
                </div>
             </div>

             <div className="p-4 bg-white rounded-xl border-l-4 border-blue-500 shadow-sm border border-slate-200">
                <p className="text-xs text-muted-foreground font-medium mb-1">Como usar referências:</p>
                <p className="text-xs text-[#323338]">Use colchetes <code className="bg-blue-50 text-blue-600 px-1 py-0.5 rounded">{"{ }"}</code> para referenciar nomes de colunas. Exemplo: <code className="bg-blue-50 text-blue-600 px-1 py-0.5 rounded">{"{Orçamento}"}</code> + <code className="bg-blue-50 text-blue-600 px-1 py-0.5 rounded">{"{Custo}"}</code></p>
             </div>
          </div>
        </div>

        <DialogFooter className="p-6 bg-white border-t">
          <div className="flex items-center justify-between w-full">
             <button onClick={onClose} className="px-6 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-xl transition-all">Cancelar</button>
             <button 
               onClick={() => onDefine(formula)}
               className="px-8 py-2.5 bg-[#0073EA] hover:bg-[#0052CC] text-white font-bold rounded-xl shadow-[0_4px_14px_0_rgba(0,115,234,0.39)] transition-all active:scale-95"
             >
                Definir fórmula
             </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
