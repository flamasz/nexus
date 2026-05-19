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

function getScrollableParent(element: HTMLElement): HTMLElement | null {
  let current = element.parentElement;

  while (current) {
    const style = window.getComputedStyle(current);
    const overflowY = style.overflowY;
    const canScroll = (overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight;

    if (canScroll) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

function getPageVerticalBounds(anchor: HTMLElement) {
  const scrollParent = getScrollableParent(anchor);

  if (scrollParent) {
    const rect = scrollParent.getBoundingClientRect();

    return {
      top: rect.top - scrollParent.scrollTop,
      bottom: rect.top + scrollParent.scrollHeight - scrollParent.scrollTop,
    };
  }

  const documentElement = document.documentElement;

  return {
    top: -window.scrollY,
    bottom: documentElement.scrollHeight - window.scrollY,
  };
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
  const viewportWidth = window.innerWidth;
  const viewportRight = viewportLeft + viewportWidth;
  const pageBounds = getPageVerticalBounds(anchor);
  const availableWidth = Math.max(0, viewportWidth - viewportPadding * 2);
  const width = Math.min(Math.max(rect.width * widthMultiplier, minWidth), availableWidth);
  const minLeft = viewportLeft + viewportPadding;
  const maxLeft = Math.max(minLeft, viewportRight - width - viewportPadding);
  const left = clamp(rect.left, minLeft, maxLeft);

  const belowTop = rect.bottom + gap;
  const aboveBottom = rect.top - gap;
  const spaceBelow = pageBounds.bottom - belowTop - viewportPadding;
  const spaceAbove = aboveBottom - pageBounds.top - viewportPadding;
  const openAbove = spaceBelow < minUsableHeight && spaceAbove > spaceBelow;
  const availableHeight = openAbove ? spaceAbove : spaceBelow;
  const usableHeight = Math.max(96, Math.min(maxHeight, availableHeight));

  return {
    top: openAbove ? Math.max(pageBounds.top + viewportPadding, aboveBottom - usableHeight) : belowTop,
    left,
    width,
    maxHeight: usableHeight,
  };
}
