import type { FC, ReactNode } from "react";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";

interface QuestionSectionProps {
    /** 1-based index. */
    index: number;
    title: string;
    description?: string;
    /** Tighter map-panel rhythm. */
    compact?: boolean;
    children: ReactNode;
}

/** Numbered question block. */
export const QuestionSection: FC<QuestionSectionProps> = ({ index, title, description, compact = false, children }) => {
    const { t } = useTranslation();

    return (
        // Own stacking context.
        <section className="md-rise relative z-10 focus-within:z-20">
            <div className="flex items-center gap-3" aria-hidden="true">
                <span className="h-px flex-1 bg-border" />
                <span className={cn("rounded-full bg-primary/10 font-semibold text-primary", compact ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-[11px]")}>
                    {t("configurator.wizard.question", { index, defaultValue: "Question {{index}}" })}
                </span>
                <span className="h-px flex-1 bg-border" />
            </div>

            <div className={compact ? "mt-3" : "mt-5"}>
                <h3 className={cn("font-semibold text-foreground", compact ? "text-sm" : "text-base")}>{title}</h3>
                {description && (
                    <p className={cn("mt-1 text-muted-foreground", compact ? "text-xs" : "text-sm")}>{description}</p>
                )}
                <div className={compact ? "mt-2.5" : "mt-4"}>{children}</div>
            </div>
        </section>
    );
};
