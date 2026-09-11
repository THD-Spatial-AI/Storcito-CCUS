import type { FC } from "react";
import { useTranslation } from "@/i18n";

import { CostResults } from "@/features/co2-nodes";

import { LayerShell } from "./shared/LayerShell";
import { QuestionSection } from "../wizard";
import type { ConfiguratorContext } from "./types";

/** Transport cost step. */
export const Layer4Costs: FC<{ ctx: ConfiguratorContext }> = () => {
  const { t } = useTranslation();

  return (
    <LayerShell
      purpose={t(
        "configurator.layer4.purpose",
        "Pipeline CAPEX scales with route resistance; truck and railway use distance tariffs.",
      )}
      nextStepHint={t(
        "configurator.layer4.nextStepHint",
        "Next we'll do a final review before saving.",
      )}
    >
      <QuestionSection
        compact
        index={1}
        title={t("configurator.layer4.costsQuestion", "What do these routes cost?")}
        description={t(
          "configurator.layer4.costsInfo",
          "Calculated from the routes found in the previous step.",
        )}
      >
        <div data-tour="cost-results">
          <CostResults />
        </div>
      </QuestionSection>
    </LayerShell>
  );
};
