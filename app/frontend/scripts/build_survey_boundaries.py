"""Builds public/data/nuts-survey.geojson: one shape per survey region.

Borders: Eurostat GISCO NUTS 2024, 1:1M (© EuroGeographics),
  https://gisco-services.ec.europa.eu/distribution/v2/nuts/geojson/NUTS_RG_01M_2024_4326_LEVL_{1,2,3}.geojson
Lakes cut out: OpenStreetMap (© OpenStreetMap contributors, ODbL), extracted once via Overpass:
  nwr["natural"="water"]["water"~"^(lake|reservoir|lagoon)$"](area:<country>)(if:length()><m>); out geom;
  (NL 25 km, DE 30 km, NO 60 km perimeter), saved as osm_lakes_<cc>.json.
Grouping: read from app/backend/internal/survey/regions.go, the single source of truth.

Usage: python build_survey_boundaries.py --lakes osm_lakes_nl.json osm_lakes_de.json osm_lakes_no.json \\
         -- LEVL_1.geojson LEVL_2.geojson LEVL_3.geojson
"""
import json
import math
import re
import sys
from pathlib import Path

from shapely import set_precision
from shapely.geometry import LineString, Polygon, mapping, shape
from shapely.ops import linemerge, polygonize, unary_union
from shapely.validation import make_valid

ROOT = Path(__file__).resolve().parents[2]
REGIONS_GO = ROOT / "backend" / "internal" / "survey" / "regions.go"
TARGET = Path(__file__).resolve().parent.parent / "public" / "data" / "nuts-survey.geojson"

# Units per country.
LEVELS = {"DE": 1, "NL": 2, "NO": 2}
SPLIT = {"NO0A": ["NO0A1", "NO0A2", "NO0A3"]}
SKIP = {"NO0B"}  # Svalbard.
MIN_LAKE_KM2 = 3.0
SIMPLIFY_DEG = 0.0004  # ~40 m.


def survey_groups():
    """Region name -> NUTS prefixes, per country, from regions.go."""
    text = REGIONS_GO.read_text(encoding="utf8")
    groups = {}
    starts = [(m.group(1), m.end()) for m in re.finditer(r'"(DE|NL|NO)":\s*\{', text)]
    for i, (country, start) in enumerate(starts):
        end = starts[i + 1][1] if i + 1 < len(starts) else len(text)
        block = text[start:end]
        for m in re.finditer(r'"([^"]+)":\s*\{\s*NUTS:\s*\[\]string\{([^}]*)\}', block):
            groups[(country, m.group(1))] = re.findall(r'"([^"]+)"', m.group(2))
    if not groups:
        sys.exit("no regions parsed from regions.go")
    return groups


def km2(geom):
    lat = geom.centroid.y
    return geom.area * 111.32 * 111.32 * math.cos(math.radians(lat))


def lake_polygons(paths):
    polygons = []
    for path in paths:
        for el in json.loads(Path(path).read_text(encoding="utf8"))["elements"]:
            if el["type"] == "way" and len(el.get("geometry", [])) >= 4:
                ring = [(p["lon"], p["lat"]) for p in el["geometry"]]
                if ring[0] == ring[-1]:
                    polygons.append(make_valid(Polygon(ring)))
            elif el["type"] == "relation":
                lines = {"outer": [], "inner": []}
                for member in el.get("members", []):
                    if member.get("type") == "way" and member.get("geometry"):
                        coords = [(p["lon"], p["lat"]) for p in member["geometry"]]
                        if len(coords) >= 2:
                            lines.setdefault(member.get("role") or "outer", []).append(LineString(coords))
                outer = unary_union(list(polygonize(linemerge(lines["outer"])))) if lines["outer"] else None
                if outer is None or outer.is_empty:
                    continue
                inner = unary_union(list(polygonize(linemerge(lines["inner"])))) if lines["inner"] else None
                polygons.append(make_valid(outer.difference(inner) if inner else outer))
    lakes = [p for p in polygons if not p.is_empty and km2(p) >= MIN_LAKE_KM2]
    print(f"{len(lakes)} lakes >= {MIN_LAKE_KM2} km2")
    return unary_union(lakes).simplify(SIMPLIFY_DEG, preserve_topology=True)


def polygons_only(geom):
    parts = getattr(geom, "geoms", [geom])
    return unary_union([g for g in parts if g.geom_type in ("Polygon", "MultiPolygon")])


def snapped(geom):
    """~10 m grid, stays valid."""
    return polygons_only(set_precision(make_valid(geom), 1e-4))


def main(nuts_paths, lake_paths):
    features = [f for p in nuts_paths for f in json.loads(Path(p).read_text(encoding="utf8"))["features"]]
    wanted = set()
    for f in features:
        p = f["properties"]
        if LEVELS.get(p["CNTR_CODE"]) == p["LEVL_CODE"] and p["NUTS_ID"] not in SKIP:
            wanted.update(SPLIT.get(p["NUTS_ID"], [p["NUTS_ID"]]))
    units = {f["properties"]["NUTS_ID"]: f for f in features if f["properties"]["NUTS_ID"] in wanted}
    missing = wanted - set(units)
    if missing:
        sys.exit(f"missing units: {sorted(missing)}")

    lakes = lake_polygons(lake_paths) if lake_paths else None
    shapes = {}
    for code, f in units.items():
        area = make_valid(shape(f["geometry"]))
        if lakes is not None:
            area = area.difference(lakes)
        shapes[code] = polygons_only(area)

    out, used = [], set()
    for (country, name), prefixes in sorted(survey_groups().items()):
        # Longest prefix wins.
        codes = [c for c in shapes if c.startswith(country) and any(c.startswith(p) for p in prefixes)]
        codes = [c for c in codes if c not in used]
        if not codes:
            continue
        used.update(codes)
        merged = polygons_only(make_valid(unary_union([shapes[c] for c in codes]).buffer(0)))
        out.append((f"{country}:{name}", country, name, codes, merged))
    for code in sorted(set(shapes) - used):
        props = units[code]["properties"]
        out.append((None, props["CNTR_CODE"], props["NAME_LATN"], [code], shapes[code]))

    collection = {
        "type": "FeatureCollection",
        "attribution": "© EuroGeographics for the administrative boundaries; lakes © OpenStreetMap contributors (ODbL)",
        "features": [
            {
                "type": "Feature",
                "properties": {"key": key, "country": country, "name": name, "nuts": codes},
                "geometry": mapping(snapped(geom)),
            }
            for key, country, name, codes, geom in out
        ],
    }
    TARGET.write_text(json.dumps(collection, ensure_ascii=False, separators=(",", ":")), encoding="utf8")
    print(f"{len(out)} features ({sum(1 for o in out if o[0])} regions) -> {TARGET} ({TARGET.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    args = sys.argv[1:]
    lakes = []
    if args[:1] == ["--lakes"]:
        split = args.index("--")
        lakes, args = args[1:split], args[split + 1:]
    main(args, lakes)
