import type { FC } from "react";
import { useTranslation } from "@/i18n";

import { NodeSelector } from "@/features/co2-nodes";

import { LayerShell } from "./shared/LayerShell";
import { QuestionSection } from "../wizard";
import type { ConfiguratorContext } from "./types";

/** Node selection step. */
export const Layer2NodeSelect: FC<{ ctx: ConfiguratorContext }> = ({ ctx }) => {
    const { t } = useTranslation();
    const { state, actions } = ctx;

    return (
        <LayerShell
            purpose={t(
                "configurator.layer2.purpose",
                "Choose the CO₂ sources and sinks this model routes between.",
            )}
            nextStepHint={t(
                "configurator.layer2.nextStepHint",
                "Next CO2RouteX looks for connections between them.",
            )}
        >
            <div>
                <QuestionSection
                    compact
                    index={1}
                    title={t("configurator.layer2.nodesQuestion", "Which nodes should the model use?")}
                    description={t(
                        "configurator.layer2.nodesInfo",
                        "Pick them here or straight from the map.",
                    )}
                >
                    <div data-tour="node-selection">
                        <NodeSelector
                            selectedIds={state.selectedNodeIds}
                            onChange={actions.setSelectedNodeIds}
                        />
                    </div>
                </QuestionSection>

            </div>
        </LayerShell>
    );
};
