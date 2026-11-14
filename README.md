# @canvas-glide/solid

Solid components for [canvas-glide](https://github.com/vrtexe/canvas-glide): pan, zoom and pinch-to-zoom for an image, or for any content you render, with mouse, touch, pen and wheel input.

[![npm version](https://img.shields.io/npm/v/@canvas-glide/solid.svg?style=flat-square)](https://www.npmjs.com/package/@canvas-glide/solid)
[![license](https://img.shields.io/npm/l/@canvas-glide/solid.svg?style=flat-square)](LICENSE.md)

The package has two layers. `GlideCanvas` is a ready image viewer: give it a `Blob` and it shows the image fitted to its box, with drag to pan, wheel and pinch to zoom, and a ref for zoom buttons. `useGlideCanvas` and `Viewport` are the parts `GlideCanvas` is built from; use them to pan and zoom your own content. The package re-exports everything from `canvas-glide`, so one import covers the engine API too.

## Install

```sh
npm install @canvas-glide/solid
```

`canvas-glide` is a dependency and installs with it. `solid-js` 1.9 is a peer dependency.

## Image viewer

```tsx
import { createSignal } from 'solid-js';
import { GlideCanvas, Renderer, type GlideCanvasRef } from '@canvas-glide/solid';

export function Viewer() {
  const [file, setFile] = createSignal<File | null>(null);
  let viewer!: GlideCanvasRef;

  return (
    <>
      <input type="file" accept="image/*" onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)} />
      <button onClick={() => viewer.zoomIn()}>+</button>
      <button onClick={() => viewer.zoomOut()}>−</button>
      <button onClick={() => viewer.fit()}>Fit</button>

      <div style={{ width: '800px', height: '500px' }}>
        <GlideCanvas ref={viewer} renderer={Renderer.Image} image={file()} />
      </div>
    </>
  );
}
```

`GlideCanvas` fills its parent, so the parent needs a size. At scale 1 the image is fitted inside the box with its aspect ratio kept, and `fit()` returns to that view. By default the image can be panned until it just leaves the box, and no further.

## Renderers

`renderer` picks how the image is drawn. All three use the same engine and the same coordinates; a renderer calls `fit()` when its image has loaded, so switching renderers starts from the fitted view.

| Renderer | How it draws | `canvasConfig.children` |
|---|---|---|
| `Renderer.Canvas` (default) | Draws the decoded bitmap into a `<canvas>` sized in device pixels. | Not rendered. |
| `Renderer.Image` | Moves and scales an `<img>` with a CSS `transform`. | Rendered inside the transformed box, so overlays move and scale with the image. |
| `Renderer.Html` | Resizes the `<img>` to the zoomed size and scrolls its container, with no CSS transform, so the browser rasterizes the image at its displayed size. | Rendered after the `<img>` inside the scrolled container. |

## `GlideCanvas` props

| Prop | Type | Usage |
|---|---|---|
| `image` | `Blob \| null` | The image to show. A `File` from an `<input type="file">` is a `Blob`. `null` clears the view. The image and HTML renderers load PNG, JPEG, GIF, WebP, AVIF and BMP through a `blob:` URL and every other type, such as SVG, through a `data:` URL, so a script inside an uploaded SVG cannot run in your page's origin. |
| `renderer` | `Renderer` | `Renderer.Canvas` (default), `Renderer.Image` or `Renderer.Html`. |
| `config` | engine options | The `canvas-glide` options except the two rect getters, which `GlideCanvas` supplies: `state`, `move`, `scale` and `constraints`. |
| `viewportConfig` | `ViewportOptions` | Props for the outer `<div>`; see [Viewport](#viewport). |
| `canvasConfig` | renderer options | `content` (props for the `<img>` or `<canvas>`), `container` (props for the wrapping element; for the canvas renderer, also the `<canvas>`), `children`, and `afterDraw(transform, ref)`, called after each frame. A renderer chosen at runtime cannot take `canvasConfig`. |
| `ref` | `GlideCanvasRef` | Every engine method (`zoomIn`, `zoomOut`, `zoomTo`, `panTo`, `fit`, `center`, `reset`, `getTransform`, ...) plus `viewportRef` and `canvasRef`. |

The engine methods are documented in the [canvas-glide README](https://github.com/vrtexe/canvas-glide#methods).

`GlideCanvas` redraws once per animation frame. It calls `config.state.onTransformChange` once per frame with a copy of the transform, while `onScaleChange` and `onOriginChange` run on every input event. The callbacks in `config` and everything in `canvasConfig` follow prop changes; `move.enabled`, `scale`, `constraints` and `state.initial` are read when the component is created.

## Your own content

`useGlideCanvas` creates the engine, and `Viewport` is the element that receives the input. This example pans and zooms a 1200 by 800 pixel `<div>`:

```tsx
import { useGlideCanvas, Viewport, type ViewportRef } from '@canvas-glide/solid';

export function Board() {
  let viewport!: ViewportRef;
  let content!: HTMLDivElement;

  const glide = useGlideCanvas({
    getViewportRect: () => viewport?.getRect() ?? null,
    getCanvasRect: () => ({ x: 0, y: 0, width: 1200, height: 800 }),
    state: {
      onTransformChange: ({ origin, scale }) => {
        content.style.transform = `translate(${-origin.x * scale}px, ${-origin.y * scale}px) scale(${scale})`;
      },
    },
  });

  return (
    <Viewport ref={viewport} lib={glide} style={{ width: '800px', height: '500px' }}>
      <div ref={content} style={{ width: '1200px', height: '800px', 'transform-origin': '0 0' }}>
        Your content
      </div>
    </Viewport>
  );
}
```

`useGlideCanvas` adds an origin limit that keeps the content reachable, and passing `config.constraints.origin` replaces it. A Solid component body runs once, so the options are read when the engine is created; callbacks that need current values should read them when they are called.

## Viewport

`Viewport` renders a `<div>` with `overflow: hidden`, `touch-action: none`, `user-select: none` and `overscroll-behavior: contain`, and attaches the engine's pointer handlers and a non-passive wheel listener. It accepts every `<div>` attribute, and these:

| Prop | Default | Usage |
|---|---|---|
| `lib` | none | The object returned by `useGlideCanvas`. |
| `onResize` | none | Called with the `ViewportRef` when the element's size changes. |
| `pointerDownEnabled`, `pointerMoveEnabled`, `pointerUpEnabled`, `pointerCancelEnabled` | `true` | `false` leaves that pointer event to the page. |
| `wheelEnabled` | `true` | `false` removes the wheel listener, so the wheel does not zoom. It follows changes after mount. |

Its ref, `ViewportRef`, has `getElement()`, `getRect()` (the element's client rectangle, read on each call), `getClientWidth()` and `getClientHeight()` in CSS pixels, and `getWidth()` and `getHeight()` in device pixels.

## Development

`canvas-glide` is listed twice: `^1.0.1` in `dependencies` for consumers, and `../lib` in `devDependencies`, which npm links during local development. Build `lib` first, then:

```sh
npm install
npm test
npm run build
```

`npm test` runs the Vitest suite in `test/` in jsdom, with the 2D context, `createImageBitmap` and `ResizeObserver` stubbed. `npm run build` type-checks with `tsc -b` and writes `dist/` with Vite: `canvas-glide.js` (ES module) and the type declarations.

## License

MIT, see [LICENSE.md](LICENSE.md).
