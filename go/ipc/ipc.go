// Common structures and helpers to communicate between cutechan processes.
// Don't import here meguca packages to keep build small.
package ipc

import (
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"syscall"
)

const (
	THUMB_CMD             = "cutethumb"
	THUMB_ERROR_EXIT_CODE = 100
	MAX_OBJ_LEN           = 65535
)

var (
	ErrThumbProcess     = errors.New("error generating thumbnail")
	ErrThumbUnsupported = errors.New("unsupported file format")
	ErrThumbDimensions  = errors.New("unsupported file dimensions")
	ErrThumbTracks      = errors.New("unsupported track set")
)

type Thumb struct {
	HasVideo  bool
	HasAudio  bool
	HasAlpha  bool
	Mime      string
	SrcWidth  uint16
	SrcHeight uint16
	Width     uint16
	Height    uint16
	Duration  uint32
	Title     string
	Data      []byte `json:"-"`
}

// Use LOB-alike encoding:
// [ VARUINT JSON LENGTH ] [ JSON ] [ DATA ]
// See: https://github.com/telehash/telehash.github.io/blob/master/v3/lob.md
func (t *Thumb) Marshal() (data []byte, err error) {
	objData, err := json.Marshal(t)
	if err != nil {
		err = fmt.Errorf("thumbnailer marshal error: %v", err)
		return
	}
	// Writing directly to stdout will use less memory but thumbnails are
	// quite small so not a big deal.
	data = make([]byte, binary.MaxVarintLen64)
	n := binary.PutUvarint(data, uint64(len(objData)))
	data = data[:n]
	data = append(data, objData...)
	data = append(data, t.Data...)
	return
}

func unmarshalThumb(data []byte) (thumb *Thumb, err error) {
	objLen, varLen := binary.Uvarint(data)
	if varLen <= 0 {
		err = fmt.Errorf("thumbnailer uvarint error: %d", varLen)
		return
	}
	n := uint64(varLen)
	objData := data[n : objLen+n]
	thumb = &Thumb{}
	err = json.Unmarshal(objData, thumb)
	if err != nil {
		err = fmt.Errorf("thumbnailer unmarshal error: %v", err)
		return
	}
	thumb.Data = data[objLen+n:]
	return
}

// Decode simple error string.
func decodeThumbError(s string) error {
	for _, e := range []error{
		ErrThumbProcess,
		ErrThumbUnsupported,
		ErrThumbDimensions,
		ErrThumbTracks,
	} {
		if s == e.Error() {
			return e
		}
	}
	return fmt.Errorf("thumbnailer unknown error: %s", s)
}

// Known errors are marked with special code.
func getExitCode(err error) int {
	if exiterr, ok := err.(*exec.ExitError); ok {
		if status, ok := exiterr.Sys().(syscall.WaitStatus); ok {
			return status.ExitStatus()
		}
	}
	return -1
}

func getCmdLine(user string) (name string, args []string) {
	if user == "" {
		name = THUMB_CMD
	} else {
		name = "sudo"
		args = append(args, "-u", user, THUMB_CMD)
	}
	return
}

// Abstract thumbnailer IPC.
func GetThumbnail(user string, srcData []byte) (thumb *Thumb, err error) {
	// Start process.
	name, args := getCmdLine(user)
	cmd := exec.Command(name, args...)
	cmd.Stderr = os.Stderr
	in, err := cmd.StdinPipe()
	if err != nil {
		err = fmt.Errorf("thumbnailer OS error: %v", err)
		return
	}
	out, err := cmd.StdoutPipe()
	if err != nil {
		err = fmt.Errorf("thumbnailer OS error: %v", err)
		return
	}
	cmd.Start()

	// Pass input and get output.
	in.Write(srcData)
	in.Close()
	// Don't need to process error here because it will be handled later.
	data, _ := ioutil.ReadAll(out)

	// Wait for exit and decode error.
	if err = cmd.Wait(); err != nil {
		if getExitCode(err) == THUMB_ERROR_EXIT_CODE {
			err = decodeThumbError(string(data))
		} else {
			err = fmt.Errorf("thumbnailer OS error: %v", err)
		}
		return
	}

	// Decode output and pass native structure back.
	thumb, err = unmarshalThumb(data)
	return
}
