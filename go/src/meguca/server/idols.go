// Idol API handlers. See https://github.com/Kagami/kpopnet for details.
package server

import (
	"net/http"

	"github.com/Kagami/kpopnet/go/src/kpopnet"
)

var (
	IdolOrigin string
)

func serveIdolProfiles(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", IdolOrigin)
	kpopnet.ServeProfiles(w, r)
}

func setIdolPreview(w http.ResponseWriter, r *http.Request) {
	serveErrorJSON(w, r, aerrModOnly)
}
