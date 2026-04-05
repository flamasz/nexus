export function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  if (i === 0) return `${bytes} B`;
  
  const size = bytes / Math.pow(k, i);
  return `${size.toFixed(size < 10 ? 1 : 0)} ${units[i]}`;
}
