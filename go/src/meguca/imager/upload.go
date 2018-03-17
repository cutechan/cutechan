// Package imager handles image, video, etc. upload requests and
// processing.
package imager

import (
	"crypto/md5"
	"crypto/sha1"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"io/ioutil"
	"log"
	"mime/multipart"
	"net/http"

	"meguca/auth"
	"meguca/common"
	"meguca/config"
	"meguca/db"
	"meguca/ipc"
)

var (
	// Map of MIME types to the constants used internally.
	mimeTypes = map[string]uint8{
		"image/jpeg":      common.JPEG,
		"image/png":       common.PNG,
		"image/gif":       common.GIF,
		"application/pdf": common.PDF,
		"video/webm":      common.WEBM,
		"application/ogg": common.OGG,
		"video/mp4":       common.MP4,
		"audio/mpeg":      common.MP3,
	}

	errTooLarge = errors.New("file too large")
)

// FIXME(Kagami): Combine with similar code from server package.
func LogError(w http.ResponseWriter, r *http.Request, code int, err error) {
	log.Printf("upload error: %s: %v\n", auth.GetLogIP(r), err)
	text := err.Error()
	if code == 500 {
		text = "internal server error"
	}
	http.Error(w, text, code)
}

func Upload(fh *multipart.FileHeader) (int, string, error) {
	if fh.Size > int64(config.Get().MaxSize<<20) {
		return 400, "", errTooLarge
	}

	fd, err := fh.Open()
	if err != nil {
		return 400, "", err
	}
	defer fd.Close()

	data, err := ioutil.ReadAll(fd)
	if err != nil {
		return 500, "", err
	}

	sum := sha1.Sum(data)
	SHA1 := hex.EncodeToString(sum[:])
	file, err := db.GetImage(SHA1)
	switch err {
	case nil:
		// Already have a thumbnail
		return newFileToken(SHA1)
	case sql.ErrNoRows:
		file.SHA1 = SHA1
		return saveFile(data, &file)
	default:
		return 500, "", err
	}
}

func newFileToken(SHA1 string) (code int, token string, err error) {
	token, err = db.NewImageToken(SHA1)
	code = 200
	if err != nil {
		code = 500
	}
	return
}

// Create a new thumbnail, commit its resources to the DB and
// filesystem, and return resulting token.
func saveFile(srcData []byte, file *common.ImageCommon) (code int, token string, err error) {
	thumb, err := ipc.GetThumbnail(srcData)
	switch err {
	case nil:
		// Do nothing.
	case ipc.ErrThumbUnsupported:
	case ipc.ErrThumbTracks:
		code = 400
	default:
		code = 500
	}
	if err != nil {
		return
	}

	// Map fields.
	file.Size = len(srcData)
	file.Video = thumb.HasVideo
	file.Audio = thumb.HasAudio
	file.FileType = mimeTypes[thumb.Mime]
	if thumb.HasAlpha {
		file.ThumbType = common.PNG
	} else {
		file.ThumbType = common.JPEG
	}
	file.Length = thumb.Duration
	file.Title = thumb.Title
	file.Dims = [4]uint16{thumb.SrcWidth, thumb.SrcHeight, thumb.Width, thumb.Height}
	hash := md5.Sum(srcData)
	file.MD5 = base64.RawURLEncoding.EncodeToString(hash[:])

	if err = db.AllocateImage(srcData, thumb.Data, *file); err != nil {
		code = 500
		return
	}
	return newFileToken(file.SHA1)
}
