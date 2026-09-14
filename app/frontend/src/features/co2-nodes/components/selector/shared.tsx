import type { FC, ReactNode } from "react";
import { cn } from "@/lib/utils";

import type { FluxRange } from "../../stores/nodeFilterStore";

export const formatFlux = (annualFlux: number | null): string =>
  annualFlux && annualFlux > 0
    ? `${(annualFlux / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} kt/yr`
    : "";

export const sameRange = (a: FluxRange, b: FluxRange): boolean =>
  a.min === b.min && a.max === b.max;

/** Height-animated expand/collapse. */
export const Collapsible: FC<{ expanded: boolean; children: ReactNode }> = ({
  expanded,
  children,
}) => (
  <div
    className={cn(
      "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
      expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
    )}
  >
    <div className="min-h-0 overflow-hidden">{children}</div>
  </div>
);

/** Checkbox row chrome. */
export const rowClass = (checked: boolean) =>
  cn(
    "flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs text-foreground transition-colors duration-150",
    checked ? "bg-primary/5" : "hover:bg-muted/50",
  );

export const checkboxClass = "h-3.5 w-3.5 shrink-0 rounded border-border accent-foreground";
