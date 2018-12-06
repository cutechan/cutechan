package file

import (
	"net/http"
)

func swiftIsServable() bool {
	return false
}

// Served by CDN.
func swiftServe(w http.ResponseWriter, r *http.Request) {
	panic("non-servable backend")
}
