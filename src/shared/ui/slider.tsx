import * as SliderPrimitive from "@radix-ui/react-slider";
import type { ComponentProps } from "react";
import { cn } from "@/shared/lib/cn";

interface SliderProps extends ComponentProps<typeof SliderPrimitive.Root> {
  /** Accessible name of the thumb, e.g. `Progress for “Write specs”`. */
  label: string;
  /** Spoken value, e.g. "60%". */
  valueText?: string;
  rangeClassName?: string;
}

export function Slider({ className, label, valueText, rangeClassName, ...props }: SliderProps) {
  return (
    <SliderPrimitive.Root
      className={cn("relative flex w-full touch-none items-center py-2 select-none", className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-slate-200">
        <SliderPrimitive.Range className={cn("absolute h-full bg-sky-600", rangeClassName)} />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={label}
        aria-valuetext={valueText}
        className="block size-5 cursor-grab rounded-full border-2 border-sky-700 bg-white shadow transition-shadow focus-visible:ring-4 focus-visible:ring-sky-300 focus-visible:outline-none active:cursor-grabbing"
      />
    </SliderPrimitive.Root>
  );
}
