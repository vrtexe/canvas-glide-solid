import type { Ref } from 'solid-js';

/**
 * Forward a value into a Solid ref prop. Function refs (including compiled
 * `ref={variable}` bindings) are called; pre-existing object refs are merged.
 */
export function applyRef<T>(ref: Ref<T> | undefined, value: T) {
  if (ref === undefined) return;

  if (typeof ref === 'function') {
    (ref as (v: T) => void)(value);
  } else {
    Object.assign(ref as T & object, value);
  }
}
