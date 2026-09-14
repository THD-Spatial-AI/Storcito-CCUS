import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@spatialhub/ui";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@/i18n";
import { sourceService } from "../services/nodeService";

export function sourceFieldLabel(field: string): string {
  return field.replaceAll("_", " ").replace(/\bco2\b/gi, "CO₂").replace(/\bmw\b/g, "MW");
}

export function sourceValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return value.toLocaleString(undefined, { maximumFractionDigits: 6 });
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function SourceDetails({ sourceId, onClose }: { sourceId: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["co2-source-detail", sourceId],
    queryFn: () => sourceService.getPointSource(sourceId!),
    enabled: sourceId !== null,
  });
  const history = Object.entries(data ?? {}).filter(([key]) => /^co2_t_\d{4}$/.test(key)).sort(([a], [b]) => a.localeCompare(b));
  const fields = Object.entries(data ?? {}).filter(([key]) => !/^co2_t_\d{4}$/.test(key));
  return <Dialog open={sourceId !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{data?.name || sourceId || t("co2Source.details", "Source details")}</DialogTitle>
        <DialogDescription>{t("co2Source.detailsInfo", "Complete STORE_CO2 record. Emissions are tonnes of CO₂ per year; missing values remain unknown.")}</DialogDescription>
      </DialogHeader>
      {isLoading && <Loader2 aria-label={t("co2Source.loadingDetails", "Loading source")} className="animate-spin" />}
      {isError && <p role="alert" className="text-sm text-destructive">{t("co2Source.detailsError", "Could not load source details.")}</p>}
      {!!history.length && <table className="w-full text-sm">
        <caption className="mb-2 text-left font-medium">{t("co2Source.history", "Annual emissions history (t CO₂/year)")}</caption>
        <tbody>{history.map(([key, value]) => <tr key={key} className="border-b border-border">
          <th className="py-1 text-left font-normal">{key.slice(-4)}</th><td className="text-right tabular-nums">{sourceValue(value)}</td>
        </tr>)}</tbody>
      </table>}
      {!!fields.length && <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-x-4 gap-y-2 text-xs">
        {fields.map(([key, value]) => <div key={key} className="contents">
          <dt className="break-words text-muted-foreground">{sourceFieldLabel(key)}</dt>
          <dd className="break-words">{typeof value === "boolean" ? (value ? t("co2Source.yes", "Yes") : t("co2Source.no", "No")) : sourceValue(value)}</dd>
        </div>)}
      </dl>}
    </DialogContent>
  </Dialog>;
}
