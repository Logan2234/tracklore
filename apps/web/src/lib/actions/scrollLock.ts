// Generic Svelte action: locks page scroll for as long as the node stays
// mounted. Reference-counted so overlapping lockers (e.g. a report Modal
// opened from within a focused comment) don't fight over restoring the
// previous value when one of them unmounts before the other.
let lockCount = 0;
let previousOverflow = "";

export function scrollLock(_node: HTMLElement) {
  if (lockCount === 0) {
    previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
  }

  lockCount++;

  return {
    destroy() {
      lockCount--;

      if (lockCount === 0) {
        document.documentElement.style.overflow = previousOverflow;
      }
    },
  };
}
