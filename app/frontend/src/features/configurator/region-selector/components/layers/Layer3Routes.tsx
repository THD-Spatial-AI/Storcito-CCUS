import type { FC } from "react";
import { useTranslation } from "@/i18n";

import { RouteResults } from "@/features/co2-nodes";

import { LayerShell } from "./shared/LayerShell";
import { QuestionSection } from "../wizard";
import type { ConfiguratorContext } from "./types";

/** Connection discovery step. */
export const Layer3Routes: FC<{ ctx: ConfiguratorContext }> = ({ ctx }) => {
  const { t } = useTranslation();
  const { state } = ctx;

  return (
    <LayerShell
      purpose={t(
        "configurator.layer3.purpose",
        "CO2RouteX screens the selected nodes for candidate connections, then routes and costs them.",
      )}
      nextStepHint={t(
        "configurator.layer3.nextStepHint",
        "Next we'll do a final review before saving.",
      )}
    >
      <QuestionSection
        compact
        index={1}
        title={t("configurator.layer3.routesQuestion", "How do they connect?")}
        description={t(
          "configurator.layer3.routesInfo",
          "One route per source-sink pair, by pipeline, truck or railway.",
        )}
      >
        <div data-tour="route-results">
          <RouteResults modelId={ctx.modelId} selectedIds={state.selectedNodeIds} />
        </div>
      </QuestionSection>
    </LayerShell>
  );
};
