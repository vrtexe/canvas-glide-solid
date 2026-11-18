import type { Rect } from 'canvas-glide';
import type { ViewportRef } from '../Viewport.tsx';

export type ContentSize = { width: number; height: number };

/**
 * Shared contain-fit state for renderers: `idealScale` maps the content's
 * natural size to the viewport at engine scale 1, so engine origins are
 * expressed in the same scale-1 frame for every renderer. After `fitNext`, the
 * next update with a measured viewport also calls `fit`, so a new image is
 * fitted once even when it loads while the viewport is hidden or unmeasured;
 * later resizes keep the view.
 */
export function createIdealScale(
  getViewport: () => ViewportRef | null | undefined,
  getContentSize: () => ContentSize | null,
  fit: () => void,
) {
  let idealScale = 1;
  let fitPending = false;

  function updateIdealScale() {
    const viewport = getViewport();
    const size = getContentSize();
    if (!viewport || !size?.width || !size?.height) {
      idealScale = 1;
      return;
    }

    idealScale = Math.min(
      viewport.getClientWidth() / size.width,
      viewport.getClientHeight() / size.height,
    );
    if (fitPending && idealScale) {
      fitPending = false;
      fit();
    }
  }

  /** The scale-1 content frame — what the engine's getCanvasRect expects. */
  function getImageRect(element: { offsetLeft: number; offsetTop: number } | null): Rect {
    const size = getContentSize();
    return {
      x: element?.offsetLeft || 0,
      y: element?.offsetTop || 0,
      width: (size?.width || 0) * idealScale,
      height: (size?.height || 0) * idealScale,
    };
  }

  return { idealScale: () => idealScale, updateIdealScale, getImageRect, fitNext: () => (fitPending = true) };
}
