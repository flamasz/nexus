export const ACCEPTED_BARCODE_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.svg', '.pdf', '.eps', '.ai',
] as const;

export function extensionOf(fileName: string): string {
  const parts = fileName.split('.');
  if (parts.length < 2) return '';
  return '.' + parts.pop()!.toLowerCase();
}

export function filterAcceptedBarcodeFiles(
  files: File[]
): { accepted: File[]; rejectedCount: number } {
  const accepted = files.filter((file) =>
    (ACCEPTED_BARCODE_EXTENSIONS as readonly string[]).includes(extensionOf(file.name))
  );
  return { accepted, rejectedCount: files.length - accepted.length };
}

export type BarcodeIconName = 'FileImage' | 'FileText' | 'File';

export function iconNameForExtension(ext: string): BarcodeIconName {
  const lower = ext.toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.svg'].includes(lower)) return 'FileImage';
  if (lower === '.pdf') return 'FileText';
  return 'File';
}
