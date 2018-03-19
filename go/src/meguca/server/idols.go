// Idol API handlers. See https://github.com/Kagami/kpopnet for details.
package server

import (
	"net/http"
)

const (
	NO_PREVIEW_URL       = "/static/img/no-preview.svg"
	SMALL_NO_PREVIEW_URL = "/static/img/no-preview-small.svg"
)

func serveIdolPreview(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "max-age=3600")
	http.Redirect(w, r, NO_PREVIEW_URL, 302)
}

func serveSmallIdolPreview(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "max-age=3600")
	http.Redirect(w, r, SMALL_NO_PREVIEW_URL, 302)
}
