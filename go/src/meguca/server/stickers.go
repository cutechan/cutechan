// Stickers HTTP handlers.

package server

import (
	"meguca/templates"
	"net/http"
)

func serveStickers(w http.ResponseWriter, r *http.Request) {
	pos, ok := extractPosition(w, r)
	if !ok {
		return
	}
	stickHTML := []byte{}
	// if err != nil {
	// 	text500(w, r, errInternal)
	// 	return
	// }
	html := templates.Stickers(pos, stickHTML)
	serveHTML(w, r, "", html, nil)
}
