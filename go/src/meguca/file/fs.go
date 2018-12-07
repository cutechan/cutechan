package file

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/dimfeld/httptreemux"
)

var (
	fileHeaders = map[string]string{
		"Cache-Control": "max-age=31536000, public, immutable",
	}
)

func getParam(r *http.Request, id string) string {
	return httptreemux.ContextParams(r.Context())[id]
}

func cleanJoin(parts ...string) string {
	return filepath.Clean(filepath.Join(parts...))
}

type fsBackend struct {
	dir string
}

func (fs *fsBackend) IsServable() bool {
	return true
}

// Serve uploads directory. Only makes sense for dev server, on
// production you normally use nginx.
func (fs *fsBackend) Serve(w http.ResponseWriter, r *http.Request) {
	path := getParam(r, "path")
	file, err := os.Open(cleanJoin(fs.dir, path))
	if err != nil {
		http.Error(w, fmt.Sprintf("404 %s", err), 404)
		return
	}
	defer file.Close()

	head := w.Header()
	for key, val := range fileHeaders {
		head.Set(key, val)
	}

	http.ServeContent(w, r, path, time.Time{}, file)
}

func makeFSBackend(conf Config) FileBackend {
	return &fsBackend{dir: conf.Dir}
}
