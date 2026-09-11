import {
    FileText,
    Network,
    Waypoints,
    Coins,
    ClipboardCheck,
    Save,
} from "lucide-react";
import type { ReactNode } from "react";

interface LayerDef {
    id: number;
    title: string;
    subtitle: string;
    titleKey: string;
    subtitleKey: string;
    icon: ReactNode;
}

export const LAYERS: LayerDef[] = [
    { id: 1, title: "Model Initialization", subtitle: "Name and simulation timeframe", titleKey: "configurator.registry.layer1Title", subtitleKey: "configurator.registry.layer1Subtitle", icon: <FileText className="w-4 h-4" /> },
    { id: 2, title: "Node Selection", subtitle: "Pick the CO2 sources and sinks", titleKey: "configurator.registry.layer2Title", subtitleKey: "configurator.registry.layer2Subtitle", icon: <Network className="w-4 h-4" /> },
    { id: 3, title: "Routes", subtitle: "Find connections between the nodes", titleKey: "configurator.registry.layer3Title", subtitleKey: "configurator.registry.layer3Subtitle", icon: <Waypoints className="w-4 h-4" /> },
    { id: 4, title: "Costs", subtitle: "Transport cost per connection", titleKey: "configurator.registry.layer4Title", subtitleKey: "configurator.registry.layer4Subtitle", icon: <Coins className="w-4 h-4" /> },
    { id: 5, title: "Final Review", subtitle: "Sanity check before run", titleKey: "configurator.registry.layer5Title", subtitleKey: "configurator.registry.layer5Subtitle", icon: <ClipboardCheck className="w-4 h-4" /> },
    { id: 6, title: "Save & Calculate", subtitle: "Persist and start the run", titleKey: "configurator.registry.layer6Title", subtitleKey: "configurator.registry.layer6Subtitle", icon: <Save className="w-4 h-4" /> },
];

export const LAYER_COUNT = LAYERS.length;
