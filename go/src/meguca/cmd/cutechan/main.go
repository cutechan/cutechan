package main

import (
	"fmt"
	"log"
	"reflect"

	"meguca/assets"
	"meguca/auth"
	"meguca/cache"
	"meguca/common"
	"meguca/db"
	"meguca/geoip"
	"meguca/lang"
	"meguca/server"
	"meguca/templates"
	"meguca/util"

	"github.com/BurntSushi/toml"
	"github.com/Kagami/kpopnet/go/src/kpopnet"
	"github.com/docopt/docopt-go"
)

const VERSION = "0.0.0"
const USAGE = `
Usage:
  cutechan [options]
  cutechan [-h | --help]
  cutechan [-V | --version]
  cutechan profile import [options]

Serve a k-pop oriented imageboard.

Options:
  -h --help     Show this screen.
  -V --version  Show version.
  --debug       Enable debug server routes (pprof).
  -H <host>     Host to listen on (default: 127.0.0.1).
  -p <port>     Port to listen on (default: 8001).
  -c <conn>     PostgreSQL connection string
                (default: user=meguca password=meguca dbname=meguca sslmode=disable).
  -r            Assume server is behind reverse proxy when resolving client IPs.
  -y            Use secure cookies.
  -z <size>     Cache size in megabytes (default: 128).
  -s <sitedir>  Site directory location (default: ./dist).
  -f <filedir>  Uploads directory location (default: ./uploads).
  -d <datadir>  Kpopnet data directory location (default: ./go/src/github.com/Kagami/kpopnet/data).
  -g <geodir>   GeoIP databases directory location (default: ./geoip).
  -o <origin>   Allowed origin for Idol API (default: http://localhost:8000).
  --cfg <path>  Path to TOML config (default: ./cutechan.toml.example).
`

// Duplicates USAGE so make sure to update consistently!
// NOTE(Kagami): We don't use docopt's way to set defaults because need
// to distinguish explicitly set options.
var defaultConfig = config{
	Host:    "127.0.0.1",
	Port:    8001,
	Conn:    "user=meguca password=meguca dbname=meguca sslmode=disable",
	Cache:   128,
	SiteDir: "./dist",
	FileDir: "./uploads",
	DataDir: "./go/src/github.com/Kagami/kpopnet/data",
	GeoDir:  "./geoip",
	Origin:  "http://localhost:8000",
	Path:    "./cutechan.toml.example",
}

type config struct {
	Profile bool `toml:"-"`
	Import  bool `toml:"-"`
	Debug   bool
	Host    string `docopt:"-H"`
	Port    int    `docopt:"-p"`
	Conn    string `docopt:"-c"`
	Rproxy  bool   `docopt:"-r"`
	Secure  bool   `docopt:"-y"`
	Cache   int    `docopt:"-z"`
	SiteDir string `docopt:"-s" toml:"site_dir"`
	FileDir string `docopt:"-f" toml:"file_dir"`
	DataDir string `docopt:"-d" toml:"data_dir"`
	GeoDir  string `docopt:"-g" toml:"geo_dir"`
	Origin  string `docopt:"-o"`
	Path    string `docopt:"--cfg" toml:"-"`
}

// Merge non-zero values from additional config.
func merge(conf, confAdd, confDef *config) {
	v := reflect.ValueOf(conf).Elem()
	vAdd := reflect.ValueOf(confAdd).Elem()
	vDef := reflect.ValueOf(confDef).Elem()
	for i := 0; i < v.NumField(); i++ {
		f := v.Field(i)
		fAdd := vAdd.Field(i)
		fDef := vDef.Field(i)
		zeroVal := reflect.Zero(f.Type())
		// Values from first config has highest priority.
		// Go further only if nothing explicitly set.
		if reflect.DeepEqual(f.Interface(), zeroVal.Interface()) {
			if reflect.DeepEqual(fAdd.Interface(), zeroVal.Interface()) {
				// Nothing in additional config.
				f.Set(fDef)
			} else {
				// Something in additional config.
				f.Set(fAdd)
			}
		}
	}
}

func importProfiles(conf config) {
	log.Printf("Importing profiles from %s", conf.DataDir)
	if err := kpopnet.ImportProfiles(conf.Conn, conf.DataDir); err != nil {
		log.Fatal(err)
	}
	log.Print("Done.")
}

func serve(conf config) {
	// Set subsystem options.
	// TODO(Kagami): Use config structs instead of globals.
	db.ConnArgs = conf.Conn
	auth.IsReverseProxied = conf.Rproxy
	server.SecureCookie = conf.Secure
	cache.Size = conf.Cache
	common.WebRoot = conf.SiteDir
	common.ImageWebRoot = conf.FileDir
	server.IdolOrigin = conf.Origin
	address := fmt.Sprintf("%v:%v", conf.Host, conf.Port)
	loadGeoIP := func() error {
		return geoip.Load(conf.GeoDir)
	}
	startKpopnetFaceRec := func() error {
		return kpopnet.StartFaceRec(conf.DataDir)
	}

	// Prepare subsystems.
	err := util.RunTasks([][]util.Task{
		[]util.Task{db.StartDB, assets.CreateDirs, loadGeoIP, lang.Load, templates.CompileMustache},
		[]util.Task{startKpopnetFaceRec},
	})
	if err != nil {
		log.Fatalf("Error preparing server: %v", err)
	}

	// Start serving requests.
	log.Printf("Listening on %v", address)
	log.Fatal(server.Start(address, conf.Debug))
}

func main() {
	opts, err := docopt.ParseArgs(USAGE, nil, VERSION)
	if err != nil {
		log.Fatal(err)
	}

	var conf config
	if err := opts.Bind(&conf); err != nil {
		log.Fatal(err)
	}
	if conf.Path == "" {
		conf.Path = defaultConfig.Path
	}

	var confFile config
	if _, err := toml.DecodeFile(conf.Path, &confFile); err != nil {
		log.Fatal(err)
	}
	merge(&conf, &confFile, &defaultConfig)

	if conf.Profile && conf.Import {
		importProfiles(conf)
	} else {
		serve(conf)
	}
}
