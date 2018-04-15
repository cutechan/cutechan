package server

import (
	"net/http"

	"meguca/templates"
)

func serveStickers(w http.ResponseWriter, r *http.Request) {
	pos, ok := extractPositions(w, r)
	if !ok {
		return
	}
	stickHTML := []byte{}
	html := templates.Stickers(r, pos, stickHTML)
	serveHTML(w, r, "", html, nil)
}
