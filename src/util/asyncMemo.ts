import { createEffect, createSignal, onCleanup, type Accessor } from 'solid-js';

/**
 * Async-derived value tied to a reactive dependency.
 *
 * `dispose` releases a produced value when it is replaced, disposed, or
 * arrives after its generation was superseded (e.g. `(bitmap) => bitmap.close()`).
 * Each generation only ever disposes the value IT produced — never a newer
 * generation's. A rejected `asyncFn` resolves the value to null instead of
 * leaking an unhandled rejection.
 */
export function createAsyncMemo<T>(
  asyncFn: () => Promise<T>,
  dependencies: () => unknown,
  dispose?: (value: T) => void,
): Accessor<T | null> {
  const [value, setValue] = createSignal<T | null>(null);

  createEffect(() => {
    dependencies();

    let current = true;
    let produced: T | null = null;

    asyncFn()
      .then((result) => {
        produced = result;
        if (current) {
          setValue(() => result);
        } else if (result) {
          // Resolved after this generation was replaced/disposed.
          dispose?.(result);
          produced = null;
        }
      })
      .catch(() => {
        if (current) setValue(null);
      });

    onCleanup(() => {
      current = false;
      if (produced) {
        dispose?.(produced);
        produced = null;
      }
      setValue(null);
    });
  });

  return value;
}
