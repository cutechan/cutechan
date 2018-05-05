package server

import (
	"fmt"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"time"

	"meguca/common"
)

var (
	stripNameRe = regexp.MustCompile("^(src/[^/]+/[^/]+)/.+")
)

// Serve uploads directory. Only makes sense for dev server, on
// production you normally use nginx or CDN.
func serveFiles(w http.ResponseWriter, r *http.Request) {
	path := getParam(r, "path")
	path = stripNameRe.ReplaceAllString(path, "$1")
	file, err := os.Open(cleanJoin(common.ImageWebRoot, path))
	if err != nil {
		serve404(w, r)
		return
	}
	defer file.Close()

	head := w.Header()
	for key, val := range imageHeaders {
		head.Set(key, val)
	}

	http.ServeContent(w, r, path, time.Time{}, file)
}

func cleanJoin(parts ...string) string {
	return filepath.Clean(filepath.Join(parts...))
}

func serveFile(w http.ResponseWriter, r *http.Request, path string) {
	file, err := os.Open(path)
	if err != nil {
		serve404(w, r)
		return
	}
	defer file.Close()

	stats, err := file.Stat()
	if err != nil {
		text500(w, r, err)
		return
	}
	if stats.IsDir() {
		serve404(w, r)
		return
	}
	modTime := stats.ModTime()

	head := w.Header()
	for key, val := range vanillaHeaders {
		head.Set(key, val)
	}
	http.ServeContent(w, r, path, modTime, file)
}

// Server static assets
func serveStatic(w http.ResponseWriter, r *http.Request) {
	serveFile(w, r, cleanJoin(common.WebRoot, "static", getParam(r, "path")))
}

func sendFileError(w http.ResponseWriter, h *multipart.FileHeader, msg string) {
	http.Error(w, fmt.Sprintf("400 invalid file %s: %s", h.Filename, msg), 400)
}
