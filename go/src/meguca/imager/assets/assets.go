// Package assets manages imager file asset allocation and deallocation
package assets

import (
	"meguca/common"
	"meguca/config"
	"strings"
	"os"
	"path/filepath"
)

const fileCreationFlags = os.O_WRONLY | os.O_CREATE | os.O_EXCL

// Only used in tests, but we still need them exported
var (
	//  StdJPEG is a JPEG sample image standard struct. Only used in tests.
	StdJPEG = common.Image{
		ImageCommon: common.ImageCommon{
			SHA1:     "012a2f912c9ee93ceb0ccb8684a29ec571990a94",
			FileType: common.JPEG,
			Dims:     StdDims["jpeg"],
			MD5:      "YOQQklgfezKbBXuEAsqopw",
			Size:     300792,
		},
		Name:    "sample.jpg",
		Spoiler: true,
	}

	// StdDims contains esulting dimentions after thumbnailing sample images.
	// Only used in tests.
	StdDims = map[string][4]uint16{
		"jpeg": {0x43c, 0x371, 0x96, 0x79},
		"png":  {0x500, 0x2d0, 0x96, 0x54},
		"gif":  {0x248, 0x2d0, 0x79, 0x96},
		"pdf":  {0x253, 0x34a, 0x69, 0x96},
	}
)

func imageRoot() string {
	r := config.Get().ImageRootOverride
	if r != "" {
		return r
	}
	return "/uploads"
}

func imagePath(root string, dir string, typ uint8, SHA1 string) string {
	return strings.Join([]string{
		root,
		dir,
		SHA1[:2],
		SHA1[2:] + "." + common.Extensions[typ],
	}, "/")
}

// SourcePath returns the path to the source file on an image
func SourcePath(fileType uint8, SHA1 string) string {
	return imagePath(imageRoot(), "src", fileType, SHA1)
}

// ThumbPath returns the path to the thumbnail of an image
func ThumbPath(thumbType uint8, SHA1 string) string {
	return imagePath(imageRoot(), "thumb", thumbType, SHA1)
}

// Generate file paths of the source file and its thumbnail
func getFilePaths(SHA1 string, fileType, thumbType uint8) (paths [2]string) {
	path := imagePath(common.ImageWebRoot, "src", fileType, SHA1)
	paths[0] = filepath.FromSlash(path)
	path = imagePath(common.ImageWebRoot, "thumb", thumbType, SHA1)
	paths[1] = filepath.FromSlash(path)
	return
}

// Write writes file assets to disk
func Write(SHA1 string, fileType, thumbType uint8, src, thumb []byte) error {
	paths := getFilePaths(SHA1, fileType, thumbType)

	ch := make(chan error)
	go func() {
		ch <- writeFile(paths[0], src)
	}()

	for _, err := range [...]error{writeFile(paths[1], thumb), <-ch} {
		switch {
		// Ignore files already written by another thread or process
		case err == nil, os.IsExist(err):
		default:
			return err
		}
	}
	return nil
}

// Write a single file to disk with the appropriate permissions and flags
func writeFile(path string, data []byte) error {
	dir := filepath.Dir(path)
	if err := os.Mkdir(dir, 0700); err != nil && !os.IsExist(err) {
		return err
	}

	file, err := os.OpenFile(path, fileCreationFlags, 0660)
	if err != nil {
		return err
	}
	defer file.Close()

	_, err = file.Write(data)
	return err
}

// Delete deletes file assets belonging to a single upload
func Delete(SHA1 string, fileType, thumbType uint8) error {
	for _, path := range getFilePaths(SHA1, fileType, thumbType) {
		// Ignore somehow absent images
		if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
			return err
		}
	}
	return nil
}

// CreateDirs creates directories for processed image storage
func CreateDirs() error {
	for _, dir := range [...]string{"src", "thumb"} {
		path := filepath.Join(common.ImageWebRoot, dir)
		if err := os.MkdirAll(path, 0700); err != nil {
			return err
		}
	}
	return nil
}

// DeleteDirs recursively deletes the image storage folder. Only used for
// cleaning up after tests.
func DeleteDirs() error {
	return os.RemoveAll(common.ImageWebRoot)
}

// ResetDirs removes all contents from the image storage directories. Only
// used for cleaning up after tests.
func ResetDirs() error {
	if err := DeleteDirs(); err != nil {
		return err
	}
	return CreateDirs()
}
