package server

import (
	"errors"
	"fmt"
	"log"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"runtime/debug"
	"syscall"

	"github.com/cutechan/cutechan/go/auth"
	"github.com/cutechan/cutechan/go/config"

	"github.com/dimfeld/httptreemux"
)

var (
	// Base set of HTTP headers for both HTML and JSON
	vanillaHeaders = map[string]string{
		"Cache-Control": "no-cache",
	}
)

func writeData(w http.ResponseWriter, r *http.Request, data []byte) {
	_, err := w.Write(data)
	if err == nil {
		return
	}
	if errors.Is(err, syscall.EPIPE) {
		return
	}
	logError(r, err)
}

// Log an error together with the client's IP and stack trace
func logError(r *http.Request, err error) {
	log.Printf("server: %s: %s\n%s", auth.GetLogIP(r), err, debug.Stack())
}

// Text-only 400 response
// TODO(Kagami): User ApiError instead.
func text400(w http.ResponseWriter, err error) {
	http.Error(w, fmt.Sprintf("400 %s", err), 400)
}

// Text-only 403 response
// TODO(Kagami): User ApiError instead.
func text403(w http.ResponseWriter, err error) {
	http.Error(w, fmt.Sprintf("403 %s", err), 403)
}

// Text-only 500 response
// TODO(Kagami): User ApiError instead.
func text500(w http.ResponseWriter, r *http.Request, v interface{}) {
	http.Error(w, "500 internal server error", 500)
	err, ok := v.(error)
	if !ok {
		err = aerrInternal
	}
	logError(r, err)
}

// Extract URL paramater from request context
func getParam(r *http.Request, id string) string {
	return httptreemux.ContextParams(r.Context())[id]
}

// Maximum amount of data server will deal with.
func getMaxBodySize() int64 {
	n := config.Get().MaxSize*1024*1024*int64(config.Get().MaxFiles) + jsonLimit
	return int64(n)
}

func parseUploadForm(w http.ResponseWriter, r *http.Request) (
	f url.Values, m *multipart.Form, err error,
) {
	r.Body = http.MaxBytesReader(w, r.Body, getMaxBodySize())
	if err = r.ParseMultipartForm(0); err != nil {
		err = aerrParseForm.Hide(err)
		return
	}
	f = r.Form
	m = r.MultipartForm
	return
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
