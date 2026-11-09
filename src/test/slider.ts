import { fireEvent } from "@testing-library/react";

/** Moves a slider to `value` the way a pointer drag would end. */
export function moveSlider(slider: HTMLElement, value: number) {
  fireEvent.change(slider, { target: { value } });
}
