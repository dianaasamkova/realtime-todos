import { fireEvent } from "@testing-library/react";

/** Moves a slider to `value` with the keyboard, one step per key press, as a user could. */
export function moveSlider(slider: HTMLElement, value: number) {
  const current = Number(slider.getAttribute("aria-valuenow"));
  const key = value > current ? "ArrowRight" : "ArrowLeft";
  for (let i = 0; i < Math.abs(value - current); i++) fireEvent.keyDown(slider, { key });
}
