// Idol API handlers. See https://github.com/Kagami/kpopnet for details.
package server

import (
	"net/http"

	"github.com/Kagami/kpopnet/go/src/kpopnet"
)

const (
	NO_PREVIEW_URL       = "/static/img/no-preview.svg"
	SMALL_NO_PREVIEW_URL = "/static/img/no-preview-small.svg"
)

var (
	IdolOrigin string
)

func serveProfiles(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", IdolOrigin)
	kpopnet.ServeProfiles(w, r)
}

func serveIdolPreview(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "max-age=3600")
	http.Redirect(w, r, NO_PREVIEW_URL, 302)
}

func serveSmallIdolPreview(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "max-age=3600")
	http.Redirect(w, r, SMALL_NO_PREVIEW_URL, 302)
}
