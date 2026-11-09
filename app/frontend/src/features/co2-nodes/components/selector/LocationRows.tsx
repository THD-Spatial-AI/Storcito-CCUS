import type { FC } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

import { checkboxClass, Collapsible, rowClass } from "./shared";

const COUNT_CLASS = "shrink-0 text-[10px] tabular-nums text-muted-foreground";
const CHEVRON_CLASS = "h-3 w-3 transition-transform duration-150";

/** City checkboxes. */
const MunicipalityList: FC<{
  entries: [string, number][];
  picked: ReadonlySet<string>;
  onToggle: (municipality: string) => void;
}> = ({ entries, picked, onToggle }) => (
  <div className="ml-6 max-h-52 space-y-0.5 overflow-y-auto py-0.5 pr-1">
    {entries.map(([municipality, count]) => (
      <label key={municipality} className={cn(rowClass(picked.has(municipality)), "cursor-pointer gap-2")}>
        <input
          type="checkbox"
          checked={picked.has(municipality)}
          onChange={() => onToggle(municipality)}
          className={checkboxClass}
        />
        <span className="min-w-0 flex-1 truncate">{municipality}</span>
        <span className={COUNT_CLASS}>{count.toLocaleString()}</span>
      </label>
    ))}
  </div>
);

/** Location drill-down. */
export const LocationRows: FC<{
  countries: string[];
  countByCountry: Map<string, number>;
  statesOf: (country: string) => [string, number][];
  municipalitiesOf: (country: string, state: string) => [string, number][];
  countryFilter: ReadonlySet<string>;
  stateFilter: ReadonlySet<string>;
  municipalityFilter: ReadonlySet<string>;
  onToggleCountry: (code: string) => void;
  onToggleState: (state: string) => void;
  onToggleMunicipality: (municipality: string) => void;
  openKeys: ReadonlySet<string>;
  onToggleOpen: (key: string) => void;
  noStateLabel: string;
}> = ({
  countries,
  countByCountry,
  statesOf,
  municipalitiesOf,
  countryFilter,
  stateFilter,
  municipalityFilter,
  onToggleCountry,
  onToggleState,
  onToggleMunicipality,
  openKeys,
  onToggleOpen,
  noStateLabel,
}) => (
  <>
    {countries.map((code) => {
      const states = statesOf(code);
      const countryOpen = openKeys.has(`c:${code}`);
      return (
        <div key={code}>
          <div className={rowClass(countryFilter.has(code))}>
            <button
              type="button"
              onClick={() => onToggleOpen(`c:${code}`)}
              aria-expanded={countryOpen}
              disabled={states.length === 0}
              className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors duration-150 hover:text-foreground disabled:opacity-30"
            >
              <ChevronRight
                className={cn(CHEVRON_CLASS, countryOpen && "rotate-90")}
              />
            </button>
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={countryFilter.has(code)}
                onChange={() => onToggleCountry(code)}
                className={checkboxClass}
              />
              <span className="min-w-0 flex-1">{code}</span>
              <span className={COUNT_CLASS}>
                {(countByCountry.get(code) ?? 0).toLocaleString()}
              </span>
            </label>
          </div>

          <Collapsible expanded={countryOpen}>
            <div className="space-y-0.5 py-0.5 pl-6 pr-1">
              {states.map(([stateName, stateCount]) => {
                const municipalities = municipalitiesOf(code, stateName);
                const stateOpen = openKeys.has(`s:${code}|${stateName}`);
                return (
                  <div key={stateName}>
                    <div className={rowClass(stateFilter.has(stateName))}>
                      <button
                        type="button"
                        onClick={() => onToggleOpen(`s:${code}|${stateName}`)}
                        aria-expanded={stateOpen}
                        disabled={municipalities.length === 0}
                        className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors duration-150 hover:text-foreground disabled:opacity-30"
                      >
                        <ChevronRight
                          className={cn(CHEVRON_CLASS, stateOpen && "rotate-90")}
                        />
                      </button>
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={stateFilter.has(stateName)}
                          onChange={() => onToggleState(stateName)}
                          className={checkboxClass}
                        />
                        <span className="min-w-0 flex-1 truncate">{stateName}</span>
                        <span className={COUNT_CLASS}>
                          {stateCount.toLocaleString()}
                        </span>
                      </label>
                    </div>

                    <Collapsible expanded={stateOpen}>
                      <MunicipalityList
                        entries={municipalities}
                        picked={municipalityFilter}
                        onToggle={onToggleMunicipality}
                      />
                    </Collapsible>
                  </div>
                );
              })}

              {/* Unknown-state cities. */}
              {(() => {
                const noState = municipalitiesOf(code, "");
                if (noState.length === 0) return null;
                const noStateOpen = openKeys.has(`x:${code}`);
                const noStateTotal = noState.reduce((sum, [, count]) => sum + count, 0);
                return (
                  <div>
                    <div className={rowClass(false)}>
                      <button
                        type="button"
                        onClick={() => onToggleOpen(`x:${code}`)}
                        aria-expanded={noStateOpen}
                        className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors duration-150 hover:text-foreground"
                      >
                        <ChevronRight
                          className={cn(CHEVRON_CLASS, noStateOpen && "rotate-90")}
                        />
                      </button>
                      <span className="min-w-0 flex-1 truncate italic text-muted-foreground">
                        {noStateLabel}
                      </span>
                      <span className={COUNT_CLASS}>
                        {noStateTotal.toLocaleString()}
                      </span>
                    </div>
                    <Collapsible expanded={noStateOpen}>
                      <MunicipalityList
                        entries={noState}
                        picked={municipalityFilter}
                        onToggle={onToggleMunicipality}
                      />
                    </Collapsible>
                  </div>
                );
              })()}
            </div>
          </Collapsible>
        </div>
      );
    })}
  </>
);
