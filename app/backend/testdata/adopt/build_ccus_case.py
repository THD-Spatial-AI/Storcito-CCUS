"""Build, validate and (optionally) solve a small CCUS case in AdOpT-NET0's
native input format, as described by meme's schemas/adopt_net0_schema.json.

    python build_ccus_case.py <case_dir> [--schema adopt_net0_schema.json]
                              [--solve] [--step-hours 12] [--typical-days N]

Sources are CO2captured imports (limit = capture rate, price = capture cost
minus avoided CO2 price), sinks are PermanentStorage_CO2_simple technologies
with per-site injection rate / storage size / fee, and transport runs over
CO2_Pipeline and CO2Railway networks (node-by-node connection, distance and
size_max_arcs matrices). Network CAPEX is linear (gamma4 only) so the optimum
can be checked by hand.
"""
import argparse
import json
import shutil
import sys
from datetime import datetime, timedelta
from pathlib import Path

PERIOD = "period1"
# AdOpT annualizes CAPEX over fraction_of_year_modelled = selected / Topology
# timesteps, i.e. it treats the Topology horizon as one year. Model a full year.
START = "2025-01-01 00:00"
HOURS = 8760
STEP_H = 1  # overridden by --step-hours

# node -> (lon, lat); order is the matrix order.
NODES = {
    "src_steel_salzgitter": (10.3960, 52.1586),
    "src_cement_laegerdorf": (9.5833, 53.8833),
    "src_chem_ludwigshafen": (8.4270, 49.4958),
    "hub_bremen": (8.8017, 53.0793),
    "sink_hub_wilhelmshaven": (8.1300, 53.5300),
    "sink_hub_brunsbuettel": (9.1400, 53.8960),
}
CARRIERS = ["CO2captured", "electricity"]

# Capture: t/h limit and EUR/t import price (capture cost - avoided CO2 price).
SOURCES = {
    "src_steel_salzgitter": (228, -45),
    "src_cement_laegerdorf": (137, -30),
    "src_chem_ludwigshafen": (91, -25),
}
# Storage: t/h injection rate, t storage size, EUR/t fee.
SINKS = {
    "sink_hub_wilhelmshaven": (250, 1e7, 20),
    "sink_hub_brunsbuettel": (150, 1e7, 22),
}
ELECTRICITY_PRICE = 50  # EUR/MWh, imported at sink nodes (injection uses 0.034 MWh/t)

# Networks: database name -> (EUR per t/h per km, arcs [(from, to, km)]).
NETWORKS = {
    "CO2_Pipeline": (5, [
        ("src_steel_salzgitter", "hub_bremen", 150),
        ("src_cement_laegerdorf", "sink_hub_brunsbuettel", 40),
        ("hub_bremen", "sink_hub_wilhelmshaven", 90),
        ("hub_bremen", "sink_hub_brunsbuettel", 120),
    ]),
    "CO2Railway": (10, [
        ("src_chem_ludwigshafen", "hub_bremen", 500),
    ]),
}
ARC_SIZE_MAX = 1000  # t/h
DISCOUNT_RATE, NETWORK_LIFETIME = 0.08, 40


def val(v):
    return {"value": v}


def write_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n")


def write_csv(path: Path, header, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [";".join(header)] + [";".join(str(c) for c in r) for r in rows]
    path.write_text("\n".join(lines) + "\n")


def timestamps():
    t0 = datetime.strptime(START, "%Y-%m-%d %H:%M")
    return [(t0 + timedelta(hours=h)).strftime("%Y-%m-%d %H:%M:%S") for h in range(0, HOURS, STEP_H)]


def config_model(root: Path, typical_days: int = 0):
    results = str((root.parent / "results").resolve())
    return {
        "optimization": {
            "objective": val("costs"), "emission_limit": val(0),
            "monte_carlo": {"N": val(0), "type": val("normal_dis"), "sd": val(0.2),
                            "on_what": val(["Technologies"])},
            "typicaldays": {"N": val(typical_days), "method": val(2),
                            "technologies_with_full_res": val(["RES", "STOR", "Hydro_Open"])},
            "multiyear": val(0), "timestaging": val(0), "pareto_points": val(5),
        },
        "solveroptions": {"solver": val("glpk"), "mipgap": val(0.001), "timelim": val(1),
                          "threads": val(0), "nodetol": val(1e-9)},
        "reporting": {"save_path": val(results), "save_summary_path": val(results),
                      "write_results": val(1), "case_name": val(-1),
                      "write_solution_diagnostics": val(0)},
        "energybalance": {"copperplate": val(0), "violation": val(-1)},
        "economic": {"global_discountrate": val(DISCOUNT_RATE), "global_simple_capex_model": val(0)},
        "performance": {"dynamics": val(0)},
        "scaling": {"scaling_on": val(0), "scaling_factors": {
            "energy_vars": val(0.001), "cost_vars": val(0.001), "objective": val(1)}},
    }


def build(root: Path, typical_days: int = 0):
    if root.exists():
        shutil.rmtree(root)
    period = root / PERIOD
    names = list(NODES)

    write_json(root / "Topology.json", {
        "nodes": names, "carriers": CARRIERS, "investment_periods": [PERIOD],
        "start_date": START, "end_date": timestamps()[-1][:16], "resolution": f"{STEP_H}h",
        "investment_period_length": 1,
    })
    write_json(root / "ConfigModel.json", config_model(root, typical_days))
    write_csv(root / "NodeLocations.csv", ["", "lon", "lat", "alt"],
              [[n, lon, lat, 0] for n, (lon, lat) in NODES.items()])

    # Networks: list + node-by-node matrices (rows = from, columns = to).
    write_json(period / "Networks.json", {"existing": [], "new": list(NETWORKS)})
    # copy_network_data uses shutil.copy: the target dir must already exist.
    (period / "network_data").mkdir(parents=True, exist_ok=True)
    for net, (_, arcs) in NETWORKS.items():
        conn = {(a, b): 1 for a, b, _ in arcs}
        dist = {(a, b): km for a, b, km in arcs}
        base = period / "network_topology" / "new" / net
        for fname, cell in (("connection.csv", lambda a, b: conn.get((a, b), 0)),
                            ("distance.csv", lambda a, b: dist.get((a, b), 0)),
                            ("size_max_arcs.csv", lambda a, b: ARC_SIZE_MAX * STEP_H if (a, b) in conn else 0)):
            write_csv(base / fname, [""] + names, [[a] + [cell(a, b) for b in names] for a in names])

    ts = timestamps()
    cols = ["Demand", "Import limit", "Export limit", "Import price", "Export price",
            "Import emission factor", "Export emission factor", "Generic production"]
    for node in names:
        nd = period / "node_data" / node
        write_json(nd / "Technologies.json",
                   {"existing": {}, "new": ["PermanentStorage_CO2_simple"] if node in SINKS else []})
        write_json(nd / "carrier_data" / "EnergybalanceOptions.json",
                   {c: {"curtailment_possible": 0} for c in CARRIERS})
        write_csv(nd / "CarbonCost.csv", ["", "price", "subsidy"], [[t, 0, 0] for t in ts])
        write_csv(nd / "ClimateData.csv", ["", "ghi", "dni", "dhi", "temp_air", "rh", "ws10"],
                  [[t, 0, 0, 0, 0, 0, 0] for t in ts])
        for car in CARRIERS:
            imp_lim = imp_price = 0
            if car == "CO2captured" and node in SOURCES:
                rate, imp_price = SOURCES[node]
                imp_lim = rate * STEP_H
            if car == "electricity" and node in SINKS:
                imp_lim, imp_price = 1000 * STEP_H, ELECTRICITY_PRICE
            write_csv(nd / "carrier_data" / f"{car}.csv", [""] + cols,
                      [[t, 0, imp_lim, 0, imp_price, 0, 0, 0, 0] for t in ts])
        if node in SINKS:
            (nd / "technology_data").mkdir(parents=True, exist_ok=True)


def patch_templates(root: Path):
    """After adopt's copy_* helpers: per-sink limits/fees and linear network CAPEX.

    AdOpT reads every flow as an amount per timestep, so with STEP_H-hour steps
    rates become t/step (x STEP_H) and cost per unit of size is divided by
    STEP_H; reported network sizes are then t/step (divide by STEP_H for t/h).
    """
    period = root / PERIOD
    for node, (rate, size, fee) in SINKS.items():
        f = period / "node_data" / node / "technology_data" / "PermanentStorage_CO2_simple.json"
        d = json.loads(f.read_text())
        d["size_max"] = size
        d["Flexibility"]["injection_rate_max"] = rate * STEP_H
        d["Economics"]["OPEX_variable"] = fee
        write_json(f, d)
    for net, (gamma4, _) in NETWORKS.items():
        f = period / "network_data" / f"{net}.json"
        d = json.loads(f.read_text())
        d["size_max"] = ARC_SIZE_MAX * STEP_H
        d["Economics"].update(gamma1=0, gamma2=0, gamma3=0, gamma4=gamma4 / STEP_H,
                              OPEX_variable=0, OPEX_fixed=0,
                              discount_rate=DISCOUNT_RATE, lifetime=NETWORK_LIFETIME)
        d["Performance"]["loss"] = 0
        # No transport energy use in this smoke case (keeps the check linear).
        d["Performance"]["energyconsumption"] = {}
        write_json(f, d)


def validate(root: Path, schema_path: Path):
    import jsonschema
    schema = json.loads(schema_path.read_text())

    def check(defn, f):
        sub = {"$schema": schema.get("$schema"), "$defs": schema["$defs"], "$ref": f"#/$defs/{defn}"}
        jsonschema.validate(json.loads(f.read_text()), sub,
                            cls=jsonschema.validators.validator_for(schema))
        return f.relative_to(root).as_posix()

    period = root / PERIOD
    done = [check("Topology", root / "Topology.json"),
            check("ConfigModel", root / "ConfigModel.json"),
            check("Networks", period / "Networks.json")]
    done += [check("NetworkDataFile", f) for f in sorted((period / "network_data").glob("*.json"))]
    for nd in sorted((period / "node_data").iterdir()):
        done.append(check("Technologies", nd / "Technologies.json"))
        done.append(check("EnergybalanceOptions", nd / "carrier_data" / "EnergybalanceOptions.json"))
        done += [check("TechnologyDataFile", f) for f in sorted((nd / "technology_data").glob("*.json"))]
    print(f"schema: {len(done)} JSON files valid")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("case_dir", type=Path)
    ap.add_argument("--schema", type=Path)
    ap.add_argument("--solve", action="store_true")
    ap.add_argument("--step-hours", type=int, default=1, help="timestep length in hours")
    ap.add_argument("--typical-days", type=int, default=0,
                    help="cluster the year into N typical days (0 = full resolution)")
    args = ap.parse_args()

    root = args.case_dir / "input_data"
    global STEP_H
    STEP_H = args.step_hours
    build(root, args.typical_days)
    (args.case_dir / "results").mkdir(exist_ok=True)

    import adopt_net0 as adopt
    adopt.copy_technology_data(root)
    adopt.copy_network_data(root)
    patch_templates(root)

    if args.schema:
        validate(root, args.schema)
    if args.solve:
        m = adopt.ModelHub()
        m.read_data(root)
        m.quick_solve()
    return 0


if __name__ == "__main__":
    sys.exit(main())
