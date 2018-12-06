// File package provides file backend abstraction.
package file

import (
	"net/http"
)

// Public interface for the current backend.
var (
	// Whether backend serves uploads by itself.
	IsServable func() bool
	// Serve uploads handler. Don't call if backend is non-servable.
	Serve http.HandlerFunc
)

type Config struct {
	Backend  string
	Dir      string
	Username string
	Password string
	AuthURL  string
}

var backendConfig Config

func StartBackend(conf Config) (err error) {
	backendConfig = conf
	if conf.Backend == "fs" {
		IsServable = fsIsServable
		Serve = fsServe
	} else if conf.Backend == "swift" {
		IsServable = swiftIsServable
		Serve = swiftServe
	} else {
		panic("unknown backend")
	}
	return
}
