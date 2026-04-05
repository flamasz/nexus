import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export { formatHST, formatHSTShort } from './formatHST';
export { formatFileSize } from './formatFileSize';
export { statusConfig, getStatusClasses } from './statusConfig';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function sanitizeFileName(name: string): string {
  return name
    .normalize('NFKD')                     // decompose fullwidth chars to ASCII equivalents
    .replace(/[^\x20-\x7E]/g, '')          // strip remaining non-ASCII
    .replace(/\s+/g, '_')                  // spaces to underscores
    .replace(/[^a-zA-Z0-9._-]/g, '')       // keep only safe chars
    || 'file';                             // fallback if empty
}
