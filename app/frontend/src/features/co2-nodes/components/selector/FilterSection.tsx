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
  <div
    className={cn(
      "overflow-hidden rounded-xl border bg-card transition-colors duration-150",
      expanded ? "border-border shadow-sm" : "border-border hover:border-foreground/20",
    )}
  >
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-muted/50"
    >
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors duration-150",
          expanded ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1 text-xs font-semibold text-foreground">{title}</span>
      {picked > 0 && (
        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
          {picked}/{total}
        </span>
      )}
      <ChevronRight
        className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform duration-150", expanded && "rotate-90")}
      />
    </button>
    <div
      className={cn(
        "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
        expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="space-y-0.5 border-t border-border/60 px-2.5 pb-2.5 pt-2">{children}</div>
      </div>
    </div>
  </div>
);
