export interface DropdownPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

interface DropdownPositionOptions {
  minWidth: number;
  widthMultiplier?: number;
  maxHeight?: number;
  minUsableHeight?: number;
  gap?: number;
  viewportPadding?: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function getAnchoredDropdownPosition(
  anchor: HTMLElement,
  {
    minWidth,
    widthMultiplier = 1,
    maxHeight = 384,
    minUsableHeight = 160,
    gap = 4,
    viewportPadding = 8,
  }: DropdownPositionOptions
): DropdownPosition {
  const rect = anchor.getBoundingClientRect();
  const viewportLeft = 0;
  const viewportTop = 0;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const viewportRight = viewportLeft + viewportWidth;
  const viewportBottom = viewportTop + viewportHeight;
  const availableWidth = Math.max(0, viewportWidth - viewportPadding * 2);
  const width = Math.min(Math.max(rect.width * widthMultiplier, minWidth), availableWidth);
  const minLeft = viewportLeft + viewportPadding;
  const maxLeft = Math.max(minLeft, viewportRight - width - viewportPadding);
  const left = clamp(rect.left, minLeft, maxLeft);

  const belowTop = rect.bottom + gap;
  const aboveBottom = rect.top - gap;
  const spaceBelow = viewportBottom - belowTop - viewportPadding;
  const spaceAbove = aboveBottom - viewportTop - viewportPadding;
  const belowHasUsableSpace = spaceBelow >= minUsableHeight;
  const belowFitsFullDropdown = spaceBelow >= maxHeight;
  const openAbove = (!belowFitsFullDropdown && spaceAbove > spaceBelow) || (!belowHasUsableSpace && spaceAbove > 0);
  const availableHeight = Math.max(0, openAbove ? spaceAbove : spaceBelow);
  const usableHeight = Math.max(96, Math.min(maxHeight, availableHeight));

  return {
    top: openAbove
      ? Math.max(viewportTop + viewportPadding, aboveBottom - usableHeight)
      : Math.min(belowTop, viewportBottom - viewportPadding - usableHeight),
    left,
    width,
    maxHeight: usableHeight,
  };
}
