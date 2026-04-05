export function formatDimensions(
  width: number | null,
  height: number | null,
  depth: number | null,
  unit: string
): string {
  if (width === null && height === null && depth === null) {
    return 'No dimensions';
  }
  const w = width !== null ? `W${width}` : 'W-';
  const h = height !== null ? `H${height}` : 'H-';
  const d = depth !== null ? `D${depth}` : 'D-';
  return `${w} × ${h} × ${d} ${unit}`;
}
