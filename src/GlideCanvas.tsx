import { createSignal, onCleanup, type Component, type Ref } from "solid-js";
import { Dynamic } from "solid-js/web";
import { copyTransform } from "canvas-glide";
import { useGlideCanvas, type GlideCanvasInstance, type GlideCanvasOptions } from "./useGlideCanvas.ts";
import { Viewport, type ViewportRef, type ViewportOptions } from "./Viewport.tsx";
import { Canvas } from "./renderer/Canvas.tsx";
import { ImageCanvas } from "./renderer/ImageCanvas.tsx";
import { HtmlCanvas } from "./renderer/HtmlCanvas.tsx";
import { Renderer, type CanvasOptions, type RendererConfig, type RendererRef } from "./renderer/base.tsx";
import { applyRef } from "./util/ref.ts";

const RendererComponentMap: { [T in Renderer]: Component<RendererConfig<T>> } = {
  [Renderer.Canvas]: Canvas,
  [Renderer.Image]: ImageCanvas,
  [Renderer.Html]: HtmlCanvas,
};

export type BaseGlideCanvasRef<R> = GlideCanvasInstance & {
  viewportRef?: ViewportRef | null;
  canvasRef?: R | null;
};
export type GlideCanvasRef<T extends Renderer = Renderer> = BaseGlideCanvasRef<RendererRef[T]>;

export type BaseGlideCanvasProps = {
  config?: Omit<GlideCanvasOptions, "getViewportRect" | "getCanvasRect">;
  viewportConfig?: ViewportOptions;
  image?: Blob | null;
  ref?: Ref<GlideCanvasRef>;
};

/**
 * Discriminated union over `renderer`: call sites with a literal renderer get
 * their exact canvasConfig checked. The last arm supports a runtime-decided
 * renderer (e.g. tab switching); it cannot accept canvasConfig, because no
 * single config shape fits all renderers. For fully custom rendering, compose
 * the primitives directly: useGlideCanvas + Viewport + your own component.
 */
export type GlideCanvasProps =
  | (BaseGlideCanvasProps & {
      renderer?: typeof Renderer.Canvas;
      canvasConfig?: CanvasOptions<typeof Renderer.Canvas>;
    })
  | (BaseGlideCanvasProps & {
      renderer: typeof Renderer.Image;
      canvasConfig?: CanvasOptions<typeof Renderer.Image>;
    })
  | (BaseGlideCanvasProps & {
      renderer: typeof Renderer.Html;
      canvasConfig?: CanvasOptions<typeof Renderer.Html>;
    })
  | (BaseGlideCanvasProps & {
      renderer: Renderer;
      canvasConfig?: undefined;
    });

export function GlideCanvas(props: GlideCanvasProps) {
  let viewportRef: ViewportRef | undefined;
  let canvasRef: RendererRef[Renderer] | null = null;
  let drawRafId: number | null = null;

  // A function ref instead of a bare binding: each renderer's specific
  // CanvasRef assigns soundly INTO the union-typed variable.
  const setCanvasRef = (instance: RendererRef[Renderer]) => {
    canvasRef = instance;
  };

  const [isMoving, setIsMoving] = createSignal(false);

  const lib = useGlideCanvas({
    ...props.config,
    getViewportRect: () => viewportRef?.getRect() || null,
    getCanvasRect: () => canvasRef?.getImageRect?.() || null,
    move: {
      ...props.config?.move,
      onIsMovingChange(isMoving) {
        setIsMoving(isMoving);
        props.config?.move?.onIsMovingChange?.(isMoving);
      },
    },
    state: {
      ...props.config?.state,
      onTransformChange() {
        scheduleDraw();
      },
      onScaleChange: (scale) => props.config?.state?.onScaleChange?.(scale),
      onOriginChange: (origin) => props.config?.state?.onOriginChange?.(origin),
    },
  });

  // Draws are rAF-coalesced: bursts (several wheel events per frame) collapse
  // to one paint. The consumer's onTransformChange fires once per frame with a
  // COPY of the latest transform — unlike onScaleChange/onOriginChange, which
  // stay synchronous per event.
  function scheduleDraw() {
    if (drawRafId !== null) return; // one already queued
    drawRafId = requestAnimationFrame(() => {
      drawRafId = null;
      const transform = lib.stateService.getTransform();
      canvasRef?.draw?.(transform);
      props.config?.state?.onTransformChange?.(copyTransform(transform));
    });
  }

  onCleanup(() => {
    if (drawRafId !== null) cancelAnimationFrame(drawRafId);
  });

  function onViewportResize(viewport: ViewportRef) {
    canvasRef?.handleViewportResize?.(viewport);
    props.viewportConfig?.onResize?.(viewport);
  }

  applyRef(props.ref, {
    ...lib,
    get viewportRef() {
      return viewportRef ?? null;
    },
    get canvasRef() {
      return canvasRef;
    },
  });

  return (
    <Viewport
      ref={(r) => (viewportRef = r)}
      lib={lib}
      {...props.viewportConfig}
      style={{
        cursor: isMoving() ? "grabbing" : lib.isPanEnabled() ? "grab" : "default",
        ...props.viewportConfig?.style,
      }}
      onResize={onViewportResize}
    >
      <Dynamic
        component={RendererComponentMap[props.renderer ?? Renderer.Canvas]}
        viewportRef={viewportRef}
        ref={setCanvasRef}
        lib={lib}
        image={props.image}
        {...props.canvasConfig}
      />
    </Viewport>
  );
}
