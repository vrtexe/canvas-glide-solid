import {
  type Ref,
  type JSX,
  type ParentProps,
  onCleanup,
  onMount,
  mergeProps,
  splitProps,
  createEffect,
} from 'solid-js';

import type { GlideCanvasInstance } from './useGlideCanvas.ts';
import { attachWheelEvent } from './util/event.ts';
import { applyRef } from './util/ref.ts';

export type ViewportRef = {
  getElement: () => HTMLDivElement | null;
  /** Width in CSS pixels. */
  getClientWidth: () => number;
  /** Height in CSS pixels. */
  getClientHeight: () => number;
  getRect: () => DOMRect | null;
  /** Width in device pixels (CSS pixels × devicePixelRatio). */
  getWidth: () => number;
  /** Height in device pixels (CSS pixels × devicePixelRatio). */
  getHeight: () => number;
};

export type ViewportOptions = Omit<JSX.HTMLAttributes<HTMLDivElement>, 'style' | 'ref' | 'onResize'> & {
  style?: JSX.CSSProperties;

  onResize?: (ref: ViewportRef) => void;

  pointerDownEnabled?: boolean;
  pointerMoveEnabled?: boolean;
  pointerUpEnabled?: boolean;
  pointerCancelEnabled?: boolean;
  wheelEnabled?: boolean;
};

export type ViewportProps = ViewportOptions & {
  ref?: Ref<ViewportRef>;
  lib?: GlideCanvasInstance;
};

const defaultStyle: JSX.CSSProperties = {
  width: '100%',
  height: '100%',
  position: 'relative',
  background: 'transparent',
  overflow: 'hidden',
  'user-select': 'none',
  'touch-action': 'none',
  'overscroll-behavior': 'contain',
};

export function Viewport(props: ParentProps<ViewportProps>) {
  const p = mergeProps(
    {
      pointerDownEnabled: true,
      pointerMoveEnabled: true,
      pointerUpEnabled: true,
      pointerCancelEnabled: true,
      wheelEnabled: true,
    },
    props,
  );
  const [, rest] = splitProps(p, [
    'ref',
    'lib',
    'children',
    'style',
    'class',
    'onResize',
    'pointerDownEnabled',
    'pointerMoveEnabled',
    'pointerUpEnabled',
    'pointerCancelEnabled',
    'wheelEnabled',
  ]);

  let elementRef!: HTMLDivElement;

  function getViewportWidth() {
    if (!elementRef) return 0;
    return elementRef.clientWidth * (window.devicePixelRatio || 1);
  }

  function getViewportHeight() {
    if (!elementRef) return 0;
    return elementRef.clientHeight * (window.devicePixelRatio || 1);
  }

  createEffect(() => {
    if (p.lib?.onWheel === undefined || p.wheelEnabled === false) return;
    const detach = attachWheelEvent(elementRef, p.lib.onWheel, { passive: false });
    if (detach) onCleanup(detach);
  });

  onMount(() => {
    const ro = new ResizeObserver(() => p.onResize?.(dataRef));
    ro.observe(elementRef);
    onCleanup(() => ro.disconnect());
  });

  const dataRef: ViewportRef = {
    getElement: () => elementRef ?? null,
    getClientWidth: () => elementRef?.clientWidth || 0,
    getClientHeight: () => elementRef?.clientHeight || 0,
    getWidth: getViewportWidth,
    getHeight: getViewportHeight,
    getRect: () => elementRef?.getBoundingClientRect() ?? null,
  };

  // Hand the ref out synchronously (NOT in onMount): children evaluate after
  // this line, and their setup captures the handle. Members are lazy, so
  // reading before mount is safe.
  applyRef(p.ref, dataRef);

  return (
    <div
      ref={elementRef}
      class={p.class}
      style={{ ...defaultStyle, ...p.style }}
      onPointerDown={p.pointerDownEnabled ? p.lib?.onPointerDown : undefined}
      onPointerMove={p.pointerMoveEnabled ? p.lib?.onPointerMove : undefined}
      onPointerUp={p.pointerUpEnabled ? p.lib?.onPointerUp : undefined}
      onPointerCancel={p.pointerCancelEnabled ? p.lib?.onPointerUp : undefined}
      {...rest}
    >
      {p.children}
    </div>
  );
}
