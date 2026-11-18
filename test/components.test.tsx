// @vitest-environment jsdom
import { afterEach, test } from "vitest";
import assert from "node:assert/strict";
import { createSignal, type JSX } from "solid-js";
import { render } from "solid-js/web";
import {
  GlideCanvas,
  Renderer,
  Viewport,
  useGlideCanvas,
  type GlideCanvasInstance,
  type GlideCanvasOptions,
  type GlideCanvasRef,
  type ViewportRef,
} from "../src/canvas-glide.ts";

// jsdom has no layout, no ResizeObserver, no 2D context and no createImageBitmap.
const resizeCallbacks = new Set<() => void>();
globalThis.ResizeObserver = class {
  constructor(private callback: () => void) {}
  observe() {
    resizeCallbacks.add(this.callback);
  }
  unobserve() {}
  disconnect() {
    resizeCallbacks.delete(this.callback);
  }
} as unknown as typeof ResizeObserver;
let layout = { width: 1000, height: 700 };
Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => layout.width });
Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => layout.height });
Element.prototype.scrollTo ??= () => {};
globalThis.createImageBitmap = (async () => ({ width: 300, height: 300, close() {} })) as unknown as typeof createImageBitmap;

type FakeContext = { calls: string[] };
const contexts = new WeakMap<HTMLCanvasElement, FakeContext>();
HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
  if (!contexts.has(this)) {
    const calls: string[] = [];
    contexts.set(this, {
      calls,
      resetTransform: () => calls.push("reset"),
      clearRect: () => calls.push("clear"),
      setTransform: () => calls.push("transform"),
      drawImage: () => calls.push("draw"),
    } as FakeContext);
  }
  return contexts.get(this);
} as unknown as HTMLCanvasElement["getContext"];

const setDevicePixelRatio = (value: number) =>
  Object.defineProperty(window, "devicePixelRatio", { configurable: true, value });

let dispose: (() => void) | undefined;
let host: HTMLElement | undefined;

afterEach(() => {
  dispose?.();
  host?.remove();
  dispose = undefined;
  setDevicePixelRatio(1);
  layout = { width: 1000, height: 700 };
});

function mount(component: () => JSX.Element) {
  host = document.body.appendChild(document.createElement("div"));
  dispose = render(component, host);
}

/** Lets pending promises (image decoding) and one animation frame run. */
async function settle() {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

function glideWith(config: GlideCanvasOptions) {
  let glide!: GlideCanvasInstance;
  mount(() => {
    glide = useGlideCanvas(config);
    return null;
  });
  return glide;
}

const rects = {
  getViewportRect: () => ({ x: 0, y: 0, width: 800, height: 600 }),
  getCanvasRect: () => ({ x: 0, y: 0, width: 400, height: 300 }),
};

test("a scale range in config.constraints keeps the default origin limit", () => {
  const glide = glideWith({ ...rects, constraints: { scale: { constraints: [1, 4] } } });

  glide.zoomTo(10);
  glide.panTo({ x: 5000, y: 5000 });

  assert.equal(glide.getScale(), 4);
  assert.deepEqual(glide.getOrigin(), { x: 400, y: 300 });
});

test("config.constraints.origin replaces the default origin limit", () => {
  const origin = { constraints: { x: [0, 10], y: [0, 10] } as { x: [number, number]; y: [number, number] } };
  const glide = glideWith({ ...rects, constraints: { origin } });

  glide.panTo({ x: 5000, y: 5000 });

  assert.deepEqual(glide.getOrigin(), { x: 10, y: 10 });
});

test("Viewport.getRect reads the element's position on every call", () => {
  let viewport!: ViewportRef;
  mount(() => <Viewport ref={viewport} />);
  const element = viewport.getElement()!;

  let left = 0;
  element.getBoundingClientRect = () => ({ x: left, y: 0, width: 100, height: 100 }) as DOMRect;
  assert.equal(viewport.getRect()!.x, 0);

  left = 150;
  assert.equal(viewport.getRect()!.x, 150);
});

test("wheelEnabled turned off after mount removes the wheel listener", async () => {
  let wheels = 0;
  const lib = { onWheel: () => wheels++ } as unknown as GlideCanvasInstance;
  const [enabled, setEnabled] = createSignal(true);
  let viewport!: ViewportRef;
  mount(() => <Viewport ref={viewport} lib={lib} wheelEnabled={enabled()} />);
  await settle();

  viewport.getElement()!.dispatchEvent(new WheelEvent("wheel"));
  setEnabled(false);
  viewport.getElement()!.dispatchEvent(new WheelEvent("wheel"));

  assert.equal(wheels, 1);
});

test("the canvas renderer clears the canvas when the image is removed", async () => {
  const [image, setImage] = createSignal<Blob | null>(new Blob(["x"], { type: "image/png" }));
  mount(() => <GlideCanvas image={image()} />);
  await settle();
  const calls = contexts.get(host!.querySelector("canvas")!)!.calls;
  assert.ok(calls.includes("draw"));

  calls.length = 0;
  setImage(null);
  await settle();

  assert.ok(calls.includes("clear"));
  assert.ok(!calls.includes("draw"));
});

test("the canvas renderer resizes its backing store when devicePixelRatio changes", async () => {
  let glide!: GlideCanvasRef;
  mount(() => <GlideCanvas ref={glide} image={new Blob(["x"], { type: "image/png" })} />);
  await settle();
  const canvas = host!.querySelector("canvas")!;
  assert.equal(canvas.width, 1000);

  setDevicePixelRatio(2);
  glide.zoomIn();
  await settle();

  assert.equal(canvas.width, 2000);
  assert.equal(canvas.height, 1400);
});

test("the image renderer shows an SVG through a data: URL", async () => {
  mount(() => (
    <GlideCanvas renderer={Renderer.Image} image={new Blob(["<svg xmlns='http://www.w3.org/2000/svg'/>"], { type: "image/svg+xml" })} />
  ));
  await settle();

  assert.match(host!.querySelector("img")!.getAttribute("src") ?? "", /^data:image\/svg\+xml;base64,/);
});

test("renderer content and container options stay reactive after mount", async () => {
  const [color, setColor] = createSignal("red");
  mount(() => (
    <GlideCanvas
      renderer={Renderer.Image}
      canvasConfig={{ content: { style: { outline: `1px solid ${color()}` } }, container: { class: color() } }}
    />
  ));
  await settle();

  setColor("blue");
  await settle();

  assert.equal(host!.querySelector("img")!.style.outline, "1px solid blue");
  assert.equal(host!.querySelector("img")!.parentElement!.className, "blue");
});

/** Mounts a GlideCanvas whose viewport reports `layout` as its rectangle; img renderers get a 300×300 natural size. */
async function mountLoaded(renderer: Renderer) {
  let glide!: GlideCanvasRef;
  mount(() => <GlideCanvas ref={glide} renderer={renderer} image={new Blob(["x"], { type: "image/png" })} />);
  glide.viewportRef!.getElement()!.getBoundingClientRect = () => ({ x: 0, y: 0, ...layout }) as DOMRect;
  await settle();
  const img = host!.querySelector("img");
  if (img) {
    Object.defineProperties(img, { naturalWidth: { value: 300 }, naturalHeight: { value: 300 } });
    img.dispatchEvent(new Event("load"));
    await settle();
  }
  return glide;
}

function resize(size: { width: number; height: number }) {
  layout = size;
  resizeCallbacks.forEach((callback) => callback());
}

for (const renderer of Object.values(Renderer)) {
  test(`the ${renderer} renderer fits an image that loaded before the viewport had a size once it has one`, async () => {
    layout = { width: 0, height: 0 };
    const glide = await mountLoaded(renderer);

    resize({ width: 1000, height: 700 });
    await settle();

    // A 300×300 image contained in 1000×700 is 700×700, centered horizontally.
    assert.deepEqual(glide.getTransform(), { scale: 1, origin: { x: -150, y: 0 } });
  });
}

test("a resize after the image was fitted keeps the current view", async () => {
  const glide = await mountLoaded(Renderer.Canvas);
  glide.panTo({ x: 10, y: 20 });

  resize({ width: 800, height: 600 });
  await settle();

  assert.deepEqual(glide.getOrigin(), { x: 10, y: 20 });
});
