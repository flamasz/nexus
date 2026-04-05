import { ItemStatus } from '@/types/database';

export const ITEM_STATUS_CONFIG: Record<ItemStatus, {
  label: string;
  bg: string;
  text: string;
  border: string;
}> = {
  new: {
    label: 'New',
    bg: 'bg-warning-subtle',
    text: 'text-warning',
    border: 'border-warning/30',
  },
  in_progress: {
    label: 'In Progress',
    bg: 'bg-info-subtle',
    text: 'text-info',
    border: 'border-info/30',
  },
  approved: {
    label: 'Approved',
    bg: 'bg-success-subtle',
    text: 'text-success',
    border: 'border-success/30',
  },
  superceded: {
    label: 'Superceded',
    bg: 'bg-destructive-subtle',
    text: 'text-destructive',
    border: 'border-destructive/30',
  },
} as const;

export const ITEM_STATUS_OPTIONS: ItemStatus[] = ['new', 'in_progress', 'approved', 'superceded'];
