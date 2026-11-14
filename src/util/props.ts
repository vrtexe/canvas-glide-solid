/** The element attributes of a renderer's `content` or `container` option; the renderer applies `style` itself and owns `ref`. */
export function attributesOf<T extends { style?: unknown; ref?: unknown }>(options: T | undefined) {
  const { style: _style, ref: _ref, ...attributes } = options ?? ({} as T);
  return attributes;
}
