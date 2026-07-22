import { useMemo, useState } from "react";

import type { AvailableLayer, FrameWeather } from "../viewer-config";

export interface RankedFrameDay {
  date: string;
  score: number;
}

// Backwards-compatible alias for consumers that imported the previous name.
export type RankedRiskDay = RankedFrameDay;

/**
 * useFrameWeather is a stub extension point for per-frame metadata in the day
 * player. The template ships without a per-frame data source, so it returns
 * empty state and the player renders without an overlay pill.
 *
 * A domain module can implement this hook to fetch per-day metadata (for
 * example an AOI-mean indicator) from its own backend endpoint and surface it
 * through the returned {@link RankedFrameDay} list.
 */
export const useFrameWeather = (
  _modelId: number | undefined,
  dailyFrames: AvailableLayer[],
  playingFrameDate: string | null
) => {
  const frameData: Record<string, FrameWeather | null> = useMemo(() => ({}), []);

  const currentFrameWeather = playingFrameDate ? frameData[playingFrameDate] ?? null : null;

  // No per-frame data source in the template, so no ranking is produced.
  const rankedRiskDays = useMemo<RankedFrameDay[] | null>(() => {
    void dailyFrames;
    return null;
  }, [dailyFrames]);

  const [riskRankIndex, setRiskRankIndex] = useState(0);
  const riskRankDay = rankedRiskDays?.[riskRankIndex % (rankedRiskDays.length || 1)] ?? null;

  return { currentFrameWeather, rankedRiskDays, riskRankIndex, setRiskRankIndex, riskRankDay };
};
