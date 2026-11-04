// Imports STORE_CO2 nodes.
package main

import (
	"context"
	"flag"
	"log"
	"time"

	"platform.local/platform/database"

	"spatialhub_backend/internal/config"
	"spatialhub_backend/internal/handler/co2nodes"
	"spatialhub_backend/internal/storeco2"
)

func main() {
	country := flag.String("country", "", "DE, NL or NO")
	timeout := flag.Duration("timeout", 10*time.Minute, "Import timeout")
	flag.Parse()

	cfg, err := config.LoadFromEnv()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	db, sqlDB, err := database.ConnectWithPing(cfg.Database)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer sqlDB.Close()

	ctx, cancel := context.WithTimeout(context.Background(), *timeout)
	defer cancel()

	log.Printf("Importing STORE_CO2 nodes from %s ...", cfg.StoreCO2URL)
	result, err := co2nodes.ImportNodes(ctx, db, storeco2.NewClient(cfg.StoreCO2URL), co2nodes.ImportOptions{
		Country: *country,
		All:     true,
	})
	if err != nil {
		log.Fatalf("STORE_CO2 import failed: %v", err)
	}

	log.Printf("Imported %d emitters and %d sinks, removed %d stale nodes (dataset %s). co2_nodes now holds %d rows.",
		result.Imported, result.Sinks, result.Removed, result.DatasetVersion, result.Total)
}
