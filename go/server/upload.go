package server

import (
	"crypto/sha1"
	"database/sql"
	"encoding/hex"
	"io/ioutil"
	"mime/multipart"

	"github.com/cutechan/cutechan/go/common"
	"github.com/cutechan/cutechan/go/config"
	"github.com/cutechan/cutechan/go/db"
	"github.com/cutechan/cutechan/go/ipc"
)

const (
	// Maximum number of thumbnailer processes executing at the same time.
	thumbProcesses = 1
)

var (
	jobs = make(chan jobRequest)

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
)

type jobRequest struct {
	fd       multipart.File
	jresults chan<- jobResult
}

type jobResult struct {
	res uploadResult
	err error
}

type uploadResult struct {
	file  *common.ImageCommon
	token string
}

func uploadFile(fh *multipart.FileHeader) (res uploadResult, err error) {
	if fh.Size > config.Get().MaxSize*1024*1024 {
		err = aerrTooLarge
		return
	}

	fd, err := fh.Open()
	if err != nil {
		err = aerrUploadRead.Hide(err)
		return
	}
	defer fd.Close()

	jresults := make(chan jobResult)
	jreq := jobRequest{fd, jresults}
	jobs <- jreq
	jres := <-jresults
	return jres.res, jres.err
}

func worker(user string) {
	for {
		jreq := <-jobs
		res, err := work(user, jreq)
		jreq.jresults <- jobResult{res, err}
	}
}

func work(user string, jreq jobRequest) (res uploadResult, err error) {
	data, err := ioutil.ReadAll(jreq.fd)
	if err != nil {
		err = aerrUploadRead.Hide(err)
		return
	}
	hash := getSha1(data)
	file, err := db.GetImage(hash)
	switch err {
	case nil:
		// Already have thumbnail.
		return newFileToken(&file)
	case sql.ErrNoRows:
		file.SHA1 = hash
		return saveFile(user, data, &file)
	default:
		err = aerrInternal.Hide(err)
		return
	}
}

func getSha1(data []byte) string {
	hash := sha1.Sum(data)
	return hex.EncodeToString(hash[:])
}

func newFileToken(file *common.ImageCommon) (res uploadResult, err error) {
	res.file = file
	res.token, err = db.NewImageToken(file.SHA1)
	if err != nil {
		err = aerrInternal.Hide(err)
		return
	}
	return
}

// Create a new thumbnail, commit its resources to the DB and
// filesystem, and return resulting token.
func saveFile(user string, srcData []byte, file *common.ImageCommon) (res uploadResult, err error) {
	thumb, err := ipc.GetThumbnail(user, srcData)
	switch err {
	case nil:
		// Do nothing.
	case ipc.ErrThumbUnsupported:
		err = aerrUnsupported
		return
	case ipc.ErrThumbDimensions:
		err = aerrBadDimensions
		return
	case ipc.ErrThumbTracks:
		err = aerrNoTracks
		return
	case ipc.ErrThumbProcess:
		err = aerrCorrupted
		return
	default:
		err = aerrInternal
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

	if err = db.AllocateImage(srcData, thumb.Data, *file); err != nil {
		err = aerrInternal.Hide(err)
		return
	}
	return newFileToken(file)
}

// Start thumbnailer workers.
func startThumbWorkers(user string) (err error) {
	for i := 0; i < thumbProcesses; i++ {
		go worker(user)
	}
	return
}
