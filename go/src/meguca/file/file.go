// File package provides file backend abstraction.
package file

import (
	"net/http"
	"strings"

	"meguca/common"
	"meguca/config"
)

// Current file backend.
var Backend FileBackend

type Config struct {
	Backend   string
	Dir       string
	Username  string
	Password  string
	AuthURL   string
	Container string
}

type FileBackend interface {
	IsServable() bool
	Serve(w http.ResponseWriter, r *http.Request)
	Write(sha1 string, fileType, thumbType uint8, src, thumb []byte) error
	Delete(sha1 string, fileType, thumbType uint8) error
}

const (
	DefaultUploadsRoot = "/uploads"
	srcDir             = "src"
	thumbDir           = "thumb"
)

func StartBackend(conf Config) (err error) {
	if conf.Backend == "fs" {
		Backend, err = makeFSBackend(conf)
	} else if conf.Backend == "swift" {
		Backend, err = makeSwiftBackend(conf)
	} else {
		panic("unknown backend")
	}
	return
}

func getImageRoot() string {
	r := config.Get().ImageRootOverride
	if r != "" {
		return r
	}
	return DefaultUploadsRoot
}

func getImageURL(root string, dir string, typ uint8, sha1 string) string {
	return strings.Join([]string{root, dir, sha1[:2], sha1[2:] + "." + common.Extensions[typ]}, "/")
}

func SourcePath(fileType uint8, sha1 string) string {
	return getImageURL(getImageRoot(), srcDir, fileType, sha1)
}

func ThumbPath(thumbType uint8, sha1 string) string {
	return getImageURL(getImageRoot(), thumbDir, thumbType, sha1)
}
