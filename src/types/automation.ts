import { ColumnType } from './board';

export type AutomationTrigger = 
  | 'on_status_change' 
  | 'on_date_reached' 
  | 'on_item_created' 
  | 'on_column_value_change';

export type AutomationAction = 
  | 'move_to_group' 
  | 'notify_user' 
  | 'update_column' 
  | 'create_subitem';

export interface Automation {
  id: string;
  boardId: string;
  name: string;
  isActive: boolean;
  trigger: {
    type: AutomationTrigger;
    columnId?: string;
    value?: any;
  };
  condition?: {
    operator: 'equals' | 'greater_than' | 'less_than' | 'contains';
    value: any;
  };
  action: {
    type: AutomationAction;
    params: Record<string, any>;
  };
}
