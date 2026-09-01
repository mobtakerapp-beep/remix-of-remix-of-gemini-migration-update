/** Small shared preference: hide the cartoon mascots (for older students). */
const KEY = "slc:hide-mascots";
const EVENT = "slc:hide-mascots-changed";

export const DESIGNER_CREDIT_AR = "تصميم مروة أبوبكر";
export const DESIGNER_CREDIT_EN = "Designed by Marwa Aboubakr";

export function getHideMascots(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setHideMascots(value: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, value ? "1" : "0");
  } catch {
    /* storage may be unavailable */
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function subscribeHideMascots(listener: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
