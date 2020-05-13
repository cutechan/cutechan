package main

import (
	"fmt"
	"log"
	"reflect"

	"github.com/cutechan/cutechan/go/auth"
	"github.com/cutechan/cutechan/go/cache"
	"github.com/cutechan/cutechan/go/db"
	"github.com/cutechan/cutechan/go/file"
	"github.com/cutechan/cutechan/go/geoip"
	"github.com/cutechan/cutechan/go/lang"
	"github.com/cutechan/cutechan/go/server"
	"github.com/cutechan/cutechan/go/templates"
	"github.com/cutechan/cutechan/go/util"

	"github.com/BurntSushi/toml"
	"github.com/docopt/docopt-go"
)

// VERSION is current version.
const VERSION = "0.0.0"

// USAGE is usage help in docopt DSL.
const USAGE = `
Usage:
  cutechan [options]
  cutechan [-h | --help]
  cutechan [-V | --version]

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
  -u <user>     Spawn thumbnail process as separate user.
  -z <size>     Cache size in megabytes (default: 128).
  -s <sitedir>  Site directory location (default: ./dist).
  --cfg <path>  Path to TOML config.
`

// Duplicates USAGE so make sure to update consistently!
// NOTE(Kagami): We don't use docopt's way to set defaults because need
// to distinguish explicitly set options.
var confDefault = config{
	Host:          "127.0.0.1",
	Port:          8001,
	Conn:          "user=meguca password=meguca dbname=meguca sslmode=disable",
	Cache:         128,
	SiteDir:       "./dist",
	GeoHeader:     "",
	FileBackend:   "fs",
	FileDir:       "./uploads",
	FileAddress:   "localhost:22",
	FileHostKey:   "",
	FileUsername:  "cutechan",
	FilePassword:  "password",
	FileAuthURL:   "https://localhost/v1.0",
	FileContainer: "uploads",
}

type config struct {
	Debug         bool
	Host          string `docopt:"-H"`
	Port          int    `docopt:"-p"`
	Conn          string `docopt:"-c"`
	Rproxy        bool   `docopt:"-r"`
	Secure        bool   `docopt:"-y"`
	User          string `docopt:"-u"`
	Cache         int    `docopt:"-z"`
	SiteDir       string `docopt:"-s" toml:"site_dir"`
	GeoHeader     string `docopt:"-g" toml:"geo_header"`
	Path          string `docopt:"--cfg" toml:"-"`
	FileBackend   string `toml:"file_backend"`
	FileDir       string `toml:"file_dir"`
	FileAddress   string `toml:"file_address"`
	FileHostKey   string `toml:"file_host_key"`
	FileUsername  string `toml:"file_username"`
	FilePassword  string `toml:"file_password"`
	FileAuthURL   string `toml:"file_auth_url"`
	FileContainer string `toml:"file_container"`
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

func serve(conf config) {
	// TODO(Kagami): Use config structs instead of globals.
	db.ConnArgs = conf.Conn
	cache.Size = conf.Cache
	auth.IsReverseProxied = conf.Rproxy
	geoip.CountryHeader = conf.GeoHeader

	startFileBackend := func() error {
		return file.StartBackend(file.Config{
			Backend:   conf.FileBackend,
			Dir:       conf.FileDir,
			Address:   conf.FileAddress,
			HostKey:   conf.FileHostKey,
			Username:  conf.FileUsername,
			Password:  conf.FilePassword,
			AuthURL:   conf.FileAuthURL,
			Container: conf.FileContainer,
		})
	}

	// Prepare subsystems.
	err := util.RunTasks([][]util.Task{{db.StartDB, lang.Load, templates.CompileMustache, startFileBackend}})
	if err != nil {
		log.Fatalf("Error preparing server: %v", err)
	}

	// Start serving requests.
	address := fmt.Sprintf("%v:%v", conf.Host, conf.Port)
	log.Printf("Listening on %v", address)
	log.Fatal(server.Start(server.Config{
		DebugRoutes:  conf.Debug,
		Address:      address,
		SecureCookie: conf.Secure,
		ThumbUser:    conf.User,
		SiteDir:      conf.SiteDir,
	}))
}

func main() {
	var conf config
	var confFromFile config

	opts, err := docopt.ParseArgs(USAGE, nil, VERSION)
	if err != nil {
		log.Fatal(err)
	}
	if err := opts.Bind(&conf); err != nil {
		log.Fatal(err)
	}
	if conf.Path != "" {
		if _, err := toml.DecodeFile(conf.Path, &confFromFile); err != nil {
			log.Fatal(err)
		}
	}
	merge(&conf, &confFromFile, &confDefault)

	if conf.FileBackend != "fs" && conf.FileBackend != "sftp" && conf.FileBackend != "swift" {
		log.Fatalf("Bad uploads backend: %s", conf.FileBackend)
	}

	serve(conf)
}
