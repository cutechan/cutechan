//go:generate go-bindata -o bin_data.go --pkg imager --nocompress --nometadata archive.png audio.png

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
	"mime/multipart"
	"net/http"

	"github.com/Soreil/apngdetector"
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
		mime7Zip:          common.SevenZip,
		mimeTarGZ:         common.TGZ,
		mimeTarXZ:         common.TXZ,
		mimeZip:           common.ZIP,
	}

	// MIME types from thumbnailer  to accept
	allowedMimeTypes = map[string]bool{
		"image/jpeg": true,
		"image/png":  true,
		"image/gif":  true,
		"video/webm": true,
		"video/mp4":  true,
		// "application/pdf": true,
		// "application/ogg": true,
		// "audio/mpeg":      true,
		// mimeZip:           true,
		// mime7Zip:          true,
		// mimeTarGZ:         true,
		// mimeTarXZ:         true,
	}

	errTooLarge = errors.New("file too large")
	errNoVideo  = errors.New("no video track")
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

	file, err := fh.Open()
	if err != nil {
		return 400, "", err
	}
	defer file.Close()

	data, err := ioutil.ReadAll(file)
	if err != nil {
		return 500, "", err
	}

	sum := sha1.Sum(data)
	SHA1 := hex.EncodeToString(sum[:])
	img, err := db.GetImage(SHA1)
	switch err {
	case nil: // Already have a thumbnail
		return newImageToken(SHA1)
	case sql.ErrNoRows:
		img.SHA1 = SHA1
		return newThumbnail(data, img)
	default:
		return 500, "", err
	}
}

func newImageToken(SHA1 string) (int, string, error) {
	token, err := db.NewImageToken(SHA1)
	code := 200
	if err != nil {
		code = 500
	}
	return code, token, err
}

// Create a new thumbnail, commit its resources to the DB and filesystem, and
// pass the image data to the client.
func newThumbnail(data []byte, img common.ImageCommon) (int, string, error) {
	thumb, img, err := processFile(data, img, thumbnailer.Options{
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

	if err := db.AllocateImage(data, thumb, img); err != nil {
		return 500, "", err
	}
	return newImageToken(img.SHA1)
}

func truncString(s string, max int) string {
	if len(s) > max {
		return s[:max]
	} else {
		return s
	}
}

// Separate function for easier testability
func processFile(
	data []byte,
	img common.ImageCommon,
	opts thumbnailer.Options,
) (
	[]byte, common.ImageCommon, error,
) {
	src, thumb, err := thumbnailer.ProcessBuffer(data, opts)
	switch err {
	case nil:
	case thumbnailer.ErrNoCoverArt:
	default:
		return nil, img, err
	}

	if (src.HasAudio && !src.HasVideo) || thumb.Data == nil {
		return nil, img, errNoVideo
	}

	img.Audio = src.HasAudio
	img.Video = src.HasVideo

	img.FileType = mimeTypes[src.Mime]
	if img.FileType == common.PNG {
		img.APNG = apngdetector.Detect(data)
	}
	if thumb.IsPNG {
		img.ThumbType = common.PNG
	} else {
		img.ThumbType = common.JPEG
	}

	img.Length = uint32(src.Length.Seconds() + 0.5)
	img.Size = len(data)
	img.Artist = truncString(src.Artist, common.MaxLenFileArist)
	img.Title = truncString(src.Title, common.MaxLenFileTitle)

	// MP3, OGG and MP4 might only contain audio and need a fallback thumbnail
	// if thumb.Data == nil {
	// 	img.ThumbType = common.PNG
	// 	img.Dims = [4]uint16{150, 150, 150, 150}
	// 	thumb.Data = MustAsset("audio.png")
	// } else {
	img.Dims = [4]uint16{
		uint16(src.Width),
		uint16(src.Height),
		uint16(thumb.Width),
		uint16(thumb.Height),
	}
	// }

	sum := md5.Sum(data)
	img.MD5 = base64.RawURLEncoding.EncodeToString(sum[:])

	return thumb.Data, img, nil
}
