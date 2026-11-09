import { useCallback, useEffect, useMemo, useRef, useState, type FC, type ChangeEvent } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "@/i18n";

import { AreaSelectTour } from "@/features/guided-tour";
import { useAreaSelect, type AreaData } from "@/features/configurator/hooks/useAreaSelect";
import { useWizardSteps } from "@/features/configurator/hooks/area-select/useWizardSteps";
import { useNodeOLLayers, useNodesQuery, useFitToNodes, filterNodes, periodOf, useNodeFilterStore, useRoutingRunStore, EMITTER_COLOR, SINK_COLOR, TRANSPORT_COLOR, MODE_COLORS } from "@/features/co2-nodes";
import { MAP_STEP_PANEL_WIDTH, SIDEBAR_PANEL_WIDTH_CSS, WizardStepBar } from "./components/wizard";
import { useSurveyDescriber } from "@/features/survey/useSurveyDescriber";
import { useSurveyOLLayer } from "@/features/survey/useSurveyOLLayer";
import { SurveyMapControl } from "@/features/survey/SurveyMapControl";
import { useSurveyLayerStore } from "@/features/survey/surveyLayerStore";
import { isEmitter, isSink, type CO2Node } from "@/features/co2-nodes/types";
import { NodePopup } from "@/features/co2-nodes/components/NodePopup";
import { SourceDetails } from "@/features/co2-nodes/components/SourceDetails";
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
  const nodeRegionFilter = useNodeFilterStore((s) => s.regions);
  const nodeRuralFilter = useNodeFilterStore((s) => s.rural);
  const nodeRailDistance = useNodeFilterStore((s) => s.railDistance);
  const nodeFluxRange = useNodeFilterStore((s) => s.fluxRange);
  const nodePeriodOnly = useNodeFilterStore((s) => s.periodOnly);
  const nodePeriod = useNodeFilterStore((s) => s.period);
  const setNodePeriod = useNodeFilterStore((s) => s.setPeriod);
  // Period drives filters.
  useEffect(() => {
    setNodePeriod(periodOf(state.fromDate, state.toDate));
  }, [state.fromDate, state.toDate, setNodePeriod]);
  // Mirrors the filters.
  const mapNodes = useMemo(
    () =>
      filterNodes(nodes, {
        countries: nodeCountryFilter,
        states: nodeStateFilter,
        municipalities: nodeMunicipalityFilter,
        emitterCategories: nodeEmitterFilter,
        sinkCategories: nodeSinkFilter,
        regions: nodeRegionFilter,
        rural: nodeRuralFilter,
        railDistance: nodeRailDistance,
        fluxRange: nodeFluxRange,
        periodOnly: nodePeriodOnly,
        period: nodePeriod,
      }),
    [
      nodes,
      nodeCountryFilter,
      nodeStateFilter,
      nodeMunicipalityFilter,
      nodeEmitterFilter,
      nodeSinkFilter,
      nodeRegionFilter,
      nodeRuralFilter,
      nodeRailDistance,
      nodeFluxRange,
      nodePeriodOnly,
      nodePeriod,
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
  // Clear of the panel.
  const legendLeft = isMapStep ? `${MAP_STEP_PANEL_WIDTH + 16}px` : `calc(${SIDEBAR_PANEL_WIDTH_CSS} + 16px)`;

  // Picks only.
  const surveyOn = useSurveyLayerStore((s) => s.enabled);
  const showEmitters = useSurveyLayerStore((s) => s.showEmitters);
  const showSinks = useSurveyLayerStore((s) => s.showSinks);
  const visibleNodes = useMemo(() => {
    const picked = new Set(state.selectedNodeIds);
    if (!isMapStep) return mapNodes.filter((node) => picked.has(node.id));
    if (!surveyOn || (showEmitters && showSinks)) return mapNodes;
    // Picks stay visible.
    return mapNodes.filter(
      (node) => picked.has(node.id) || (isEmitter(node) ? showEmitters : isSink(node) ? showSinks : true),
    );
  }, [isMapStep, mapNodes, state.selectedNodeIds, surveyOn, showEmitters, showSinks]);

  // Routed paths.
  const routes = useRoutingRunStore((store) => store.routes);
  const routedModes = useMemo(
    () => [...new Set((routes ?? []).filter((route) => route.metadata?.geometry).map((route) => route.mode))],
    [routes],
  );

  const describeNode = useSurveyDescriber();
  // Dot card and details.
  const [popup, setPopup] = useState<{ node: CO2Node; coordinate?: number[] } | null>(null);
  const [detailNode, setDetailNode] = useState<CO2Node | null>(null);
  const handleNodeClick = useCallback((node: CO2Node | null, coordinate?: number[]) => {
    setPopup(node ? { node, coordinate } : null);
  }, []);
  useEffect(() => setPopup(null), [wizard.step]);
  useSurveyOLLayer(map);
  useNodeOLLayers({ map, nodes: visibleNodes, selectedIds: state.selectedNodeIds, onToggle: toggleNode, routes, describe: describeNode, onNodeClick: handleNodeClick });

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
        onClearNodes={() => {
          actions.setSelectedNodeIds([]);
          // Drop old routes.
          useRoutingRunStore.getState().reset();
          // Back to node selection.
          if (wizard.step > 2) wizard.setStep(2);
        }}
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
              <>
                <SurveyMapControl />
                <div style={{ left: legendLeft }} className="pointer-events-none absolute bottom-4 z-20 flex flex-col gap-1.5 rounded-xl border border-border bg-card/95 px-3 py-2 text-[11px] text-muted-foreground shadow-lg backdrop-blur-md">
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
                  {routedModes.map((mode) => (
                    <span key={mode} className="flex items-center gap-1.5">
                      <span className="h-1 w-5 rounded-full" style={{ backgroundColor: MODE_COLORS[mode] ?? TRANSPORT_COLOR }} />
                      {t(`co2Nodes.legend.routed.${mode}`, `${mode[0].toUpperCase()}${mode.slice(1)} route`)}
                    </span>
                  ))}
                  <span className="mt-0.5 border-t border-border/60 pt-1.5 text-[10px]">
                    {t("co2Nodes.legend.size", "Bubble size = annual CO₂ emissions")}
                  </span>
                </div>
              </>
            ) : null
          }
        />

        <NodePopup
          map={map}
          node={popup?.node ?? null}
          coordinate={popup?.coordinate}
          selected={!!popup && state.selectedNodeIds.includes(popup.node.id)}
          extra={popup ? describeNode(popup.node) : null}
          onToggle={(node) => toggleNode(node.id)}
          onDetails={popup?.node.source === "store_co2" ? setDetailNode : undefined}
          onClose={() => setPopup(null)}
        />
        <SourceDetails
          sourceId={detailNode && !isSink(detailNode) ? detailNode.node_id : null}
          nodeId={detailNode && isSink(detailNode) ? detailNode.id : null}
          onClose={() => setDetailNode(null)}
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
