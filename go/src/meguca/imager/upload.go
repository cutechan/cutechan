// Package imager handles image, video, etc. upload requests and processing
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
	"meguca/auth"
	"meguca/common"
	"meguca/config"
	"meguca/db"
	"meguca/util"
	"mime/multipart"
	"net/http"

	// "github.com/Soreil/apngdetector"
	"github.com/bakape/thumbnailer"
)

var (
	// Map of MIME types to the constants used internally
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

	// MIME types from thumbnailer  to accept
	allowedMimeTypes = map[string]bool{
		"image/jpeg": true,
		"image/png":  true,
		"image/gif":  true,
		"video/webm": true,
		"video/mp4":  true,
		"audio/mpeg": true,
		// "application/pdf": true,
		// "application/ogg": true,
	}

	errTooLarge = errors.New("file too large")
	errNoVideo  = errors.New("no video track")
	errNoThumb  = errors.New("can't generate thumbnail")
)

// LogError send the client file upload errors and logs them server-side
func LogError(w http.ResponseWriter, r *http.Request, code int, err error) {
	text := err.Error()
	http.Error(w, text, code)
	ip, err := auth.GetIP(r)
	if err != nil {
		ip = "invalid IP"
	}
	log.Printf("upload error: %s: %s\n", ip, text)
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
		return saveFile(data, file)
	default:
		return 500, "", err
	}
}

func newFileToken(SHA1 string) (int, string, error) {
	token, err := db.NewImageToken(SHA1)
	code := 200
	if err != nil {
		code = 500
	}
	return code, token, err
}

// Create a new thumbnail, commit its resources to the DB and
// filesystem, and return resulting token.
func saveFile(data []byte, file common.ImageCommon) (int, string, error) {
	thumb, err := getThumbnail(data, &file, thumbnailer.Options{
		JPEGQuality: common.JPEGQuality,
		MaxSourceDims: thumbnailer.Dims{
			Width:  common.MaxWidth,
			Height: common.MaxHeight,
		},
		ThumbDims: thumbnailer.Dims{
			Width:  common.ThumbSize,
			Height: common.ThumbSize,
		},
		AcceptedMimeTypes: allowedMimeTypes,
	})
	if err == errNoVideo {
		return 400, "", err
	}
	switch err.(type) {
	case nil:
	case thumbnailer.UnsupportedMIMEError:
		return 400, "", err
	default:
		return 500, "", err
	}

	if err := db.AllocateImage(data, thumb, file); err != nil {
		return 500, "", err
	}
	return newFileToken(file.SHA1)
}

func isMP3(src thumbnailer.Source) bool {
	return mimeTypes[src.Mime] == common.MP3
}

func getThumbnail(
	data []byte,
	file *common.ImageCommon,
	opts thumbnailer.Options,
) (
	[]byte, error,
) {
	src, thumb, err := thumbnailer.ProcessBuffer(data, opts)
	switch err {
	case nil:
	case thumbnailer.ErrNoCoverArt:
		// TODO(Kagami): Fix in upstream.
		src.HasAudio = true
	default:
		return nil, err
	}

	// Allow only MP3 audios currently.
	if src.HasAudio {
		if !src.HasVideo && !isMP3(src) {
			return nil, errNoVideo
		}
	}

	// Thumbnail is skipped only for MP3.
	if isMP3(src) {
		thumb.Data = nil
	} else if thumb.Data == nil {
		return nil, errNoThumb
	}

	file.Audio = src.HasAudio
	file.Video = src.HasVideo

	file.FileType = mimeTypes[src.Mime]
	// if file.FileType == common.PNG {
	// 	file.APNG = apngdetector.Detect(data)
	// }
	if thumb.IsPNG || isMP3(src) {
		file.ThumbType = common.PNG
	} else {
		file.ThumbType = common.JPEG
	}

	if !isMP3(src) {
		file.Dims = [4]uint16{
			uint16(src.Width),
			uint16(src.Height),
			uint16(thumb.Width),
			uint16(thumb.Height),
		}
	}

	file.Size = len(data)
	file.Length = uint32(src.Length.Seconds() + 0.5)
	file.Artist = util.TruncString(src.Artist, common.MaxLenFileArist)
	file.Title = util.TruncString(src.Title, common.MaxLenFileTitle)

	sum := md5.Sum(data)
	file.MD5 = base64.RawURLEncoding.EncodeToString(sum[:])

	return thumb.Data, nil
}
