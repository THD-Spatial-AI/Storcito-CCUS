import type { FC, ReactNode } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Expandable filter group. */
export const FilterSection: FC<{
  title: string;
  icon: LucideIcon;
  expanded: boolean;
  onToggle: () => void;
  picked: number;
  total: number;
  children: ReactNode;
}> = ({ title, icon: Icon, expanded, onToggle, picked, total, children }) => (
  <div className="overflow-hidden rounded-xl border border-border bg-card">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className={cn(
        "flex w-full items-center gap-3 px-3 py-3.5 text-left transition-colors duration-150 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        expanded && "bg-muted/20",
      )}
    >
      <Icon className={cn("h-3.5 w-3.5 shrink-0", expanded || picked > 0 ? "text-primary" : "text-muted-foreground")} />
      <span className="min-w-0 flex-1 text-sm font-semibold text-foreground">{title}</span>
      {picked > 0 ? (
        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-primary">
          {picked}/{total}
        </span>
      ) : (
        <span className="min-w-6 rounded-md bg-muted px-1.5 py-1 text-center text-xs tabular-nums text-muted-foreground">{total}</span>
      )}
      <ChevronRight
        className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150", expanded && "rotate-90")}
      />
    </button>
    <div
      className={cn(
        "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
        expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
      )}
    >
      <div className="min-h-0 overflow-hidden" inert={!expanded}>
        <div className="space-y-0.5 px-2 pb-2 pt-1">{children}</div>
      </div>
    </div>
  </div>
);
