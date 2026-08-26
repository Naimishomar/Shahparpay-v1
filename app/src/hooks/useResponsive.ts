import { useWindowDimensions } from 'react-native';

/**
 * `themed()` builds its StyleSheets once per palette, so anything that depends
 * on the viewport has to be applied inline. This is that source of truth.
 *
 * Breakpoints match the phone sizes the app actually ships on: a 320pt iPhone
 * SE / small Android cannot fit two cards plus gutters and stay readable, so it
 * drops to a single column.
 *
 * Pure so the column arithmetic can be tested without a renderer.
 */
export function responsiveLayout(width: number, height: number) {
  const isSmall = width < 360; // SE-class phones
  const isPhone = width < 600;
  const isTablet = width >= 600 && width < 900;
  const isWide = width >= 900;

  const columns = isSmall ? 1 : isPhone ? 2 : isTablet ? 3 : 4;
  const gap = isSmall ? 10 : 12;
  const padding = isSmall ? 12 : 16;

  // Pixel width, not a percentage: N columns at `100/N`% plus an N-1 pixel gap
  // overflows the row and silently collapses the grid to one card per line.
  const contentWidth = width - padding * 2;
  const columnWidth = Math.max(0, Math.floor((contentWidth - gap * (columns - 1)) / columns));

  return {
    width,
    height,
    isSmall,
    isPhone,
    isTablet,
    isWide,
    isLandscape: width > height,
    columns,
    columnWidth,
    contentWidth,
    gap,
    padding,
    /** Sidebar must never eat the whole screen on a small phone. */
    sidebarWidth: Math.min(300, Math.round(width * 0.84)),
    /** Scale down the oversized page titles on narrow screens. */
    titleSize: isSmall ? 20 : isPhone ? 22 : 26,
  };
}

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  return responsiveLayout(width, height);
}

export default useResponsive;
