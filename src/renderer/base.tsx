import type { Rect, Transform } from 'canvas-glide';
import type { ViewportRef } from '../Viewport.tsx';
import { type JSX, type Ref } from 'solid-js';
import type { GlideCanvasInstance } from '../useGlideCanvas.ts';

export type CanvasRef<T, C> = {
  getContainerRef?: () => C | null;
  getContentRef?: () => T | null;
  getImageRect?: () => Rect;
  handleViewportResize?: (viewport: ViewportRef) => void;
  draw?: (transform?: Transform) => void;
};

export type RendererComponentProps<T extends HTMLElement> = Omit<
  JSX.HTMLAttributes<T>,
  'style' | 'ref'
> & {
  style?: JSX.CSSProperties;
  ref?: Ref<T>;
};

export type RendererProps<R extends Renderer, T extends HTMLElement, C extends HTMLElement> = {
  content?: RendererComponentProps<T>;
  container?: RendererComponentProps<C>;

  children?: JSX.Element;
  afterDraw?: (transform?: Transform, data?: RendererRef[R]) => void;
};

export type RendererPropsMap = {
  [Renderer.Canvas]: RendererProps<typeof Renderer.Canvas, HTMLCanvasElement, HTMLCanvasElement>;
  [Renderer.Image]: RendererProps<typeof Renderer.Image, HTMLImageElement, HTMLDivElement>;
  [Renderer.Html]: RendererProps<typeof Renderer.Html, HTMLImageElement, HTMLDivElement>;
};

export type BaseRenderConfig<R> = {
  viewportRef?: ViewportRef | null;
  image?: Blob | null;
  lib?: GlideCanvasInstance;
  ref?: Ref<R>;
};
export type RendererConfig<T extends Renderer> = RendererPropsMap[T] & BaseRenderConfig<RendererRef[T]>;

export type RendererRef = {
  [Renderer.Canvas]: CanvasRef<HTMLCanvasElement, HTMLCanvasElement>;
  [Renderer.Image]: CanvasRef<HTMLImageElement, HTMLDivElement>;
  [Renderer.Html]: CanvasRef<HTMLImageElement, HTMLDivElement>;
};

export type Renderer = (typeof Renderer)[keyof typeof Renderer];
export const Renderer = Object.freeze({
  Canvas: 'canvas',
  Image: 'image',
  /** Renders the image as a resized, scrolled `<img>`, not arbitrary HTML. */
  Html: 'html',
} as const);

export type CanvasOptions<T extends Renderer> = RendererPropsMap[T];
