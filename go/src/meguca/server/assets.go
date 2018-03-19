package server

import (
	"fmt"
	"meguca/common"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"
)

// More performant handler for serving image assets. These are immutable
// (except deletion), so we can also set separate caching policies for them.
func serveImages(w http.ResponseWriter, r *http.Request) {
	path := extractParam(r, "path")
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
	etag := strconv.FormatInt(modTime.Unix(), 10)

	head := w.Header()
	for key, val := range vanillaHeaders {
		head.Set(key, val)
	}
	head.Set("ETag", etag)
	http.ServeContent(w, r, path, modTime, file)
}

// Server static assets
func serveStatic(w http.ResponseWriter, r *http.Request) {
	serveFile(w, r, cleanJoin(common.WebRoot, "static", extractParam(r, "path")))
}

func sendFileError(w http.ResponseWriter, h *multipart.FileHeader, msg string) {
	http.Error(w, fmt.Sprintf("400 invalid file %s: %s", h.Filename, msg), 400)
}
