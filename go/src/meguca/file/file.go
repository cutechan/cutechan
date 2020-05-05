// Package file provides file backend abstraction.
package file

import (
	"net/http"
	"strings"

	"meguca/common"
	"meguca/config"
)

// Backend equals to current file backend.
var Backend fileBackend

// Config contains parameters for all backends.
type Config struct {
	Backend   string
	Dir       string
	Address   string
	HostKey   string
	Username  string
	Password  string
	AuthURL   string
	Container string
}

type fileBackend interface {
	IsServable() bool
	Serve(w http.ResponseWriter, r *http.Request)
	Write(sha1 string, fileType, thumbType uint8, src, thumb []byte) error
	Delete(sha1 string, fileType, thumbType uint8) error
}

const (
	// DefaultUploadsRoot is a static content endpoin URL.
	DefaultUploadsRoot = "/uploads"
	srcDir             = "src"
	thumbDir           = "thumb"
)

// StartBackend initializes file backend.
func StartBackend(conf Config) (err error) {
	if conf.Backend == "fs" {
		Backend, err = makeFSBackend(conf)
	} else if conf.Backend == "sftp" {
		Backend, err = makeSFTPBackend(conf)
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

// SourcePath returns URL to file source.
func SourcePath(fileType uint8, sha1 string) string {
	return getImageURL(getImageRoot(), srcDir, fileType, sha1)
}

// ThumbPath returns URL to file thumbnail.
func ThumbPath(thumbType uint8, sha1 string) string {
	return getImageURL(getImageRoot(), thumbDir, thumbType, sha1)
}
