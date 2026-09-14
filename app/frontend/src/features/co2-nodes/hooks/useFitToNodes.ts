/** Frame the catalogue. */
import { useEffect, useRef } from "react";
import type OLMap from "ol/Map";
import { createEmpty, extendCoordinate, isEmpty } from "ol/extent";
import { fromLonLat } from "ol/proj";

import type { CO2Node } from "../types";

interface UseFitToNodesOptions {
  map: OLMap | null;
  nodes: CO2Node[];
  /** On screen only. */
  enabled: boolean;
  /** Padding, clockwise. */
  padding?: [number, number, number, number];
  maxZoom?: number;
}

export const useFitToNodes = ({
  map,
  nodes,
  enabled,
  padding = [40, 40, 40, 40],
  maxZoom = 9,
}: UseFitToNodesOptions) => {
  // Fit once.
  const fitted = useRef(false);

  useEffect(() => {
    if (!map || !enabled || fitted.current || nodes.length === 0) return;

    const extent = createEmpty();
    for (const node of nodes) {
      extendCoordinate(extent, fromLonLat([node.longitude, node.latitude]));
    }
    if (isEmpty(extent)) return;

    // Size, then fit.
    const frame = requestAnimationFrame(() => {
      map.updateSize();
      map.getView().fit(extent, { padding, maxZoom, duration: 400 });
      fitted.current = true;
    });
    return () => cancelAnimationFrame(frame);
  }, [map, nodes, enabled, padding, maxZoom]);
};
