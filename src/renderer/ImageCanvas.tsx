import { createEffect, createSignal, type JSX } from 'solid-js';
import { type Transform } from 'canvas-glide';
import { Renderer, type RendererConfig, type RendererRef } from './base.tsx';
import type { ViewportRef } from '../Viewport.tsx';
import { createAsyncMemo } from '../util/asyncMemo.ts';
import { createImageUrlSafe, revokeImageUrl } from '../util/image.ts';
import { createIdealScale } from '../util/idealScale.ts';
import { attributesOf } from '../util/props.ts';
import { applyRef } from '../util/ref.ts';

export type ImageRendererProps = RendererConfig<typeof Renderer.Image>;

const defaultImageCanvasStyle: JSX.CSSProperties = {
  position: 'relative',
  'transform-origin': 'top left',
} as const;

const defaultImageStyle: JSX.CSSProperties = {
  display: 'block',
  height: '100%',
  width: '100%',
};

export function ImageCanvas(props: ImageRendererProps) {
  let canvasRef!: HTMLDivElement;
  let imgRef!: HTMLImageElement;

  const [imageVisibility, setImageVisibility] =
    createSignal<JSX.CSSProperties['visibility']>('hidden');

  const imageSrc = createAsyncMemo(
    () => createImageUrlSafe(props.image),
    () => props.image,
    revokeImageUrl,
  );

  const { idealScale, updateIdealScale, getImageRect } = createIdealScale(
    () => props.viewportRef,
    () => (imgRef ? { width: imgRef.naturalWidth, height: imgRef.naturalHeight } : null),
  );

  // The transform is written imperatively — pan/zoom never touches reactive
  // state. `content.style` must therefore not set `transform`; the renderer
  // owns it.
  function draw(transform?: Transform) {
    if (!transform || !canvasRef) return;
    canvasRef.style.transform = `scale(${transform.scale}) translate(${-transform.origin.x}px, ${-transform.origin.y}px)`;
    props.afterDraw?.(transform, externalRef);
  }

  function redraw() {
    draw(props.lib?.stateService.getTransform());
  }

  function updateSize() {
    if (!canvasRef || !imgRef) return;
    const { naturalWidth, naturalHeight } = imgRef;
    canvasRef.style.width = `${naturalWidth * idealScale()}px`;
    canvasRef.style.height = `${naturalHeight * idealScale()}px`;
  }

  function handleViewportResize(viewport?: ViewportRef | null) {
    if (!viewport) return;

    updateIdealScale();
    updateSize();
    redraw();
  }

  function onImageLoad() {
    updateIdealScale();
    updateSize();

    // Content is measurable now — center the freshly loaded image. fit() only
    // emits when the transform actually changes, so redraw explicitly too.
    props.lib?.fit();
    redraw();
    setImageVisibility('visible');
  }

  // Data-URL/cached images can finish loading before the onLoad listener is
  // attached — the event is then never delivered and the image would stay
  // hidden. Run the load handler manually when already complete.
  createEffect(() => {
    imageSrc();
    if (imgRef?.complete && imgRef.naturalWidth) {
      onImageLoad();
    }
  });

  const externalRef: RendererRef[typeof Renderer.Image] = {
    getContainerRef: () => canvasRef ?? null,
    getContentRef: () => imgRef ?? null,
    draw,
    handleViewportResize,
    getImageRect: () => getImageRect(canvasRef ?? null),
  };

  applyRef(props.ref, externalRef);

  return (
    <div
      ref={canvasRef}
      style={{ ...defaultImageCanvasStyle, ...props.container?.style }}
      {...attributesOf(props.container)}
    >
      <img
        hidden={!imageSrc()}
        style={{ ...defaultImageStyle, visibility: imageVisibility(), ...props.content?.style }}
        ref={imgRef}
        src={imageSrc() || undefined}
        draggable={false}
        onLoad={onImageLoad}
        {...attributesOf(props.content)}
      />
      {props.children}
    </div>
  );
}
