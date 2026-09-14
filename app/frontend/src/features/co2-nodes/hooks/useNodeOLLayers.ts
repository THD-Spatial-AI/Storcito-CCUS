/** Node layers. */
import { useCallback, useEffect, useRef } from "react";
import type OLMap from "ol/Map";
import Feature from "ol/Feature";
import Overlay from "ol/Overlay";
import { LineString, Point } from "ol/geom";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { fromLonLat } from "ol/proj";
import { Circle, Fill, Stroke, Style, Text } from "ol/style";
import type FeatureCtor from "ol/Feature";
import type { FeatureLike } from "ol/Feature";
import type MapBrowserEvent from "ol/MapBrowserEvent";

import { isEmitterCategory, isSinkCategory, type CO2Node } from "../types";

const NODE_LAYER_NAME = "co2-nodes";
const LABEL_LAYER_NAME = "co2-node-labels";
const ROUTE_LAYER_NAME = "co2-routes";
const TOOLTIP_NAME = "co2-node-tooltip";

// Colour per group.
export const EMITTER_COLOR = "#ef4444";
export const SINK_COLOR = "#10b981";
export const TRANSPORT_COLOR = "#6366f1";

// Own visual channel.
const SELECT_RING = "#0f172a";
const SELECT_GAP = "rgba(255,255,255,0.95)";

export const groupOf = (node: CO2Node): "emitter" | "sink" | "transport" => {
  if (isEmitterCategory(node.node_type)) return "emitter";
  if (isSinkCategory(node.node_type)) return "sink";
  return "transport";
};

const colorFor = (group: string) =>
  group === "emitter" ? EMITTER_COLOR : group === "sink" ? SINK_COLOR : TRANSPORT_COLOR;

const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

/** Radius by flux. */
const radiusFor = (annualFlux: number | null): number => {
  if (!annualFlux || annualFlux <= 0) return 4.5;
  // sqrt scale.
  return Math.min(14, Math.max(4.5, 4 + Math.sqrt(annualFlux / 1e6) * 2.4));
};

const formatFlux = (annualFlux: number | null): string =>
  annualFlux && annualFlux > 0
    ? `${(annualFlux / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} kt/yr`
    : "";

// Cache shared styles.
const styleCache = new Map<string, Style[]>();

function nodeStyles(feature: FeatureLike): Style[] {
  const selected = feature.get("selected") === true;
  const hovered = feature.get("hover") === true;
  // Unpicked recede.
  const dimmed = feature.get("dimmed") === true && !hovered;
  const color = colorFor(feature.get("group"));
  // Bucket the radius.
  const radius = Math.round(((feature.get("radius") as number) ?? 5) * 2) / 2;

  const cacheKey = `${color}|${selected}|${hovered}|${dimmed}|${radius}`;
  const cached = styleCache.get(cacheKey);
  if (cached) return cached;

  const styles: Style[] = [];

  if (selected) {
    // Gap, then ring.
    styles.push(
      new Style({
        image: new Circle({
          radius: radius + 6,
          fill: new Fill({ color: SELECT_GAP }),
          stroke: new Stroke({ color: SELECT_RING, width: 1.75 }),
        }),
        zIndex: 3,
      }),
    );
  } else if (hovered) {
    styles.push(
      new Style({
        image: new Circle({
          radius: radius + 5,
          fill: new Fill({ color: hexToRgba(color, 0.18) }),
          stroke: new Stroke({ color: hexToRgba(color, 0.45), width: 1.5 }),
        }),
        zIndex: 2,
      }),
    );
  }

  const fillAlpha = selected ? 1 : dimmed ? 0.3 : 0.78;
  styles.push(
    new Style({
      image: new Circle({
        radius: selected || hovered ? radius + 1.5 : radius,
        fill: new Fill({ color: hexToRgba(color, fillAlpha) }),
        stroke: new Stroke({
          color: dimmed ? "rgba(255,255,255,0.65)" : "#ffffff",
          width: selected ? 2 : 1.5,
        }),
      }),
      // Selected paint last.
      zIndex: selected ? 4 : hovered ? 2 : 1,
    }),
  );

  styleCache.set(cacheKey, styles);
  return styles;
}

/** Decluttered picked-node names. */
function labelStyle(feature: FeatureLike): Style {
  const radius = (feature.get("radius") as number) ?? 5;
  return new Style({
    text: new Text({
      text: feature.get("label"),
      offsetY: radius + 14,
      font: "600 11px Inter, system-ui, sans-serif",
      fill: new Fill({ color: "#1f2937" }),
      stroke: new Stroke({ color: "#ffffff", width: 3 }),
    }),
  });
}

const routeStyle = new Style({
  stroke: new Stroke({ color: TRANSPORT_COLOR, width: 2, lineDash: [6, 4] }),
});

/** Emitter-sink pairs. */
export const candidateRoutes = (
  nodes: CO2Node[],
  selectedIds: Set<number>,
): Array<[CO2Node, CO2Node]> => {
  const chosen = nodes.filter((node) => selectedIds.has(node.id));
  const emitters = chosen.filter((node) => groupOf(node) === "emitter");
  const sinks = chosen.filter((node) => groupOf(node) === "sink");
  return emitters.flatMap((emitter) =>
    sinks.map((sink) => [emitter, sink] as [CO2Node, CO2Node]),
  );
};

interface UseNodeOLLayersOptions {
  map: OLMap | null;
  nodes: CO2Node[];
  selectedIds: number[];
  onToggle: (nodeId: number) => void;
}

export const useNodeOLLayers = ({
  map,
  nodes,
  selectedIds,
  onToggle,
}: UseNodeOLLayersOptions) => {
  const toggleRef = useRef(onToggle);
  toggleRef.current = onToggle;

  // Fade once.
  const fadedRef = useRef(false);

  const removeExisting = useCallback((olMap: OLMap) => {
    const stale: VectorLayer<VectorSource>[] = [];
    olMap.getLayers().forEach((layer) => {
      const name = layer.get("name");
      if (name === NODE_LAYER_NAME || name === LABEL_LAYER_NAME || name === ROUTE_LAYER_NAME) {
        stale.push(layer as VectorLayer<VectorSource>);
      }
    });
    stale.forEach((layer) => olMap.removeLayer(layer));
    olMap
      .getOverlays()
      .getArray()
      .filter((overlay) => overlay.get("name") === TOOLTIP_NAME)
      .forEach((overlay) => olMap.removeOverlay(overlay));
  }, []);

  useEffect(() => {
    if (!map) return;
    removeExisting(map);
    if (nodes.length === 0) return;

    const selected = new Set(selectedIds);

    // Under the nodes.
    const routeSource = new VectorSource({
      features: candidateRoutes(nodes, selected).map(
        ([emitter, sink]) =>
          new Feature({
            geometry: new LineString([
              fromLonLat([emitter.longitude, emitter.latitude]),
              fromLonLat([sink.longitude, sink.latitude]),
            ]),
          }),
      ),
    });
    const routeLayer = new VectorLayer({
      source: routeSource,
      style: routeStyle,
      zIndex: 60,
      properties: { name: ROUTE_LAYER_NAME },
    });
    map.addLayer(routeLayer);    const nodeByFeature = new Map<FeatureCtor, CO2Node>();
    const nodeSource = new VectorSource({
      features: nodes.map((node) => {
        const feature = new Feature({
          geometry: new Point(fromLonLat([node.longitude, node.latitude])),
        });
        feature.set("nodeId", node.id);
        feature.set("label", node.node_name || node.node_id);
        feature.set("group", groupOf(node));
        feature.set("radius", radiusFor(node.annual_flux));
        feature.set("selected", selected.has(node.id));
        feature.set("dimmed", selected.size > 0 && !selected.has(node.id));
        nodeByFeature.set(feature, node);
        return feature;
      }),
    });
    const nodeLayer = new VectorLayer({
      source: nodeSource,
      style: nodeStyles,
      zIndex: 65,
      properties: { name: NODE_LAYER_NAME },
    });
    map.addLayer(nodeLayer);

    // Decluttered label layer.
    const labelLayer = new VectorLayer({
      source: new VectorSource({
        features: nodes
          .filter((node) => selected.has(node.id))
          .map((node) => {
            const feature = new Feature({
              geometry: new Point(fromLonLat([node.longitude, node.latitude])),
            });
            feature.set("label", node.node_name || node.node_id);
            feature.set("radius", radiusFor(node.annual_flux));
            return feature;
          }),
      }),
      style: labelStyle,
      declutter: true,
      zIndex: 66,
      properties: { name: LABEL_LAYER_NAME },
    });
    map.addLayer(labelLayer);

    // Rebuilds stay instant.
    let fadeRaf = 0;
    if (!fadedRef.current) {
      fadedRef.current = true;
      const fadeLayers = [routeLayer, nodeLayer, labelLayer];
      for (const layer of fadeLayers) layer.setOpacity(0);
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / 700);
        const eased = 1 - (1 - t) * (1 - t);
        for (const layer of fadeLayers) layer.setOpacity(eased);
        if (t < 1) fadeRaf = requestAnimationFrame(tick);
      };
      fadeRaf = requestAnimationFrame(tick);
    }

    // Hover tooltip.
    const tooltip = document.createElement("div");
    tooltip.className = "ol-node-tooltip";
    const tooltipName = document.createElement("div");
    tooltipName.className = "ol-node-tooltip-name";
    const tooltipMeta = document.createElement("div");
    tooltipMeta.className = "ol-node-tooltip-meta";
    tooltip.append(tooltipName, tooltipMeta);
    const tooltipOverlay = new Overlay({
      element: tooltip,
      offset: [0, -10],
      positioning: "bottom-center",
      stopEvent: false,
    });
    tooltipOverlay.set("name", TOOLTIP_NAME);
    map.addOverlay(tooltipOverlay);

    let hovered: FeatureCtor | undefined;
    const setHovered = (feature: FeatureCtor | undefined, coordinate?: number[]) => {
      if (hovered !== feature) {
        if (hovered) {
          hovered.set("hover", false);
          hovered.changed();
        }
        hovered = feature;
        if (hovered) {
          hovered.set("hover", true);
          hovered.changed();
        }
      }

      if (!hovered) {
        tooltipOverlay.setPosition(undefined);
        return;
      }
      const node = nodeByFeature.get(hovered);
      if (node) {
        tooltipName.textContent = node.node_name || node.node_id;
        const meta = [
          node.industry || node.node_type,
          [node.municipality, node.country_code].filter(Boolean).join(", "),
          formatFlux(node.annual_flux),
        ]
          .filter(Boolean)
          .join(" · ");
        tooltipMeta.textContent = meta;
      }
      tooltipOverlay.setPosition(coordinate);
    };

    const pickNode = (event: MapBrowserEvent): FeatureCtor | undefined => {
      let found: FeatureCtor | undefined;
      map.forEachFeatureAtPixel(
        event.pixel,
        (feature, layer) => {
          if (layer?.get("name") !== NODE_LAYER_NAME) return false;
          found = feature as FeatureCtor;
          return true;
        },
        { hitTolerance: 4 },
      );
      return found;
    };

    const handleClick = (event: MapBrowserEvent) => {
      const feature = pickNode(event);
      const nodeId = feature?.get("nodeId");
      if (typeof nodeId === "number") toggleRef.current(nodeId);
    };

    const handlePointerMove = (event: MapBrowserEvent) => {
      if (event.dragging) return;
      const feature = pickNode(event);
      map.getTargetElement().style.cursor = feature ? "pointer" : "";
      setHovered(feature, feature ? event.coordinate : undefined);
    };

    map.on("click", handleClick);
    map.on("pointermove", handlePointerMove);

    return () => {
      if (fadeRaf) cancelAnimationFrame(fadeRaf);
      map.un("click", handleClick);
      map.un("pointermove", handlePointerMove);
      removeExisting(map);
    };
  }, [map, nodes, selectedIds, removeExisting]);
};
