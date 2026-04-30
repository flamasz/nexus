import { ItemStatus } from '@/types/database';

export const ITEM_STATUS_CONFIG: Record<ItemStatus, {
  label: string;
  bg: string;
  text: string;
  border: string;
}> = {
  new: {
    label: 'New',
    bg: 'bg-amber-100 dark:bg-warning-subtle',
    text: 'text-amber-700 dark:text-warning',
    border: 'border-amber-300 dark:border-warning/30',
  },
  in_progress: {
    label: 'In Progress',
    bg: 'bg-sky-100 dark:bg-info-subtle',
    text: 'text-sky-700 dark:text-info',
    border: 'border-sky-300 dark:border-info/30',
  },
  approved: {
    label: 'Approved',
    bg: 'bg-green-100 dark:bg-success-subtle',
    text: 'text-green-700 dark:text-success',
    border: 'border-green-300 dark:border-success/30',
  },
  superceded: {
    label: 'Superceded',
    bg: 'bg-red-100 dark:bg-destructive-subtle',
    text: 'text-red-700 dark:text-destructive',
    border: 'border-red-300 dark:border-destructive/30',
  },
} as const;

export const ITEM_STATUS_OPTIONS: ItemStatus[] = ['new', 'in_progress', 'approved', 'superceded'];
