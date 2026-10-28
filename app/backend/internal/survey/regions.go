package survey

// regionArea: covered nodes.
type regionArea struct {
	NUTS   []string // Code prefixes.
	States []string // Fallback names.
}

// Regions per country.
// Bremen: no data.
var regionAreas = map[string]map[string]regionArea{
	"DE": {
		"Baden-Württemberg": {NUTS: []string{"DE1"}, States: []string{"Baden-Württemberg"}},
		"Bayern":            {NUTS: []string{"DE2"}, States: []string{"Bayern"}},
		"Brandenburg, Berlin, Mecklenburg-Vorpommern": {
			NUTS:   []string{"DE3", "DE4", "DE8"},
			States: []string{"Berlin", "Brandenburg", "Mecklenburg-Vorpommern"},
		},
		"Hessen":                         {NUTS: []string{"DE7"}, States: []string{"Hessen"}},
		"Niedersachsen":                  {NUTS: []string{"DE9"}, States: []string{"Niedersachsen"}},
		"Nordrhein-Westfalen":            {NUTS: []string{"DEA"}, States: []string{"Nordrhein-Westfalen"}},
		"Rheinland-Pfalz":                {NUTS: []string{"DEB"}, States: []string{"Rheinland-Pfalz"}},
		"Saarland":                       {NUTS: []string{"DEC"}, States: []string{"Saarland"}},
		"Sachsen and Sachsen-Anhalt":     {NUTS: []string{"DED", "DEE"}, States: []string{"Sachsen", "Sachsen-Anhalt"}},
		"Schleswig-Holstein and Hamburg": {NUTS: []string{"DEF", "DE6"}, States: []string{"Schleswig-Holstein", "Hamburg"}},
		"Thüringen":                      {NUTS: []string{"DEG"}, States: []string{"Thüringen"}},
	},
	"NL": {
		"Drenthe":                  {NUTS: []string{"NL13"}, States: []string{"Drenthe"}},
		"Fryslân":                  {NUTS: []string{"NL12"}, States: []string{"Friesland", "Fryslân"}},
		"Gelderland and Flevoland": {NUTS: []string{"NL22", "NL23"}, States: []string{"Gelderland", "Flevoland"}},
		"Groningen":                {NUTS: []string{"NL11"}, States: []string{"Groningen"}},
		"Limburg":                  {NUTS: []string{"NL42"}, States: []string{"Limburg"}},
		"Noord-Brabant":            {NUTS: []string{"NL41"}, States: []string{"Noord-Brabant"}},
		"Noord-Holland":            {NUTS: []string{"NL32"}, States: []string{"Noord-Holland"}},
		"Overijssel":               {NUTS: []string{"NL21"}, States: []string{"Overijssel"}},
		"Utrecht":                  {NUTS: []string{"NL35"}, States: []string{"Utrecht"}},
		"Zeeland":                  {NUTS: []string{"NL34"}, States: []string{"Zeeland"}},
		"Zuid-Holland":             {NUTS: []string{"NL36"}, States: []string{"Zuid-Holland"}},
	},
	// Møre og Romsdal: Vestlandet.
	"NO": {
		"Østlandet":                {NUTS: []string{"NO02", "NO08"}},
		"Sørlandet inkludert TeVe": {NUTS: []string{"NO09"}},
		"Vestlandet":               {NUTS: []string{"NO0A"}},
		"Midt-Norge":               {NUTS: []string{"NO06"}},
		"Nord-Norge":               {NUTS: []string{"NO07"}},
	},
}

// Countries with survey sheets.
var Countries = []string{"DE", "NL", "NO"}

// nationalName marks the national row.
const nationalName = "All regions"
