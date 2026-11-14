import { type JSX } from "solid-js";
import type { Transform } from "canvas-glide";
import { Renderer, type RendererConfig, type RendererRef } from "./base.tsx";
import { createAsyncMemo } from "../util/asyncMemo.ts";
import { createImageUrlSafe, revokeImageUrl } from "../util/image.ts";
import { createIdealScale } from "../util/idealScale.ts";
import { attributesOf } from "../util/props.ts";
import { applyRef } from "../util/ref.ts";

export type HtmlRendererProps = RendererConfig<typeof Renderer.Html>;

/**
 * Scroll-based renderer: no CSS transforms and no <canvas>.
 * Zoom resizes the <img> element itself (the browser re-rasterizes at the
 * layout size, so it stays sharp — unlike transformed layers on Safari) and
 * pan is a programmatic scroll of an overflow:hidden box (an element does not
 * need visible scrollbars to be scrollable via scrollTo). The img's padding
 * carries one viewport of slack on every side — a scroll range only exists
 * where a descendant box occupies it, and padding is part of the img's border
 * box — so the image can be panned fully off-screen in every direction.
 */
export function HtmlCanvas(props: HtmlRendererProps) {
  let scrollerRef!: HTMLDivElement;
  let imgRef!: HTMLImageElement;

  const imageSrc = createAsyncMemo(
    () => createImageUrlSafe(props.image),
    () => props.image,
    revokeImageUrl,
  );

  const { idealScale, updateIdealScale, getImageRect } = createIdealScale(
    () => props.viewportRef,
    () => (imgRef ? { width: imgRef.naturalWidth, height: imgRef.naturalHeight } : null),
  );

  function draw(transform?: Transform) {
    const scroller = scrollerRef;
    const img = imgRef;
    const viewport = props.viewportRef;
    if (!transform || !scroller || !img?.naturalWidth || !viewport) return;

    const { scale, origin } = transform;
    const width = img.naturalWidth * idealScale() * scale;
    const height = img.naturalHeight * idealScale() * scale;

    // One viewport of slack on every side of the image, carried by the
    // img's own padding (box-sizing: content-box, so width stays the
    // image size). The image can be panned fully off-screen before the
    // scroll range clamps, and negative origins (image smaller than the
    // viewport, centered) are representable as scroll positions.
    const padX = viewport.getClientWidth();
    const padY = viewport.getClientHeight();

    img.style.width = `${width}px`;
    img.style.height = `${height}px`;
    img.style.padding = `${padY}px ${padX}px`;
    scroller.scrollTo(padX + origin.x * scale, padY + origin.y * scale);

    props.afterDraw?.(transform, externalRef);
  }

  function redraw() {
    draw(props.lib?.stateService.getTransform());
  }

  function handleViewportResize() {
    updateIdealScale();
    redraw();
  }

  function onImageLoad() {
    updateIdealScale();

    props.lib?.fit();
    redraw();
  }

  const externalRef: RendererRef[typeof Renderer.Html] = {
    getContainerRef: () => scrollerRef ?? null,
    getContentRef: () => imgRef ?? null,
    draw,
    handleViewportResize,
    getImageRect: () => getImageRect(scrollerRef ?? null),
  };

  applyRef(props.ref, externalRef);

  const scrollerStyle: JSX.CSSProperties = {
    width: "100%",
    height: "100%",
    overflow: "hidden",
    position: "relative",
  };

  const imageStyle: JSX.CSSProperties = {
    display: "block",
    "box-sizing": "content-box",
  };

  return (
    <div style={{ ...scrollerStyle, ...props.container?.style }} ref={scrollerRef} {...attributesOf(props.container)}>
      <img
        ref={imgRef}
        src={imageSrc() || undefined}
        style={{ ...imageStyle, ...props.content?.style }}
        draggable={false}
        onLoad={onImageLoad}
        {...attributesOf(props.content)}
      />
      {props.children}
    </div>
  );
}
