import { TaskStatus, TaskPriority, STATUS_LABELS, PRIORITY_LABELS } from '@/types/board';
import { cn } from '@/lib/utils';

const statusClasses: Record<TaskStatus, string> = {
  done: 'bg-status-done',
  working: 'bg-status-working',
  stuck: 'bg-status-stuck',
  default: 'bg-status-default',
};

const priorityClasses: Record<TaskPriority, string> = {
  critical: 'bg-priority-critical',
  high: 'bg-priority-high',
  medium: 'bg-priority-medium',
  low: 'bg-priority-low',
};

export function StatusBadge({ status, onClick }: { status: TaskStatus; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1 rounded text-xs font-medium text-card min-w-[100px] text-center transition-opacity hover:opacity-80",
        statusClasses[status]
      )}
    >
      {STATUS_LABELS[status]}
    </button>
  );
}

export function PriorityBadge({ priority, onClick }: { priority: TaskPriority; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1 rounded text-xs font-medium text-card min-w-[80px] text-center transition-opacity hover:opacity-80",
        priorityClasses[priority]
      )}
    >
      {PRIORITY_LABELS[priority]}
    </button>
  );
}
