import { useState, useRef } from 'react';
import { Task, TaskGroup, BoardColumn, GroupColor, ColumnType } from '@/types/board';
import { Clipboard, Check, X, LayoutGrid } from 'lucide-react';
import { toast } from 'sonner';

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (groups: TaskGroup[], columns?: BoardColumn[]) => void;
  existingColumns: BoardColumn[];
}

export default function ImportDialog({ open, onClose, onImport, existingColumns }: ImportDialogProps) {
  const [pasteContent, setPasteContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (!open) return null;

  const handleClose = () => {
    setPasteContent('');
    onClose();
  };

  const handleProcessImport = () => {
    const text = pasteContent.trim();
    if (!text) {
      toast.error('Cole os dados do Excel primeiro.');
      return;
    }

    const rows = text.split('\n').map(r => r.split('\t'));
    if (rows.length < 2) {
      toast.error('Dados insuficientes. Certifique-se de incluir a linha de cabeçalho.');
      return;
    }

    // Capture headers from first row
    const headers = rows[0].map(h => h.trim().toLowerCase());
    
    // Find key indices
    const nameIdx = headers.findIndex(h => h === 'name' || h === 'nome' || h === 'grupo');
    const taskIdx = headers.findIndex(h => h.includes('subitem') || h.includes('tarefa') || h === 'item');
    
    if (taskIdx === -1) {
      toast.error('Não conseguimos identificar a coluna de "Tarefa" ou "Subitem Name".');
      return;
    }

    const groupColors: GroupColor[] = ['blue', 'green', 'purple', 'orange', 'red', 'teal', 'indigo', 'pink', 'grey'];
    const groupMap = new Map<string, TaskGroup>();
    
    // Column Mapping logic
    const dataRows = rows.slice(1);
    const newColumns: BoardColumn[] = [];
    const colToIdxMap: Record<string, number> = {};

    // 1. Identify which columns we need to create/map
    headers.forEach((header, idx) => {
      if (idx === nameIdx || idx === taskIdx || !header) return;
      
      // Try to find existing column by title
      let existingCol = existingColumns.find(c => 
        c.title.toLowerCase() === header || 
        header.includes(c.title.toLowerCase()) ||
        c.title.toLowerCase().includes(header)
      );

      if (existingCol) {
        colToIdxMap[existingCol.id] = idx;
      } else {
        // Create a new column definition if not found
        const type: ColumnType = header.includes('%') || header.includes('percentual') ? 'progress' :
                                header.includes('reais') || header.includes('r$') || header.includes('orçado') ? 'number' : 'text';
        
        const newColId = crypto.randomUUID();
        newColumns.push({
          id: newColId,
          title: rows[0][idx] || header,
          type,
          width: 140,
          position: existingColumns.length + newColumns.length,
          unit: header.includes('orçado') || header.includes('r$') ? 'R$' : undefined
        });
        colToIdxMap[newColId] = idx;
      }
    });

    // 2. Process tasks and groups
    for (const row of dataRows) {
      if (row.length < 2 || (row[taskIdx] || '').trim() === '') continue;
      
      const groupName = nameIdx !== -1 ? (row[nameIdx] || '').trim() : 'Importado';
      const taskName = (row[taskIdx] || '').trim();

      // Skip summary/total rows
      if (taskName.toLowerCase().includes('total') || taskName.toLowerCase().includes('soma')) continue;

      if (!groupMap.has(groupName)) {
        groupMap.set(groupName, {
          id: crypto.randomUUID(),
          title: groupName,
          color: groupColors[groupMap.size % groupColors.length],
          tasks: []
        });
      }

      const currentGroup = groupMap.get(groupName)!;
      const columnValues: Record<string, any> = {};

      // Map values based on identified indices
      Object.entries(colToIdxMap).forEach(([colId, excelIdx]) => {
        const cellVal = (row[excelIdx] || '').trim();
        if (!cellVal || cellVal === '-') {
           columnValues[colId] = null;
           return;
        }

        // Clean value based on column intention (from existing or new)
        const allCols = [...existingColumns, ...newColumns];
        const col = allCols.find(c => c.id === colId);
        
        if (col?.type === 'number' || col?.type === 'progress') {
          const cleanVal = parseFloat(cellVal.replace('%', '').replace('R$', '').replace(/\./g, '').replace(',', '.')) || 0;
          columnValues[colId] = cleanVal;
        } else {
          columnValues[colId] = cellVal;
        }
      });

      const task: Task = {
        id: crypto.randomUUID(),
        name: taskName,
        columnValues,
        orderIndex: currentGroup.tasks.length,
        groupId: currentGroup.id
      };
      currentGroup.tasks.push(task);
    }

    const groups = Array.from(groupMap.values());
    if (groups.length === 0) {
      toast.error('Nenhuma tarefa válida detectada.');
      return;
    }

    setPasteContent('');
    setTimeout(() => {
      onImport(groups, newColumns.length > 0 ? newColumns : undefined);
      toast.success(`Importado com sucesso! Mapeamos ${Object.keys(colToIdxMap).length} colunas.`);
    }, 100);
    
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-8 border-b bg-[#F5F6F8]/50 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[#323338] flex items-center gap-3">
              <LayoutGrid className="w-8 h-8 text-[#0073ea]" />
              Importar do Excel
            </h2>
            <p className="text-slate-500 mt-2">Os dados serão adicionados como novos grupos no quadro atual.</p>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-8 space-y-6">
          <div className="flex items-center gap-4 bg-blue-50 p-4 rounded-xl border border-blue-100">
            <Clipboard className="w-6 h-6 text-blue-500 shrink-0" />
            <div className="text-sm text-blue-800">
              <strong>Dica:</strong> No Excel, selecione suas células → <strong>CTRL+C</strong> → cole abaixo.
            </div>
          </div>

          <div className="relative">
            <div className="absolute -top-3 left-4 px-2 bg-white text-[10px] font-bold text-blue-600 uppercase tracking-widest z-10">
              Área de Colagem
            </div>
            <textarea
              ref={textareaRef}
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              className="w-full h-56 p-6 rounded-2xl bg-slate-50 border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-mono text-xs whitespace-pre overflow-auto resize-none"
              placeholder={"Cole aqui (CTRL+V)...\n\nGRUPO EXEMPLO\nTarefa 1\tValor1\tValor2\nTarefa 2\tValor1\tValor2"}
              autoFocus
            />
            {pasteContent && (
              <div className="absolute bottom-4 right-4">
                <div className="bg-green-500 text-white px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-2 shadow-lg">
                  <Check className="w-3 h-3" />
                  {pasteContent.trim().split('\n').length} linhas
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 border-t flex items-center justify-between">
          <button onClick={handleClose} className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors px-4 py-2">
            Cancelar
          </button>
          <button
            onClick={handleProcessImport}
            disabled={!pasteContent.trim()}
            className="px-8 py-3 bg-[#0073ea] hover:bg-[#0052cc] text-white font-bold rounded-full shadow-xl transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Importar no Quadro Atual
          </button>
        </div>
      </div>
    </div>
  );
}
