// Image/video thumbnailer, run as a separate process and potentially
// from separate user for security reasons.
package main

import (
	"fmt"
	"io/ioutil"
	"log"
	"os"

	"meguca/ipc"

	"github.com/bakape/thumbnailer"
)

const (
	maxWidth        = 12000
	maxHeight       = 12000
	thumbSize       = 200
	jpegQuality     = 90
	maxLenFileTitle = 300
)

var (
	allowedMimeTypes = map[string]bool{
		"image/jpeg": true,
		"image/png":  true,
		"image/gif":  true,
		"video/webm": true,
		"video/mp4":  true,
		"audio/mpeg": true,
	}
)

func truncString(s string, max int) string {
	if len(s) > max {
		return s[:max]
	} else {
		return s
	}
}

func getThumbnail(srcData []byte) (ithumb *ipc.Thumb, err error) {
	opts := thumbnailer.Options{
		MaxSourceDims: thumbnailer.Dims{
			Width:  maxWidth,
			Height: maxHeight,
		},
		ThumbDims: thumbnailer.Dims{
			Width:  thumbSize,
			Height: thumbSize,
		},
		JPEGQuality:       jpegQuality,
		AcceptedMimeTypes: allowedMimeTypes,
	}

	src, thumb, err := thumbnailer.ProcessBuffer(srcData, opts)
	switch err {
	case nil:
		// Do nothing.
	case thumbnailer.ErrNoCoverArt:
		// TODO(Kagami): Fix in upstream.
		src.HasAudio = true
		err = nil
	default:
		switch err.(type) {
		case thumbnailer.UnsupportedMIMEError:
			err = ipc.ErrThumbUnsupported
		default:
			log.Printf("thumbnailer error: %v", err)
			err = ipc.ErrThumbProcess
		}
		return
	}

	isMp3 := src.Mime == "audio/mpeg"

	// Thumbnail is skipped only for MP3.
	if isMp3 {
		thumb.Data = nil
	} else if thumb.Data == nil {
		err = ipc.ErrThumbProcess
		return
	}

	// Allow only MP3 audios currently.
	if src.HasAudio {
		if !src.HasVideo && !isMp3 {
			err = ipc.ErrThumbTracks
			return
		}
	}

	ithumb = &ipc.Thumb{
		HasVideo:  src.HasVideo,
		HasAudio:  src.HasAudio,
		HasAlpha:  thumb.IsPNG,
		Mime:      src.Mime,
		SrcWidth:  uint16(src.Width),
		SrcHeight: uint16(src.Height),
		Width:     uint16(thumb.Width),
		Height:    uint16(thumb.Height),
		Duration:  uint32(src.Length.Seconds() + 0.5),
		Title:     truncString(src.Title, maxLenFileTitle),
		Data:      thumb.Data,
	}
	return
}

func main() {
	srcData, err := ioutil.ReadAll(os.Stdin)
	if err != nil {
		fmt.Printf("%v", err)
		os.Exit(ipc.THUMB_ERROR_EXIT_CODE)
	}
	thumb, err := getThumbnail(srcData)
	if err != nil {
		fmt.Printf("%v", err)
		os.Exit(ipc.THUMB_ERROR_EXIT_CODE)
	}
	outData, err := thumb.Marshal()
	if err != nil {
		fmt.Printf("%v", err)
		os.Exit(ipc.THUMB_ERROR_EXIT_CODE)
	}
	_, err = os.Stdout.Write(outData)
	if err != nil {
		log.Printf("thumbnailer error: %v", err)
		os.Exit(1)
	}
}
