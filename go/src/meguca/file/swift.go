package file

import (
	"net/http"
)

type swiftBackend struct {
}

func (swift *swiftBackend) IsServable() bool {
	return false
}

// Served by CDN.
func (swift *swiftBackend) Serve(w http.ResponseWriter, r *http.Request) {
	panic("non-servable backend")
}

func makeSwiftBackend(conf Config) FileBackend {
	return &swiftBackend{}
}
