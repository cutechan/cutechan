package file

import (
	"net/http"

	"github.com/ncw/swift"
)

type swiftBackend struct {
	conn *swift.Connection
}

func (swift *swiftBackend) IsServable() bool {
	return false
}

// Served by CDN.
func (b *swiftBackend) Serve(w http.ResponseWriter, r *http.Request) {
	panic("non-servable backend")
}

func (b *swiftBackend) Write(sha1 string, fileType, thumbType uint8, src, thumb []byte) error {
	panic("not implemented")
}

func (b *swiftBackend) Delete(sha1 string, fileType, thumbType uint8) error {
	panic("not implemented")
}

func makeSwiftBackend(conf Config) (b FileBackend, err error) {
	c := swift.Connection{
		UserName: conf.Username,
		ApiKey:   conf.Password,
		AuthUrl:  conf.AuthURL,
	}
	if err = c.Authenticate(); err != nil {
		return
	}
	b = &swiftBackend{conn: &c}
	return
}
