// File package provides file backend abstraction.
package file

import (
	"net/http"
)

// Current file backend.
var Backend FileBackend

type Config struct {
	Backend  string
	Dir      string
	Username string
	Password string
	AuthURL  string
}

type FileBackend interface {
	IsServable() bool
	Serve(w http.ResponseWriter, r *http.Request)
}

func StartBackend(conf Config) (err error) {
	if conf.Backend == "fs" {
		Backend = makeFSBackend(conf)
	} else if conf.Backend == "swift" {
		Backend = makeSwiftBackend(conf)
	} else {
		panic("unknown backend")
	}
	return
}
