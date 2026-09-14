import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@spatialhub/ui";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Database,
  Loader2,
  MapPinOff,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import { nodeService, sourceService } from "../services/nodeService";
import { nodeKeys } from "../hooks/useNodesQuery";
import { SourceDetails, sourceValue } from "./SourceDetails";
import { Collapsible } from "./selector/shared";

const PAGE_SIZE = 25;

const formatTonnes = (value: number | null): string =>
  value && value > 0 ? value.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—";

/** One facet row. */
const FilterChips = ({
  label,
  options,
  active,
  onPick,
  allLabel,
}: {
  label: string;
  options: { value: string; label: string; count: number | null }[];
  active: string | null;
  onPick: (value: string | null) => void;
  allLabel: string;
}) => (
  <div className="flex items-start gap-2">
    <span className="w-16 shrink-0 pt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </span>
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onPick(null)}
        className={cn(
          "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors duration-150",
          active === null
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        )}
      >
        {allLabel}
      </button>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onPick(active === option.value ? null : option.value)}
          className={cn(
            "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors duration-150",
            active === option.value
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          )}
        >
          {option.label}
          {option.count !== null && (
            <span className="ml-1 text-[10px] tabular-nums opacity-70">
              {option.count.toLocaleString()}
            </span>
          )}
        </button>
      ))}
    </div>
  </div>
);

/** STORE_CO2 catalogue browser. */
export function SourceCatalogue() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [country, setCountry] = useState<string | null>(null);
  const [group, setGroup] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // Debounced request.
  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(id);
  }, [search]);

  const stats = useQuery({ queryKey: ["co2-source-stats"], queryFn: sourceService.getStats, staleTime: 60_000 });
  const catalogue = useQuery({
    queryKey: ["co2-source-catalogue", debouncedSearch, page, country, group, status],
    queryFn: () => sourceService.getPointSources({
      search: debouncedSearch,
      country: country ?? undefined,
      capture_group: group ?? undefined,
      status: status ?? undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      with_coordinates: false,
    }),
    enabled: open,
    placeholderData: (previous) => previous,
  });
  const refresh = useMutation({
    mutationFn: nodeService.refreshSources,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: nodeKeys.all }),
        queryClient.invalidateQueries({ queryKey: ["co2-source-stats"] }),
        queryClient.invalidateQueries({ queryKey: ["co2-source-detail"] }),
        queryClient.invalidateQueries({ queryKey: ["co2-source-catalogue"] }),
      ]);
    },
  });

  const total = catalogue.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = Math.min(total, (page + 1) * PAGE_SIZE);

  const activeFilters = (country ? 1 : 0) + (group ? 1 : 0) + (status ? 1 : 0);
  const countryOptions = (stats.data?.by_country ?? []).map((row) => ({
    value: row.country,
    label: row.country,
    count: row.sources,
  }));
  const groupOptions = (stats.data?.by_capture_group ?? [])
    .filter((row): row is typeof row & { capture_group: string } => Boolean(row.capture_group))
    .map((row) => ({ value: row.capture_group, label: row.capture_group, count: row.sources }));
  const statusOptions = (stats.data?.by_status ?? [])
    .filter((row): row is typeof row & { status: string } => Boolean(row.status))
    .map((row) => ({ value: row.status, label: row.status, count: row.sources }));

  return <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>{t("co2Source.browse", "Browse all sources")}</Button>
      <Button size="sm" variant="outline" disabled={refresh.isPending} onClick={() => refresh.mutate()}>
        <RefreshCw className={`h-3 w-3 ${refresh.isPending ? "animate-spin" : ""}`} />{t("co2Source.refresh", "Refresh source data")}
      </Button>
    </div>
    {stats.data && <p className="text-[11px] text-muted-foreground">
      {t("co2Source.coverage", "{{total}} sources; {{mappable}} have map coordinates.", { total: stats.data.total_sources.toLocaleString(), mappable: stats.data.with_coordinates.toLocaleString() })}
    </p>}
    {refresh.isSuccess && <p role="status" className="text-xs text-muted-foreground">{t("co2Source.refreshed", "Updated {{count}} sources.", { count: refresh.data.imported })}</p>}
    {refresh.isError && <p role="alert" className="text-xs text-destructive">{t("co2Source.refreshError", "Could not refresh sources. Existing data was kept.")}</p>}

    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Database className="h-4 w-4" />
            </span>
            {t("co2Source.catalogue", "STORE_CO2 source catalogue")}
          </DialogTitle>
          <DialogDescription className="text-xs">{t("co2Source.catalogueInfo", "Includes sources without coordinates. Select mappable facilities in Step 2.")}</DialogDescription>
        </DialogHeader>

        <div className="border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                aria-label={t("co2Source.search", "Search sources")}
                placeholder={t("co2Source.search", "Search sources")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-xs text-foreground transition-colors duration-150 placeholder:text-muted-foreground focus:border-ring focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => setFiltersOpen((prev) => !prev)}
              aria-expanded={filtersOpen}
              aria-label={t("co2Source.filters", "Filter sources")}
              className={cn(
                "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors duration-150",
                filtersOpen || activeFilters > 0
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {activeFilters > 0 && (
                <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-semibold text-primary-foreground">
                  {activeFilters}
                </span>
              )}
            </button>
          </div>

          <Collapsible expanded={filtersOpen}>
            <div className="space-y-2.5 pt-3">
              <FilterChips
                label={t("co2Source.country", "Country")}
                options={countryOptions}
                active={country}
                onPick={(value) => { setCountry(value); setPage(0); }}
                allLabel={t("co2Source.allCountries", "All")}
              />
              <FilterChips
                label={t("co2Source.industry", "Industry")}
                options={groupOptions}
                active={group}
                onPick={(value) => { setGroup(value); setPage(0); }}
                allLabel={t("co2Source.allIndustries", "All")}
              />
              <FilterChips
                label={t("co2Source.status", "Status")}
                options={statusOptions}
                active={status}
                onPick={(value) => { setStatus(value); setPage(0); }}
                allLabel={t("co2Source.allStatuses", "All")}
              />
              {activeFilters > 0 && (
                <button
                  type="button"
                  onClick={() => { setCountry(null); setGroup(null); setStatus(null); setPage(0); }}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground underline-offset-2 transition-colors duration-150 hover:text-foreground hover:underline"
                >
                  <X className="h-3 w-3" />
                  {t("co2Source.clearFilters", "Clear filters")}
                </button>
              )}
            </div>
          </Collapsible>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5">
          {catalogue.isLoading && (
            <div className="flex items-center justify-center gap-2 py-12 text-xs text-muted-foreground" role="status">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t("co2Source.loading", "Loading sources…")}
            </div>
          )}
          {catalogue.isError && (
            <div className="my-4 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-3 text-xs text-destructive" role="alert">
              <AlertCircle className="h-3.5 w-3.5" />
              {t("co2Source.error", "Could not load sources.")}
            </div>
          )}
          {catalogue.data && catalogue.data.items.length === 0 && (
            <p className="py-12 text-center text-xs text-muted-foreground">
              {t("co2Source.noMatches", "No sources match your search.")}
            </p>
          )}
          {catalogue.data && catalogue.data.items.length > 0 && (
            <table className={cn("w-full text-xs transition-opacity duration-150", catalogue.isFetching && "opacity-60")}>
              <thead className="sticky top-0 z-10 bg-card">
                <tr className="border-b border-border text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">{t("co2Source.name", "Source")}</th>
                  <th className="py-2 pr-3">{t("co2Source.location", "Location")}</th>
                  <th className="py-2 pr-3">{t("co2Source.country", "Country")}</th>
                  <th className="py-2 pr-3 text-right">{t("co2Source.annual", "t CO₂/year")}</th>
                  <th className="py-2">{t("co2Source.status", "Status")}</th>
                </tr>
              </thead>
              <tbody>
                {catalogue.data.items.map((source) => {
                  const location = [source.municipality, source.state].filter(Boolean).join(", ");
                  const mappable = source.latitude !== null && source.longitude !== null;
                  return (
                    <tr key={source.entity_id} className="border-b border-border/60 transition-colors duration-150 last:border-0 hover:bg-muted/40">
                      <td className="max-w-0 py-2 pr-3">
                        <button
                          className="block max-w-full truncate text-left font-medium text-foreground underline-offset-2 transition-colors duration-150 hover:text-primary hover:underline"
                          onClick={() => setSourceId(source.entity_id)}
                        >
                          {source.name || source.entity_id}
                        </button>
                        {!mappable && (
                          <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                            <MapPinOff className="h-2.5 w-2.5" />
                            {t("co2Source.noCoordinates", "No map coordinates")}
                          </span>
                        )}
                      </td>
                      <td className="max-w-0 py-2 pr-3">
                        <span className="block truncate text-muted-foreground">{location || "—"}</span>
                      </td>
                      <td className="py-2 pr-3">
                        {source.country && (
                          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {source.country}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatTonnes(source.co2_t_annual)}</td>
                      <td className="py-2">
                        {source.status ? (
                          <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {sourceValue(source.status)}
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3">
          <Button size="sm" variant="outline" disabled={page === 0 || catalogue.isFetching} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-3 w-3" />{t("co2Source.previous", "Previous")}
          </Button>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {total === 0
              ? t("co2Source.empty", "0 sources")
              : t("co2Source.pageInfo", "{{start}}–{{end}} of {{total}} · page {{page}}/{{pages}}", {
                  start: rangeStart.toLocaleString(),
                  end: rangeEnd.toLocaleString(),
                  total: total.toLocaleString(),
                  page: (page + 1).toLocaleString(),
                  pages: pageCount.toLocaleString(),
                })}
          </span>
          <Button size="sm" variant="outline" disabled={!catalogue.data || catalogue.isFetching || page + 1 >= pageCount} onClick={() => setPage(page + 1)}>
            {t("co2Source.next", "Next")}<ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    <SourceDetails sourceId={sourceId} onClose={() => setSourceId(null)} />
  </div>;
}
