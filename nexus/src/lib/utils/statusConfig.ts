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
    bgColor: 'bg-info-subtle',
    textColor: 'text-info',
    borderColor: 'border-info/30',
  },
  approved: {
    label: 'Approved',
    bgColor: 'bg-success-subtle',
    textColor: 'text-success',
    borderColor: 'border-success/30',
  },
  rejected: {
    label: 'Rejected',
    bgColor: 'bg-destructive-subtle',
    textColor: 'text-destructive',
    borderColor: 'border-destructive/30',
  },
};

export function getStatusClasses(status: UploadStatus): string {
  const config = statusConfig[status];
  return `${config.bgColor} ${config.textColor} ${config.borderColor}`;
}
