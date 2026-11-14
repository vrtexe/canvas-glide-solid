import type { CanvasEngine, CanvasEngineOptions } from 'canvas-glide';
import { createEngine } from 'canvas-glide';
import { createConstrainer } from './util/constraint.ts';

export type GlideCanvasOptions = CanvasEngineOptions;

export type GlideCanvasInstance = CanvasEngine & {
  engine: CanvasEngine;

  onPointerDown: (e: PointerEvent) => void;
  onPointerMove: (e: PointerEvent) => void;
  onPointerUp: (e: PointerEvent) => void;
  onWheel: (e: WheelEvent) => void;
};

/**
 * Component-scoped engine. A Solid component body runs once, so the engine is
 * created once with no memo/ref ceremony — but the option callbacks the caller
 * passes should read live values lazily (e.g. `props.config?.state?.on...`),
 * since this options object is only ever consumed at creation time.
 */
export function useGlideCanvas(config: GlideCanvasOptions): GlideCanvasInstance {
  const constrainer = createConstrainer({
    getViewportRect: () => config.getViewportRect(),
    getCanvasRect: () => config.getCanvasRect(),
    getScale: () => engine.getScale(),
  });

  const engine = createEngine({
    ...config,
    constraints: {
      ...config.constraints,
      origin: config.constraints?.origin ?? { enabled: true, constrain: constrainer },
    },
  });

  return {
    ...engine,
    engine,

    onPointerDown: engine.event.onPointerDown,
    onPointerMove: engine.event.onPointerMove,
    onPointerUp: engine.event.onPointerUp,
    onWheel: engine.event.onWheel,
  };
}
