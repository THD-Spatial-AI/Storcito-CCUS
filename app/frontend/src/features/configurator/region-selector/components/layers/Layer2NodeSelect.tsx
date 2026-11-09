import type { FC } from "react";
import { useTranslation } from "@/i18n";

import { NodeSelector } from "@/features/co2-nodes";

import { LayerShell } from "./shared/LayerShell";
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
                "Next STORE_CO2 looks for connections between them.",
            )}
        >
            <section className="space-y-5">
                <header>
                    <h3 className="text-lg font-semibold tracking-tight text-foreground">
                        {t("configurator.layer2.nodesQuestion", "Which nodes should the model use?")}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {t("configurator.layer2.nodesInfo", "Pick them here or straight from the map.")}
                    </p>
                </header>
                <div data-tour="node-selection">
                    <NodeSelector selectedIds={state.selectedNodeIds} onChange={actions.setSelectedNodeIds} />
                </div>
            </section>
        </LayerShell>
    );
};
