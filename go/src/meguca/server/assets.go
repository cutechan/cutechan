package server

import (
	"net/http"
	"os"
	"time"

	"meguca/common"
)

// Serve uploads directory. Only makes sense for dev server, on
// production you normally use nginx or CDN.
func serveFiles(w http.ResponseWriter, r *http.Request) {
	path := getParam(r, "path")
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
