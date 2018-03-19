// Package server handles client requests for HTML page rendering, JSON and
// websocket connections
package server

import (
	"bytes"
	"flag"
	"fmt"
	"log"
	"meguca/assets"
	"meguca/auth"
	"meguca/cache"
	"meguca/common"
	"meguca/db"
	"meguca/imager"
	"meguca/lang"
	"meguca/templates"
	"os"
	"runtime"
	"sync"
)

var (
	// debugMode denotes the server has been started with the `debug` parameter.
	// This will cause not to spawn a daemon and stay attached to the launching
	// shell.
	daemonised bool

	// Address is the listening address of the HTTP web server
	address string

	// Add "secure" flag to auth cookies
	secureCookie bool

	// Are we running on Windows?
	isWindows = runtime.GOOS == "windows"

	// Is assigned in ./daemon.go to control/spawn a daemon process. That file
	// is never compiled on Windows and this function is never called.
	handleDaemon func(string)

	// CLI mode arguments and descriptions
	arguments = map[string]string{
		"start":   "start the cutechan server",
		"stop":    "stop a running daemonised cutechan server",
		"restart": "combination of stop + start",
		"debug":   "start server in debug mode without daemonizing (default)",
		"help":    "print this help text",
	}

	isTest bool
)

// Start parses command line arguments and initializes the server.
func Start() {
	// Define flags
	flag.StringVar(
		&address,
		"b",
		"127.0.0.1:8001",
		"address to listen on for incoming HTTP connections",
	)
	flag.StringVar(
		&db.ConnArgs,
		"c",
		`user=meguca password=meguca dbname=meguca sslmode=disable`,
		"PostgreSQL connection arguments",
	)
	flag.BoolVar(
		&auth.IsReverseProxied,
		"r",
		false,
		"assume server is behind reverse proxy when resolving client IPs",
	)
	flag.StringVar(
		&auth.ReverseProxyIP,
		"rip",
		"",
		"IP of the reverse proxy, only needed when reverse proxy is not on localhost",
	)
	flag.IntVar(
		&cache.Size,
		"s",
		128,
		"cache size in megabytes",
	)
	flag.StringVar(
		&common.ImageWebRoot,
		"u",
		"./uploads",
		"file uploads location",
	)
	flag.StringVar(
		&common.WebRoot,
		"w",
		"./dist/static",
		"site static location",
	)
	flag.BoolVar(
		&secureCookie,
		"y",
		false,
		"use secure cookies",
	)

	flag.Usage = printUsage

	// Parse command line arguments
	flag.Parse()
	if cache.Size < 0 {
		log.Fatal("cache size must be a positive number")
	}
	arg := flag.Arg(0)
	if arg == "" {
		arg = "debug"
	}

	// Can't daemonise in windows, so only args they have is "start" and "help"
	if isWindows {
		switch arg {
		case "debug", "start":
			startServer()
		case "init": // For internal use only
			os.Exit(0)
		default:
			printUsage()
		}
	} else {
		handleDaemon(arg)
	}
}

// Constructs and prints the CLI help text
func printUsage() {
	os.Stderr.WriteString("Usage: cutechan [OPTIONS]... [MODE]\n\nMODES:\n")

	toPrint := []string{"start"}
	if !isWindows {
		toPrint = append(toPrint, []string{"stop", "restart"}...)
	} else {
		arguments["debug"] = `alias of "start"`
	}
	toPrint = append(toPrint, []string{"debug", "help"}...)

	help := new(bytes.Buffer)
	for _, arg := range toPrint {
		fmt.Fprintf(help, "  %s\n    \t%s\n", arg, arguments[arg])
	}

	help.WriteString("\nOPTIONS:\n")
	os.Stderr.Write(help.Bytes())
	flag.PrintDefaults()
	os.Stderr.WriteString(
		"\nConsult the bundled README.md for more information.\n",
	)

	os.Exit(1)
}

func startServer() {
	var wg sync.WaitGroup

	load := func(fns ...func() error) {
		for i := range fns {
			wg.Add(1)
			fn := fns[i]
			go func() {
				if err := fn(); err != nil {
					log.Fatal(err)
				}
				wg.Done()
			}()
		}
	}

	load(db.LoadDB, assets.CreateDirs)
	wg.Wait()
	load(lang.Load)
	wg.Wait()
	load(templates.Compile)
	wg.Wait()
	load(templates.CompileMustache)
	wg.Wait()

	imager.Start()

	log.Fatal(startWebServer())
}
