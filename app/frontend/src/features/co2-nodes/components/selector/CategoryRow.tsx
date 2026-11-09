import type { FC } from "react";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";

import { checkboxClass } from "./shared";

/** Filter or open. */
export const CategoryRow: FC<{
  label: string;
  total: number;
  picked: number;
  checked: boolean;
  onCheck: () => void;
  onOpen: () => void;
}> = ({ label, total, picked, checked, onCheck, onOpen }) => {
  const { t } = useTranslation();
  return (
    <div className={cn("flex items-center rounded-lg transition-colors duration-150", checked ? "bg-primary/5" : "hover:bg-muted/50")}>
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 px-2 py-2 text-sm text-foreground">
        <input type="checkbox" checked={checked} onChange={onCheck} className={checkboxClass} />
        <span className="min-w-0 flex-1 truncate">{label}</span>
      </label>
      <button
        type="button"
        onClick={onOpen}
        disabled={total === 0}
        aria-label={`${t("co2Nodes.showSites", "Show sites")}: ${label}`}
        className="flex shrink-0 items-center gap-1 rounded-md px-2 py-2 text-xs tabular-nums text-muted-foreground transition-colors duration-150 hover:text-foreground disabled:opacity-40"
      >
        {picked > 0 && <span className="font-semibold text-primary">{picked}/</span>}
        {total.toLocaleString()}
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
