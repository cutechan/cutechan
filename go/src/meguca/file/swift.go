package file

import (
	"fmt"
	"log"
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

func getSwiftSourceName(fileType uint8, sha1 string) string {
	return imagePath("", srcDir, fileType, sha1)
}

func getSwiftThumbName(thumbType uint8, sha1 string) string {
	return imagePath("", thumbDir, thumbType, sha1)
}

func (b *swiftBackend) writeFile(name string, data []byte) (err error) {
	if data == nil {
		return
	}
	defer func() {
		if err != nil {
			err = fmt.Errorf("cannot create Swift object %s in %s: %v", name, b.container, err)
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
		// Full path logging might be useful for later manual PURGE.
		log.Printf("[swift] creating <%s>", SourcePath(fileType, sha1))
		ch <- b.writeFile(getSwiftSourceName(fileType, sha1), src)
	}()
	go func() {
		log.Printf("[swift] creating <%s>", ThumbPath(thumbType, sha1))
		ch <- b.writeFile(getSwiftThumbName(thumbType, sha1), thumb)
	}()
	for _, err := range [...]error{<-ch, <-ch} {
		if err != nil {
			return err
		}
	}
	return nil
}

// TODO(Kagami): PURGE?
func (b *swiftBackend) deleteFile(name string) (err error) {
	err = b.conn.ObjectDelete(b.container, name)
	// Ignore somehow absent files.
	if err == swift.ObjectNotFound {
		err = nil
	}
	if err != nil {
		err = fmt.Errorf("cannot delete Swift object %s from %s: %v", name, b.container, err)
	}
	return
}

func (b *swiftBackend) Delete(sha1 string, fileType, thumbType uint8) error {
	ch := make(chan error)
	go func() {
		log.Printf("[swift] deleting <%s>", SourcePath(fileType, sha1))
		ch <- b.deleteFile(getSwiftSourceName(fileType, sha1))
	}()
	go func() {
		log.Printf("[swift] deleting <%s>", ThumbPath(thumbType, sha1))
		ch <- b.deleteFile(getSwiftThumbName(thumbType, sha1))
	}()
	for _, err := range [...]error{<-ch, <-ch} {
		if err != nil {
			return err
		}
	}
	return nil
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
