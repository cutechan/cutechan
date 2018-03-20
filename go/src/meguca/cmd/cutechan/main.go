package main

import (
	"fmt"
	"log"

	"meguca/assets"
	"meguca/auth"
	"meguca/cache"
	"meguca/common"
	"meguca/db"
	"meguca/imager"
	"meguca/lang"
	"meguca/server"
	"meguca/templates"
	"meguca/util"

	"github.com/docopt/docopt-go"
)

const VERSION = "0.0.0"
const USAGE = `
Usage:
  cutechan [options]
  cutechan [-h | --help]
  cutechan [-V | --version]
  cutechan profile import [-c <conn>] [-d <datadir>]

Serve a k-pop oriented imageboard.

Options:
  -h --help     Show this screen.
  -V --version  Show version.
  -H <host>     Host to listen on [default: 127.0.0.1].
  -p <port>     Port to listen on [default: 8001].
  -c <conn>     PostgreSQL connection string
                [default: user=meguca password=meguca dbname=meguca sslmode=disable].
  -r            Assume server is behind reverse proxy when resolving client IPs.
  -y            Use secure cookies.
  -z <size>     Cache size in megabytes [default: 128].
  -s <sitedir>  Site directory location [default: ./dist].
  -f <filedir>  Uploads directory location [default: ./uploads].
  -d <datadir>  Kpopnet data directory location [default: ./data].
  -o <origin>   Allowed origin for Idol API [default: http://localhost:8000].
`

type config struct {
	Profile bool
	Import  bool
	Host    string `docopt:"-H"`
	Port    int    `docopt:"-p"`
	Conn    string `docopt:"-c"`
	Rproxy  bool   `docopt:"-r"`
	Secure  bool   `docopt:"-y"`
	Cache   int    `docopt:"-z"`
	SiteDir string `docopt:"-s"`
	FileDir string `docopt:"-f"`
	DataDir string `docopt:"-d"`
	Origin  string `docopt:"-o"`
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

	// Prepare runtime subsystems.
	// TODO(Kagami): Check dependency order. Can we run all in parallel?
	err := util.RunTasks([][]util.Task{
		[]util.Task{db.LoadDB, assets.CreateDirs, imager.Start},
		[]util.Task{lang.Load},
		[]util.Task{templates.Compile, templates.CompileMustache},
	})
	if err != nil {
		log.Fatalf("Error preparing server: %v", err)
	}

	// Start serving requests.
	log.Printf("Listening on %v", address)
	log.Fatal(server.Start(address))
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

	if conf.Profile && conf.Import {
		// importProfiles(conf)
	} else {
		serve(conf)
	}
}
