import { UploadStatus } from '@/types/database';

interface StatusConfig {
  label: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}

export const statusConfig: Record<UploadStatus, StatusConfig> = {
  uploaded: {
    label: 'Uploaded',
    bgColor: 'bg-sky-100 dark:bg-info-subtle',
    textColor: 'text-sky-700 dark:text-info',
    borderColor: 'border-sky-300 dark:border-info/30',
  },
  approved: {
    label: 'Approved',
    bgColor: 'bg-green-100 dark:bg-success-subtle',
    textColor: 'text-green-700 dark:text-success',
    borderColor: 'border-green-300 dark:border-success/30',
  },
  rejected: {
    label: 'Rejected',
    bgColor: 'bg-red-100 dark:bg-destructive-subtle',
    textColor: 'text-red-700 dark:text-destructive',
    borderColor: 'border-red-300 dark:border-destructive/30',
  },
};

export function getStatusClasses(status: UploadStatus): string {
  const config = statusConfig[status];
  return `${config.bgColor} ${config.textColor} ${config.borderColor}`;
}
