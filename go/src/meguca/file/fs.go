package file

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/dimfeld/httptreemux"
)

const (
	fileCreationFlags = os.O_WRONLY | os.O_CREATE | os.O_EXCL
	fileMode          = 0644
	dirMode           = 0755
)

var (
	fileHeaders = map[string]string{
		"Cache-Control": "max-age=31536000, public, immutable",
	}
)

func getParam(r *http.Request, id string) string {
	return httptreemux.ContextParams(r.Context())[id]
}

func cleanJoin(parts ...string) string {
	return filepath.Clean(filepath.Join(parts...))
}

type fsBackend struct {
	dir string
}

func (b *fsBackend) IsServable() bool {
	return true
}

// Serve uploads directory. Only makes sense for dev server, on
// production you normally use nginx.
func (b *fsBackend) Serve(w http.ResponseWriter, r *http.Request) {
	path := getParam(r, "path")
	file, err := os.Open(cleanJoin(b.dir, path))
	if err != nil {
		http.Error(w, fmt.Sprintf("404 %s", err), 404)
		return
	}
	defer file.Close()

	head := w.Header()
	for key, val := range fileHeaders {
		head.Set(key, val)
	}

	http.ServeContent(w, r, path, time.Time{}, file)
}

// Generate file paths of the source file and its thumbnail
func fsGetPaths(root string, SHA1 string, fileType, thumbType uint8) (paths [2]string) {
	path := getImageURL(root, srcDir, fileType, SHA1)
	paths[0] = filepath.FromSlash(path)
	path = getImageURL(root, thumbDir, thumbType, SHA1)
	paths[1] = filepath.FromSlash(path)
	return
}

// Write a single file to disk with the appropriate permissions and flags
func fsWriteFile(path string, data []byte) error {
	// One of the files might be empty (e.g. thumbnail in case of audio
	// record).
	// TODO(Kagami): Don't call for empty files?
	if data == nil {
		return nil
	}

	dir := filepath.Dir(path)
	if err := os.Mkdir(dir, dirMode); err != nil && !os.IsExist(err) {
		return err
	}

	file, err := os.OpenFile(path, fileCreationFlags, fileMode)
	if err != nil {
		return err
	}
	defer file.Close()

	_, err = file.Write(data)
	return err
}

// Write writes file assets to disk
func (b *fsBackend) Write(SHA1 string, fileType, thumbType uint8, src, thumb []byte) error {
	paths := fsGetPaths(b.dir, SHA1, fileType, thumbType)

	ch := make(chan error)
	go func() {
		ch <- fsWriteFile(paths[0], src)
	}()

	for _, err := range [...]error{fsWriteFile(paths[1], thumb), <-ch} {
		switch {
		// Ignore files already written by another thread or process
		case err == nil, os.IsExist(err):
		default:
			return err
		}
	}
	return nil
}

// Delete deletes file assets belonging to a single upload
func (b *fsBackend) Delete(SHA1 string, fileType, thumbType uint8) error {
	for _, path := range fsGetPaths(b.dir, SHA1, fileType, thumbType) {
		// Ignore somehow absent images
		if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
			return err
		}
	}
	return nil
}

func fsCreateDirs(root string) error {
	for _, dir := range [...]string{srcDir, thumbDir} {
		path := filepath.Join(root, dir)
		if err := os.MkdirAll(path, dirMode); err != nil {
			return err
		}
	}
	return nil
}

func makeFSBackend(conf Config) (b FileBackend, err error) {
	if err = fsCreateDirs(conf.Dir); err != nil {
		return
	}
	b = &fsBackend{dir: conf.Dir}
	return
}
