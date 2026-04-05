import { ItemStatus } from '@/types/database';
import { ITEM_STATUS_CONFIG } from '@/lib/itemStatus';

interface ItemStatusBadgeProps {
  status: ItemStatus;
}

export function ItemStatusBadge({ status }: ItemStatusBadgeProps) {
  const config = ITEM_STATUS_CONFIG[status];
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full border ${config.bg} ${config.text} ${config.border}`}>
      {config.label}
    </span>
  );
}
