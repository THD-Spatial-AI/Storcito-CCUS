/** Step layout split. */

/** Node-step panel width. */
export const MAP_STEP_PANEL_WIDTH = 360;

/** Map share. */
const SIDEBAR_MAP_RATIO = 0.5;

/** Content plus padding. */
const SIDEBAR_PANEL_MAX_WIDTH = 832;

/** Panel width. */
export const SIDEBAR_PANEL_WIDTH_CSS = `min(${(1 - SIDEBAR_MAP_RATIO) * 100}%, ${SIDEBAR_PANEL_MAX_WIDTH}px)`;

/** Visible map width. */
export const sidebarMapWidth = (mapWidth: number): number =>
    Math.round(mapWidth - Math.min(mapWidth * (1 - SIDEBAR_MAP_RATIO), SIDEBAR_PANEL_MAX_WIDTH));
