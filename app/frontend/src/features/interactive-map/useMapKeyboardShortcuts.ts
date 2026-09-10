import { useEffect } from 'react';
import type { Map as OlMap } from 'ol';

interface Options {
  /** New-model shortcut. */
  onNewModel?: () => void;
  /** Space: play/pause. */
  onTogglePlay?: () => void;
  /** F: fullscreen. */
  onToggleFullscreen?: () => void;
  /** L: layer visibility. */
  onToggleLayerVisible?: () => void;
}

const ZOOM_STEP = 1;
const PAN_FRACTION = 0.25;

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/** Skip focused buttons. */
function isActivatableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && ['BUTTON', 'A'].includes(el.tagName);
}

/** Map keyboard shortcuts. */
export function useMapKeyboardShortcuts(
  map: OlMap | null,
  {
    onNewModel,
    onTogglePlay,
    onToggleFullscreen,
    onToggleLayerVisible,
  }: Options = {}
) {
  useEffect(() => {
    if (!map) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      const view = map.getView();
      const zoom = view.getZoom();
      const center = view.getCenter();
      const resolution = view.getResolution();
      if (zoom === undefined || !center || resolution === undefined) return;

      const size = map.getSize();
      const panX = size ? size[0] * resolution * PAN_FRACTION : 0;
      const panY = size ? size[1] * resolution * PAN_FRACTION : 0;

      switch (event.key) {
        case '+':
        case '=':
          view.animate({ zoom: zoom + ZOOM_STEP, duration: 200 });
          break;
        case '-':
        case '_':
          view.animate({ zoom: zoom - ZOOM_STEP, duration: 200 });
          break;
        case 'ArrowLeft':
          view.animate({ center: [center[0] - panX, center[1]], duration: 200 });
          break;
        case 'ArrowRight':
          view.animate({ center: [center[0] + panX, center[1]], duration: 200 });
          break;
        case 'ArrowUp':
          view.animate({ center: [center[0], center[1] + panY], duration: 200 });
          break;
        case 'ArrowDown':
          view.animate({ center: [center[0], center[1] - panY], duration: 200 });
          break;
        case 'n':
        case 'N':
          if (!onNewModel) return;
          onNewModel();
          break;
        case ' ':
          if (!onTogglePlay || isActivatableTarget(event.target)) return;
          onTogglePlay();
          break;
        case 'f':
        case 'F':
          if (!onToggleFullscreen) return;
          onToggleFullscreen();
          break;
        case 'l':
        case 'L':
          if (!onToggleLayerVisible) return;
          onToggleLayerVisible();
          break;
        default:
          return;
      }

      event.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [map, onNewModel, onTogglePlay, onToggleFullscreen, onToggleLayerVisible]);
}
