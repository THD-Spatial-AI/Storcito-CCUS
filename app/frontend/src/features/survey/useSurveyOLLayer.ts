import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type OLMap from "ol/Map";
import type MapBrowserEvent from "ol/MapBrowserEvent";
import Feature, { type FeatureLike } from "ol/Feature";
import GeoJSON from "ol/format/GeoJSON";
import type Geometry from "ol/geom/Geometry";
import MultiPolygon from "ol/geom/MultiPolygon";
import Point from "ol/geom/Point";
import Polygon from "ol/geom/Polygon";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { Fill, Stroke, Style, Text } from "ol/style";
import { useNodeFilterStore } from "@/features/co2-nodes/stores/nodeFilterStore";
import { useSurvey } from "./useSurvey";
import { bandColor, useSurveyLayerStore } from "./surveyLayerStore";
import { useSurveyApplication } from "./useSurveyApplication";
import { useSurveyBands } from "./useSurveyBands";

const LAYER_NAME = "survey-regions";
const LABEL_LAYER = "survey-region-labels";
const NODE_LAYERS = new Set(["co2-nodes", "co2-node-labels"]);

const hexToRgba = (hex: string, alpha: number) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

const noData = new Style({
  fill: new Fill({ color: "rgba(148, 163, 184, 0.12)" }),
  stroke: new Stroke({ color: "rgba(100, 116, 139, 0.5)", width: 1, lineDash: [4, 4] }),
});

// Largest part's centre.
const labelPoint = (geometries: Geometry[]): number[] | null => {
  let best: Polygon | null = null;
  for (const geometry of geometries) {
    const parts = geometry instanceof MultiPolygon ? geometry.getPolygons() : geometry instanceof Polygon ? [geometry] : [];
    for (const part of parts) {
      if (!best || part.getArea() > best.getArea()) best = part;
    }
  }
  return best ? best.getInteriorPoint().getCoordinates().slice(0, 2) : null;
};

/** Survey choropleth layer. */
export const useSurveyOLLayer = (map: OLMap | null) => {
  const { data } = useSurvey();
  const { enabled, metric, selectedKey, select } = useSurveyLayerStore();
  const { application } = useSurveyApplication();
  const countries = useNodeFilterStore((state) => state.countries);
  const bands = useSurveyBands();
  const { data: boundaries } = useQuery({
    queryKey: ["survey-boundaries"],
    queryFn: async () => (await fetch("/data/nuts-survey.geojson")).json(),
    staleTime: Infinity,
    enabled,
  });

  // One label each.
  const sources = useMemo(() => {
    if (!boundaries) return null;
    const regions = data?.regions ?? [];
    const known = new Set(regions.map((region) => region.key));
    const areas = new GeoJSON().readFeatures(boundaries, { featureProjection: "EPSG:3857" });
    const labels: Feature[] = [];
    for (const area of areas) {
      const key = area.get("key") as string | null;
      area.set("regionKey", key && known.has(key) ? key : null);
      const geometry = area.getGeometry();
      const point = key && known.has(key) && geometry ? labelPoint([geometry]) : null;
      if (point) {
        const label = new Feature({ geometry: new Point(point) });
        label.set("regionKey", key);
        label.set("country", area.get("country"));
        labels.push(label);
      }
    }
    return { areas: new VectorSource({ features: areas }), labels: new VectorSource({ features: labels }) };
  }, [boundaries, data]);

  useEffect(() => {
    if (!map || !enabled || !sources) return;
    const byKey = new Map((data?.regions ?? []).map((region) => [region.key, region]));
    const shown = (country: string) => countries.size === 0 || countries.has(country);
    const valueOf = (key: string) => {
      const figures = byKey.get(key)?.applications[application];
      return figures ? (metric === "oppose" ? figures.pct_oppose : figures.pct_support) : null;
    };

    const areaStyles = new Map<string, Style>();
    const areaStyle = (feature: FeatureLike) => {
      if (!shown(String(feature.get("country")))) return undefined;
      const key = feature.get("regionKey") as string | null;
      const value = key ? valueOf(key) : null;
      if (!key || value === null) return noData;
      const selected = key === selectedKey;
      const cacheKey = `${key}|${selected}`;
      let style = areaStyles.get(cacheKey);
      if (!style) {
        style = new Style({
          fill: new Fill({ color: hexToRgba(bandColor(bands, value), selected ? 0.8 : 0.62) }),
          stroke: new Stroke({ color: selected ? "#0f172a" : "rgba(255, 255, 255, 0.9)", width: selected ? 2.5 : 1 }),
          zIndex: selected ? 2 : 1,
        });
        areaStyles.set(cacheKey, style);
      }
      return style;
    };


    const labelStyle = (feature: FeatureLike) => {
      if (!shown(String(feature.get("country")))) return undefined;
      const region = byKey.get(feature.get("regionKey"));
      const value = region ? valueOf(region.key) : null;
      if (!region || value === null) return undefined;
      return new Style({
        text: new Text({
          text: `${region.name.replace(", ", ",\n").replace(" and ", " and\n")}\n${Math.round(value)}% ${metric === "oppose" ? "oppose" : "support"}\n(rural residents)`,
          font: "600 11px Inter, system-ui, sans-serif",
          fill: new Fill({ color: "#0f172a" }),
          stroke: new Stroke({ color: "rgba(255, 255, 255, 0.95)", width: 3.5 }),
          textAlign: "center",
          overflow: true,
        }),
      });
    };

    const areaLayer = new VectorLayer({ source: sources.areas, style: areaStyle, zIndex: 40, properties: { name: LAYER_NAME } });
    const labelLayer = new VectorLayer({
      source: sources.labels,
      style: labelStyle,
      declutter: true,
      zIndex: 70,
      properties: { name: LABEL_LAYER },
    });
    map.addLayer(areaLayer);
    map.addLayer(labelLayer);

    const handleClick = (event: MapBrowserEvent) => {
      let onNode = false;
      let key: string | null = null;
      map.forEachFeatureAtPixel(
        event.pixel,
        (feature, hit) => {
          const name = hit?.get("name");
          if (NODE_LAYERS.has(name)) onNode = true;
          else if ((name === LAYER_NAME || name === LABEL_LAYER) && key === null) key = feature.get("regionKey") ?? null;
          return false;
        },
        { hitTolerance: 4 },
      );
      if (!onNode) select(key);
    };
    map.on("click", handleClick);
    return () => {
      map.un("click", handleClick);
      map.removeLayer(areaLayer);
      map.removeLayer(labelLayer);
    };
  }, [map, enabled, sources, data, application, metric, selectedKey, select, countries, bands]);
};
