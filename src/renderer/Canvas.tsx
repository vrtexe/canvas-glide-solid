import { createEffect, onMount, type JSX } from "solid-js";
import { Renderer, type RendererConfig, type RendererRef } from "./base.tsx";
import type { ViewportRef } from "../Viewport.tsx";
import { createAsyncMemo } from "../util/asyncMemo.ts";
import { createImageBitmapSafe } from "../util/image.ts";
import { createIdealScale } from "../util/idealScale.ts";
import { attributesOf } from "../util/props.ts";
import { applyRef } from "../util/ref.ts";
import { type Transform } from "canvas-glide";

export type CanvasRendererProps = RendererConfig<typeof Renderer.Canvas>;

const defaultCanvasStyles: JSX.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  height: "100%",
  width: "100%",
};

export function Canvas(props: CanvasRendererProps) {
  const imageBitmap = createAsyncMemo(
    () => createImageBitmapSafe(props.image),
    () => props.image,
    (bitmap) => bitmap?.close(),
  );

  let canvasRef!: HTMLCanvasElement;
  let canvasContext: CanvasRenderingContext2D | null = null;

  const offscreenCanvas = document.createElement("canvas");

  function applySmoothing(ctx: CanvasRenderingContext2D) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
  }

  onMount(() => {
    canvasContext = canvasRef?.getContext("2d") || null;
    if (canvasContext) applySmoothing(canvasContext);
  });

  const { idealScale, updateIdealScale, getImageRect, fitNext } = createIdealScale(
    () => props.viewportRef,
    () => ({ width: offscreenCanvas.width, height: offscreenCanvas.height }),
    () => props.lib?.fit(),
  );

  createEffect(() => {
    const bitmap = imageBitmap();
    if (!bitmap) {
      offscreenCanvas.width = 0;
      offscreenCanvas.height = 0;
      clear();
      return;
    }

    updateOffscreenCanvas(bitmap);
    fitNext();
    handleViewportResize(props.viewportRef);
    updateIdealScale();

    draw(props.lib?.stateService.getTransform());
  });

  function clear() {
    const ctx = canvasContext;
    if (!canvasRef || !ctx) return;

    ctx.resetTransform();
    ctx.clearRect(0, 0, canvasRef.width, canvasRef.height);
  }

  function draw(transform?: Transform) {
    if (!canvasRef || !transform || !imageBitmap()) return;

    const canvas = canvasRef;
    const scale = transform.scale;
    const originX = transform.origin.x;
    const originY = transform.origin.y;

    const ctx = canvasContext;
    if (!ctx) return;

    // A devicePixelRatio change (window moved to another screen) does not resize the viewport, so check on every draw.
    const viewport = props.viewportRef;
    if (viewport && (canvas.width !== Math.floor(viewport.getWidth()) || canvas.height !== Math.floor(viewport.getHeight()))) {
      updateSize(viewport.getWidth(), viewport.getHeight());
    }

    const dpr = window.devicePixelRatio || 1;

    clear();

    const s = scale * dpr;
    ctx.setTransform(s, 0, 0, s, -originX * s, -originY * s);

    ctx.drawImage(offscreenCanvas, 0, 0, offscreenCanvas.width * idealScale(), offscreenCanvas.height * idealScale());

    props.afterDraw?.(transform, externalRef);
  }

  function redraw() {
    draw(props.lib?.stateService.getTransform());
  }

  function updateOffscreenCanvas(imageBitmap: ImageBitmap) {
    offscreenCanvas.width = imageBitmap.width;
    offscreenCanvas.height = imageBitmap.height;
    const ctx = offscreenCanvas.getContext("2d");
    ctx?.drawImage(imageBitmap, 0, 0);
  }

  function updateSize(width: number, height: number) {
    if (!canvasRef) return;
    canvasRef.width = width;
    canvasRef.height = height; // assigning dimensions resets ALL context state

    if (canvasContext) applySmoothing(canvasContext);

    updateIdealScale();
  }

  function handleViewportResize(viewport?: ViewportRef | null) {
    if (!viewport) return;

    updateSize(viewport.getWidth(), viewport.getHeight());
    redraw();
  }

  const externalRef: RendererRef[typeof Renderer.Canvas] = {
    draw,
    getContainerRef: () => canvasRef ?? null,
    getContentRef: () => canvasRef ?? null,
    handleViewportResize,
    getImageRect: () => getImageRect(canvasRef ?? null),
  };

  applyRef(props.ref, externalRef);

  return (
    <canvas
      style={{ ...defaultCanvasStyles, ...props.container?.style, ...props.content?.style }}
      ref={canvasRef}
      {...attributesOf(props.container)}
      {...attributesOf(props.content)}
    />
  );
}

export default Canvas;
