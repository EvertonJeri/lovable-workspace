import { Task, TaskStatus, TaskPriority, STATUS_LABELS, PRIORITY_LABELS } from '@/types/board';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StatusBadge, PriorityBadge } from './StatusBadge';
import { Calendar, User, Flag, Tag } from 'lucide-react';

interface TaskDialogProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (task: Task) => void;
}

const statusOptions: TaskStatus[] = ['default', 'working', 'stuck', 'done'];
const priorityOptions: TaskPriority[] = ['low', 'medium', 'high', 'critical'];

export default function TaskDialog({ task, open, onClose, onUpdate }: TaskDialogProps) {
  if (!task) return null;

  const cycleStatus = () => {
    const idx = statusOptions.indexOf(task.status);
    const next = statusOptions[(idx + 1) % statusOptions.length];
    onUpdate({ ...task, status: next });
  };

  const cyclePriority = () => {
    const idx = priorityOptions.indexOf(task.priority);
    const next = priorityOptions[(idx + 1) % priorityOptions.length];
    onUpdate({ ...task, priority: next });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">{task.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <DetailRow icon={Tag} label="Status">
            <StatusBadge status={task.status} onClick={cycleStatus} />
          </DetailRow>

          <DetailRow icon={Flag} label="Prioridade">
            <PriorityBadge priority={task.priority} onClick={cyclePriority} />
          </DetailRow>

          <DetailRow icon={User} label="Responsável">
            {task.assignee ? (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">
                  {task.assignee.name.split(' ').map(n => n[0]).join('')}
                </div>
                <span className="text-sm text-foreground">{task.assignee.name}</span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Não atribuído</span>
            )}
          </DetailRow>

          <DetailRow icon={Calendar} label="Prazo">
            <span className="text-sm text-foreground">
              {task.startDate && task.endDate
                ? `${task.startDate} → ${task.endDate}`
                : 'Sem data definida'}
            </span>
          </DetailRow>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2 w-28 shrink-0">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      {children}
    </div>
  );
}
