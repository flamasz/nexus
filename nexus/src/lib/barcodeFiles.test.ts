import { describe, expect, it } from 'vitest';

import {
  ACCEPTED_BARCODE_EXTENSIONS,
  extensionOf,
  filterAcceptedBarcodeFiles,
  iconNameForExtension,
} from './barcodeFiles';

function fakeFile(name: string, type = ''): File {
  return new File(['x'], name, { type });
}

describe('ACCEPTED_BARCODE_EXTENSIONS', () => {
  it('includes the agreed image, pdf and vector formats', () => {
    expect(ACCEPTED_BARCODE_EXTENSIONS).toEqual([
      '.png', '.jpg', '.jpeg', '.svg', '.pdf', '.eps', '.ai',
    ]);
  });
});

describe('extensionOf', () => {
  it('returns the lowercase extension for a normal name', () => {
    expect(extensionOf('a.png')).toBe('.png');
  });
  it('normalizes uppercase extensions to lowercase', () => {
    expect(extensionOf('A.PNG')).toBe('.png');
  });
  it('uses the last segment for multi-dot names', () => {
    expect(extensionOf('a.b.pdf')).toBe('.pdf');
  });
  it('returns an empty string when there is no extension', () => {
    expect(extensionOf('noext')).toBe('');
  });
});

describe('filterAcceptedBarcodeFiles', () => {
  it('keeps accepted files and drops the rest', () => {
    const files = [fakeFile('a.png'), fakeFile('b.txt'), fakeFile('c.PDF')];
    const { accepted, rejectedCount } = filterAcceptedBarcodeFiles(files);
    expect(accepted.map((f) => f.name)).toEqual(['a.png', 'c.PDF']);
    expect(rejectedCount).toBe(1);
  });
});

describe('iconNameForExtension', () => {
  it('maps image extensions to FileImage', () => {
    expect(iconNameForExtension('.png')).toBe('FileImage');
    expect(iconNameForExtension('.svg')).toBe('FileImage');
  });
  it('maps pdf to FileText', () => {
    expect(iconNameForExtension('.pdf')).toBe('FileText');
  });
  it('falls back to File for vector/other', () => {
    expect(iconNameForExtension('.ai')).toBe('File');
    expect(iconNameForExtension('.eps')).toBe('File');
    expect(iconNameForExtension('.zzz')).toBe('File');
  });
});
