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

func (swift *swiftBackend) Write(sha1 string, fileType, thumbType uint8, src, thumb []byte) error {
	panic("not implemented")
}

func (swift *swiftBackend) Delete(sha1 string, fileType, thumbType uint8) error {
	panic("not implemented")
}

func makeSwiftBackend(conf Config) (b FileBackend, err error) {
	b = &swiftBackend{}
	return
}
