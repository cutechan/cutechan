package file

import (
	"fmt"
	"net/http"

	"github.com/ncw/swift"
)

type swiftBackend struct {
	container string
	conn      *swift.Connection
}

func (swift *swiftBackend) IsServable() bool {
	return false
}

// Served by CDN.
func (b *swiftBackend) Serve(w http.ResponseWriter, r *http.Request) {
	panic("non-servable backend")
}

func (b *swiftBackend) writeFile(name string, data []byte) (err error) {
	if data == nil {
		return
	}
	defer func() {
		if err != nil {
			err = fmt.Errorf("cannot create Swift object %s: %v", name, err)
		}
	}()

	f, err := b.conn.ObjectCreate(b.container, name, false, "", "", nil)
	if err != nil {
		return
	}
	if _, err = f.Write(data); err != nil {
		return
	}
	err = f.Close()
	return
}

func (b *swiftBackend) Write(sha1 string, fileType, thumbType uint8, src, thumb []byte) error {
	ch := make(chan error)
	go func() {
		name := imagePath("", srcDir, fileType, sha1)
		ch <- b.writeFile(name, src)
	}()
	go func() {
		name := imagePath("", thumbDir, thumbType, sha1)
		ch <- b.writeFile(name, thumb)
	}()
	for _, err := range [...]error{<-ch, <-ch} {
		if err != nil {
			return err
		}
	}
	return nil
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
		err = fmt.Errorf("cannot authenticate for Swift: %v", err)
		return
	}
	b = &swiftBackend{container: conf.Container, conn: &c}
	return
}
