import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Tabs, TabsContent, TabsList, TabsTrigger } from "@spatialhub/ui";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import { formatFlux } from "./selector/shared";
import { useNodesQuery } from "../hooks/useNodesQuery";
import { nodeService, sourceService, type CaptureCase } from "../services/nodeService";

export function sourceFieldLabel(field: string): string {
  return field.replaceAll("_", " ").replace(/\bco2\b/gi, "CO₂").replace(/\bmw\b/g, "MW");
}

export function sourceValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return value.toLocaleString(undefined, { maximumFractionDigits: 6 });
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

const COST_CASES = ["low", "central", "high"] as const;
const MATURITY_CASES = ["noak", "foak_100", "foak_200"] as const;
const MATURITY_LABELS: Record<string, string> = {
  noak: "Nth of a kind",
  foak_100: "First of a kind (+100%)",
  foak_200: "First of a kind (+200%)",
};

/** Capture cost table. */
function CaptureCosts({ entityId }: { entityId: string }) {
  const { t } = useTranslation();
  const [maturity, setMaturity] = useState<string>("noak");
  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["co2-source-capture", entityId],
    queryFn: () => sourceService.getCapture(entityId),
    retry: false,
  });
  const primary = cases.filter((row) => row.is_primary_application && row.horizon_year !== null);
  if (isLoading) return <Loader2 aria-label={t("co2Source.loadingCapture", "Loading capture costs")} className="animate-spin" />;
  if (!primary.length) return <p className="text-sm text-muted-foreground">{t("co2Source.noCapture", "STORE_CO2 has no capture cost for this site.")}</p>;

  const years = [...new Set(primary.map((row) => row.horizon_year as number))].sort();
  const cell = (year: number, cost: string): CaptureCase | undefined =>
    primary.find((row) => row.horizon_year === year && row.cost_case === cost && row.maturity_case === maturity);
  const reference = primary.find((row) => row.horizon_year === 2030 && row.cost_case === "central" && row.maturity_case === "noak") ?? primary[0];
  const others = [...new Set(cases.filter((row) => !row.is_primary_application).map((row) => row.capture_application))].filter(Boolean);

  return (
    <section className="space-y-2 rounded-lg border border-border p-3">
      <h3 className="text-sm font-medium">{t("co2Source.captureTitle", "Carbon capture (STORE_CO2)")}</h3>
      <p className="text-xs text-muted-foreground">
        {reference.capture_application} · {reference.capture_technology ?? "—"} ·{" "}
        {t("co2Source.capturable", {
          value: sourceValue(reference.co2_capturable_t_annual === null ? null : Math.round(reference.co2_capturable_t_annual)),
          defaultValue: "{{value}} t CO₂/yr capturable",
        })}{" "}
        · {t("co2Source.captureRate", { value: sourceValue(reference.capture_rate), defaultValue: "capture rate {{value}}" })}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {MATURITY_CASES.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setMaturity(key)}
            className={cn(
              "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
              maturity === key ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/50",
            )}
          >
            {t(`co2Source.maturity.${key}`, MATURITY_LABELS[key])}
          </button>
        ))}
      </div>
      <table className="w-full text-xs">
        <caption className="mb-1 text-left text-muted-foreground">
          {t("co2Source.lcocCaption", "Levelised cost of capture (€2024 per tonne captured)")}
        </caption>
        <thead>
          <tr className="text-muted-foreground">
            <th className="py-1 text-left font-normal">{t("co2Source.horizonYear", "Year")}</th>
            {COST_CASES.map((cost) => (
              <th key={cost} className="py-1 text-right font-normal">
                {t(`co2Source.costCase.${cost}`, cost)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {years.map((year) => (
            <tr key={year} className="border-t border-border">
              <th className="py-1 text-left font-normal">{year}</th>
              {COST_CASES.map((cost) => {
                const value = cell(year, cost)?.lcoc_eur_per_t;
                return (
                  <td key={cost} className="py-1 text-right tabular-nums">
                    {typeof value === "number" ? `€${value.toFixed(1)}` : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {others.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {t("co2Source.otherApplications", "Other candidate applications")}: {others.join(", ")}
        </p>
      )}
    </section>
  );
}

// Scrolls inside, fades in.
const TAB_PANEL = "md-fade-in mt-0 min-h-0 flex-1 overflow-y-auto pr-1";

/** STORE_CO2 record. */
export function SourceDetails({ sourceId, nodeId, onClose }: { sourceId: string | null; nodeId?: number | null; onClose: () => void }) {
  const { t } = useTranslation();
  const isNode = nodeId !== undefined && nodeId !== null;
  const open = sourceId !== null || isNode;
  const { data, isLoading, isError } = useQuery({
    queryKey: isNode ? ["co2-node-detail", nodeId] : ["co2-source-detail", sourceId],
    queryFn: async (): Promise<Record<string, unknown> | null> =>
      isNode ? ((await nodeService.getNode(nodeId)).metadata ?? null) : sourceService.getPointSource(sourceId!),
    enabled: open,
  });
  const { data: nodes = [] } = useNodesQuery();
  const node = open ? nodes.find((item) => (isNode ? item.id === nodeId : item.node_id === sourceId)) : undefined;
  const history = Object.entries(data ?? {}).filter(([key]) => /^co2_t_\d{4}$/.test(key)).sort(([a], [b]) => a.localeCompare(b));
  // Tab only with values.
  const hasHistory = history.some(([, value]) => value !== null && value !== undefined && value !== "");
  const fields = Object.entries(data ?? {}).filter(([key]) => !/^co2_t_\d{4}$/.test(key) && key !== "capture");
  const title = typeof data?.name === "string" && data.name ? data.name : sourceId || t("co2Source.details", "Source details");
  const hasCapture = sourceId !== null && !isNode;
  // Key facts.
  const text = (value: unknown) => (typeof value === "string" && value ? value : null);
  // Skip NUTS-code states.
  const place = (value: unknown) => {
    const name = text(value);
    return name && !/^[A-Z]{2}[0-9A-Z]{0,3}(,|$)/.test(name) ? name : null;
  };
  const overview = ([
    [t("co2Source.overview.type", "Type"), node ? (node.industry || node.node_type).replaceAll("_", " ") : null],
    [t("co2Source.overview.operator", "Operator"), text(data?.operator)],
    [t("co2Source.overview.location", "Location"), [node?.municipality ?? text(data?.municipality), place(node?.state) ?? place(data?.state), node?.country_code ?? text(data?.country)].filter(Boolean).join(", ") || null],
    [t("co2Source.overview.emissions", "Annual CO₂"), node?.annual_flux ? formatFlux(node.annual_flux) : null],
    [t("co2Source.overview.operating", "Operating"), node?.operating_from || node?.operating_until ? `${node?.operating_from ?? "…"}–${node?.operating_until ? node.operating_until - 1 : "…"}` : null],
    [t("co2Source.overview.id", "ID"), node?.node_id ?? sourceId],
  ] as [string, string | null][]).filter((row): row is [string, string] => !!row[1]);
  return <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
    <DialogContent className="flex h-[min(85vh,760px)] flex-col overflow-hidden sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          {isNode
            ? t("co2Source.sinkInfo", "STORE_CO2 record. Rates and demand are kt CO₂ per year; capacities are Mt CO₂.")
            : t("co2Source.detailsInfo", "Complete STORE_CO2 record. Emissions are tonnes of CO₂ per year; missing values remain unknown.")}
        </DialogDescription>
      </DialogHeader>
      {isLoading && (
        <div aria-label={t("co2Source.loadingDetails", "Loading source")} className="flex-1 space-y-3">
          <div className="h-9 w-3/4 animate-pulse rounded-md bg-muted" />
          {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-4 animate-pulse rounded bg-muted/70" style={{ width: `${90 - i * 10}%` }} />)}
        </div>
      )}
      {isError && <p role="alert" className="text-sm text-destructive">{t("co2Source.detailsError", "Could not load source details.")}</p>}
      {data && (
        <Tabs key={isNode ? `n${nodeId}` : `s${sourceId}`} defaultValue="overview" className="flex min-h-0 flex-1 flex-col gap-3">
          <TabsList className="flex h-auto shrink-0 flex-wrap justify-start">
            <TabsTrigger value="overview">{t("co2Source.tabs.overview", "Overview")}</TabsTrigger>
            {hasCapture && <TabsTrigger value="capture">{t("co2Source.tabs.capture", "Capture costs")}</TabsTrigger>}
            {hasHistory && <TabsTrigger value="emissions">{t("co2Source.tabs.emissions", "Emissions")}</TabsTrigger>}
            <TabsTrigger value="data">{t("co2Source.tabs.data", "All data")}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className={TAB_PANEL}>
            <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-x-4 gap-y-2 text-sm">
              {overview.map(([label, value]) => <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="break-words">{value}</dd>
              </div>)}
            </dl>
          </TabsContent>

          {hasCapture && <TabsContent value="capture" className={TAB_PANEL}><CaptureCosts entityId={sourceId!} /></TabsContent>}

          {hasHistory && <TabsContent value="emissions" className={TAB_PANEL}>
            <table className="w-full text-sm">
              <caption className="mb-2 text-left font-medium">{t("co2Source.history", "Annual emissions history (t CO₂/year)")}</caption>
              <tbody>{history.map(([key, value]) => <tr key={key} className="border-b border-border">
                <th className="py-1 text-left font-normal">{key.slice(-4)}</th><td className="text-right tabular-nums">{sourceValue(value)}</td>
              </tr>)}</tbody>
            </table>
          </TabsContent>}

          <TabsContent value="data" className={TAB_PANEL}>
            <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-x-4 gap-y-2 text-xs">
              {fields.map(([key, value]) => <div key={key} className="contents">
                <dt className="break-words text-muted-foreground">{sourceFieldLabel(key)}</dt>
                <dd className="break-words">{typeof value === "boolean" ? (value ? t("co2Source.yes", "Yes") : t("co2Source.no", "No")) : sourceValue(value)}</dd>
              </div>)}
            </dl>
          </TabsContent>
        </Tabs>
      )}
    </DialogContent>
  </Dialog>;
}
