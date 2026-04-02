import { useState, useRef } from 'react';
import { Task, TaskGroup, BoardColumn, GroupColor } from '@/types/board';
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
    if (rows.length < 1) {
      toast.error('Dados insuficientes.');
      return;
    }

    const colsToUse = existingColumns.length > 0 ? existingColumns : undefined;
    const groupColors: GroupColor[] = ['blue', 'green', 'purple', 'orange', 'red', 'teal', 'indigo', 'pink', 'grey'];
    const groups: TaskGroup[] = [];
    let currentGroup: TaskGroup | null = null;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const firstCell = (row[0] || '').trim();
      if (!firstCell) continue;

      // If only 1 non-empty cell and text is long → treat as group header
      const nonEmptyCells = row.filter(c => c.trim().length > 0).length;
      const looksLikeGroup = nonEmptyCells <= 1 && firstCell.length > 3 && isNaN(Number(firstCell));

      if (looksLikeGroup) {
        currentGroup = {
          id: `imp-g-${Date.now()}-${i}`,
          title: firstCell,
          color: groupColors[groups.length % groupColors.length],
          tasks: []
        };
        groups.push(currentGroup);
      } else {
        if (!currentGroup) {
          currentGroup = {
            id: `imp-g-${Date.now()}-default`,
            title: 'Itens Importados',
            color: 'blue',
            tasks: []
          };
          groups.push(currentGroup);
        }

        const columnValues: Record<string, any> = {};
        if (colsToUse) {
          colsToUse.forEach((col, idx) => {
            const cellVal = (row[idx] || '').trim();
            if (col.type === 'number' || col.type === 'progress') {
              columnValues[col.id] = parseFloat(cellVal.replace(/\./g, '').replace(',', '.')) || 0;
            } else if (col.type === 'status') {
              const lower = cellVal.toLowerCase();
              if (lower.includes('conclu') || lower.includes('done')) columnValues[col.id] = 'done';
              else if (lower.includes('progresso') || lower.includes('working')) columnValues[col.id] = 'working';
              else if (lower.includes('trava') || lower.includes('stuck')) columnValues[col.id] = 'stuck';
              else columnValues[col.id] = 'default';
            } else {
              columnValues[col.id] = cellVal;
            }
          });
        } else {
          // no columns yet — store raw values with generic keys
          row.forEach((cell, idx) => {
            columnValues[`col-${idx}`] = cell.trim();
          });
        }

        const task: Task = {
          id: `imp-t-${Date.now()}-${i}`,
          name: firstCell,
          columnValues,
          orderIndex: currentGroup.tasks.length,
          groupId: currentGroup.id
        };
        currentGroup.tasks.push(task);
      }
    }

    if (groups.length === 0 || groups.every(g => g.tasks.length === 0)) {
      toast.error('Nenhuma tarefa detectada. Verifique o formato.');
      return;
    }

    const totalTasks = groups.reduce((a, g) => a + g.tasks.length, 0);

    // Clear state and close FIRST, then import with delay
    setPasteContent('');
    
    // Use setTimeout to ensure this runs AFTER React finishes closing the overlay
    setTimeout(() => {
      onImport(groups);
      toast.success(`Importado! ${groups.length} grupo(s) com ${totalTasks} tarefa(s)`);
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
