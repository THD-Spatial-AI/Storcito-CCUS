import { useCallback, useEffect, useMemo, useRef, useState, type FC, type ChangeEvent } from "react";
import { useParams } from "react-router-dom";
import { parseDate } from "@internationalized/date";
import { useTranslation } from "@/i18n";

import { AreaSelectTour } from "@/features/guided-tour";
import { useAreaSelect, type AreaData } from "@/features/configurator/hooks/useAreaSelect";
import { useWizardSteps } from "@/features/configurator/hooks/area-select/useWizardSteps";
import { useNodeOLLayers, useNodesQuery, useFitToNodes, filterNodes, useNodeFilterStore, EMITTER_COLOR, SINK_COLOR, TRANSPORT_COLOR } from "@/features/co2-nodes";
import { MAP_STEP_PANEL_WIDTH, WizardStepBar } from "./components/wizard";
import { CreateWorkspaceModal, useWorkspaceStore, type Workspace } from "@/components/workspace";
import { useDocumentTitle } from "@/hooks/use-document-title";
import Notification from "@/components/ui/Notification";
import { MapContainer } from "@/components/shared/MapContainer";
import { useMapStore } from "@/features/interactive-map";
import { cn } from "@/lib/utils";

import { MapHeader } from "./components/MapHeader";
import { LayerStepper } from "./components/LayerStepper";

/** Clears the panel. */
const NODE_FIT_PADDING: [number, number, number, number] = [48, 48, 48, MAP_STEP_PANEL_WIDTH + 48];

const DATE_BOUNDS = { minYear: 2015, maxYear: 2025 };

const getDateBounds = () => ({
  minValue: parseDate(`${DATE_BOUNDS.minYear}-01-01`),
  maxValue: parseDate(`${DATE_BOUNDS.maxYear}-12-31`),
  minYear: DATE_BOUNDS.minYear,
  maxYear: DATE_BOUNDS.maxYear,
});

interface AreaSelectProps {
  onAreaSelected?: (areaData: AreaData) => void;
  onCancel?: () => void;
  editMode?: boolean;
  existingModelId?: number;
}

export const AreaSelect: FC<AreaSelectProps> = ({
  onAreaSelected,
  onCancel,
  editMode = false,
  existingModelId,
}) => {
  useDocumentTitle(editMode ? "Edit Model" : "New Model");
  const { t } = useTranslation();
  const params = useParams();

  const routeModelId = Number.parseInt(params.id ?? "", 10);
  const modelIdFromRoute = Number.isFinite(routeModelId) ? routeModelId : undefined;

  const passedWorkspaceId = Number.parseInt(params.workspaceId ?? "", 10);
  const normalizedWorkspaceId = Number.isFinite(passedWorkspaceId) ? passedWorkspaceId : undefined;

  const currentWorkspace = useWorkspaceStore((s) => s.currentWorkspace);
  const preferredWorkspaceId = useWorkspaceStore((s) => s.preferredWorkspaceId);
  const isLoadingPreference = useWorkspaceStore((s) => s.isLoading);
  const setCurrentWorkspace = useWorkspaceStore((s) => s.setCurrentWorkspace);
  const initializeWorkspace = useWorkspaceStore((s) => s.initializeWorkspace);

  const [isCreateWsOpen, setIsCreateWsOpen] = useState(false);
  const [wsReloadKey, setWsReloadKey] = useState(0);
  const [tourRequestedStep, setTourRequestedStep] = useState<number | null>(null);

  useEffect(() => {
    initializeWorkspace();
  }, [initializeWorkspace]);

  useEffect(() => {
    if (!isLoadingPreference) {
      setTimeout(() => setWsReloadKey((prev) => prev + 1), 0);
    }
  }, [isLoadingPreference, preferredWorkspaceId]);

  const handleWorkspaceChange = useCallback(
    (workspace: Workspace | null) => setCurrentWorkspace(workspace),
    [setCurrentWorkspace],
  );

  const { state, actions, notification } = useAreaSelect({
    onAreaSelected,
    onCancel,
    editMode,
    existingModelId,
  });

  const wizard = useWizardSteps(editMode);
  const { data: nodes = [] } = useNodesQuery();
  const nodeCountryFilter = useNodeFilterStore((s) => s.countries);
  const nodeStateFilter = useNodeFilterStore((s) => s.states);
  const nodeMunicipalityFilter = useNodeFilterStore((s) => s.municipalities);
  const nodeEmitterFilter = useNodeFilterStore((s) => s.emitterCategories);
  const nodeSinkFilter = useNodeFilterStore((s) => s.sinkCategories);
  const nodeFluxRange = useNodeFilterStore((s) => s.fluxRange);
  // Mirrors the filters.
  const mapNodes = useMemo(
    () =>
      filterNodes(nodes, {
        countries: nodeCountryFilter,
        states: nodeStateFilter,
        municipalities: nodeMunicipalityFilter,
        emitterCategories: nodeEmitterFilter,
        sinkCategories: nodeSinkFilter,
        fluxRange: nodeFluxRange,
      }),
    [
      nodes,
      nodeCountryFilter,
      nodeStateFilter,
      nodeMunicipalityFilter,
      nodeEmitterFilter,
      nodeSinkFilter,
      nodeFluxRange,
    ],
  );
  const map = useMapStore((mapState) => mapState.map);

  const handleModelNameChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => actions.setModelName(event.target.value),
    [actions],
  );

  const toggleNode = useCallback(
    (nodeId: number) => {
      const next = new Set(state.selectedNodeIds);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      actions.setSelectedNodeIds([...next]);
    },
    [actions, state.selectedNodeIds],
  );

  const handleTourStepHandled = useCallback(() => setTourRequestedStep(null), []);

  const handleTourComplete = useCallback(() => {
    actions.handleTourComplete();
    setTourRequestedStep(null);
  }, [actions]);

  const selectedNodeCount = state.selectedNodeIds.length;
  const isMapStep = wizard.step === 2;
  const isMapSidebar = wizard.step > 2 && selectedNodeCount > 0;
  const showsMap = wizard.hasStarted && (isMapStep || isMapSidebar);

  // Picks only.
  const visibleNodes = useMemo(() => {
    if (isMapStep) return mapNodes;
    const picked = new Set(state.selectedNodeIds);
    return mapNodes.filter((node) => picked.has(node.id));
  }, [isMapStep, mapNodes, state.selectedNodeIds]);

  useNodeOLLayers({ map, nodes: visibleNodes, selectedIds: state.selectedNodeIds, onToggle: toggleNode });

  // Hides loading canvas.
  const [revealVeil, setRevealVeil] = useState(false);
  const [veilFading, setVeilFading] = useState(false);
  const prevShowsMap = useRef(false);
  useEffect(() => {
    if (showsMap && !prevShowsMap.current) setRevealVeil(true);
    prevShowsMap.current = showsMap;
  }, [showsMap]);
  useEffect(() => {
    if (!revealVeil) return;
    const raf = requestAnimationFrame(() => setVeilFading(true));
    const done = window.setTimeout(() => {
      setRevealVeil(false);
      setVeilFading(false);
    }, 900);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(done);
    };
  }, [revealVeil]);

  // Open on everything.
  useFitToNodes({ map, nodes, enabled: showsMap, padding: NODE_FIT_PADDING });

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      <Notification
        isOpen={notification.data.open}
        message={notification.data.message}
        severity={notification.data.severity}
        onClose={notification.hide}
      />

      <MapHeader
        steps={
          wizard.hasStarted ? (
            <WizardStepBar
              step={wizard.step}
              completed={wizard.completed}
              editMode={editMode}
              onJump={wizard.jumpTo}
            />
          ) : undefined
        }
        selectedNodeCount={selectedNodeCount}
        onClearNodes={() => actions.setSelectedNodeIds([])}
        isLoadingPreference={isLoadingPreference}
        wsReloadKey={wsReloadKey}
        currentWorkspace={currentWorkspace}
        preferredWorkspaceId={preferredWorkspaceId ?? undefined}
        normalizedWorkspaceId={normalizedWorkspaceId}
        onWorkspaceChange={handleWorkspaceChange}
        onOpenCreateWorkspace={() => setIsCreateWsOpen(true)}
      />

      <div className="relative flex-1 overflow-hidden">
        <MapContainer
          modal={false}
          showSidebar={false}
          topBar={null}
          mapHeader={null}
          hideMapControls={!showsMap}
          mapOverlays={
            showsMap ? (
              <div className="pointer-events-none absolute bottom-4 right-4 z-20 flex flex-col gap-1.5 rounded-xl border border-border bg-card/95 px-3 py-2 text-[11px] text-muted-foreground shadow-lg backdrop-blur-md">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: EMITTER_COLOR }} />
                  {t("co2Nodes.legend.emitters", "Emission sources")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SINK_COLOR }} />
                  {t("co2Nodes.legend.sinks", "Storage & utilisation")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-5" style={{ backgroundColor: TRANSPORT_COLOR }} />
                  {t("co2Nodes.legend.routes", "Candidate transport routes")}
                </span>
                <span className="mt-0.5 border-t border-border/60 pt-1.5 text-[10px]">
                  {t("co2Nodes.legend.size", "Bubble size = annual CO₂ emissions")}
                </span>
              </div>
            ) : null
          }
        />

        {revealVeil && (
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 z-10 bg-background transition-opacity duration-700 ease-out motion-reduce:transition-none",
              veilFading ? "opacity-0" : "opacity-100",
            )}
          />
        )}

        <LayerStepper
          wizard={wizard}
          state={state}
          actions={actions}
          selectedNodeCount={selectedNodeCount}
          handleModelNameChange={handleModelNameChange}
          getDateBounds={getDateBounds}
          editMode={editMode}
          modelId={existingModelId ?? modelIdFromRoute}
          tourRequestedStep={tourRequestedStep}
          onTourStepHandled={handleTourStepHandled}
        />
      </div>

      <AreaSelectTour
        isOpen={state.showAreaSelectTour}
        onComplete={handleTourComplete}
        onSkip={actions.handleTourSkip}
        onConfiguratorStepChange={setTourRequestedStep}
      />

      <CreateWorkspaceModal
        isOpen={isCreateWsOpen}
        onClose={() => setIsCreateWsOpen(false)}
        onSuccess={(newWorkspace) => {
          setIsCreateWsOpen(false);
          handleWorkspaceChange(newWorkspace);
        }}
      />
    </div>
  );
};
