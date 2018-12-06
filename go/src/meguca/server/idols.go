// Idol API handlers. See https://github.com/Kagami/kpopnet for details.
package server

import (
	"net/http"
	"regexp"

	"meguca/common"
	"meguca/db"

	"github.com/Kagami/kpopnet/go/src/kpopnet"
)

var (
	uuidRe = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)
)

func serveIdolProfiles(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", idolOrigin)
	kpopnet.ServeProfiles(w, r)
}

func serveIdolRecognize(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", idolOrigin)
	kpopnet.ServeRecognize(w, r)
}

func serveSetIdolPreview(w http.ResponseWriter, r *http.Request) {
	ss, _ := getSession(r, "")
	if !assertPowerUserAPI(w, ss) {
		return
	}
	answer, err := setIdolPreview(w, r)
	if err != nil {
		serveErrorJSON(w, r, err)
		return
	}
	serveJSON(w, r, answer)
}

func setIdolPreview(w http.ResponseWriter, r *http.Request) (answer map[string]string, err error) {
	idolId := getParam(r, "id")
	if !uuidRe.MatchString(idolId) {
		err = aerrBadUuid
		return
	}

	_, m, err := parseUploadForm(w, r)
	if err != nil {
		return
	}

	fhs := m.File["files[]"]
	if len(fhs) != 1 {
		err = aerrNoFile
		return
	}

	res, err := uploadFile(fhs[0])
	if err != nil {
		return
	}

	defer func() {
		if tokErr := db.DeleteImageToken(res.token); tokErr != nil {
			logError(r, tokErr)
		}
	}()

	// TODO(Kagami): Pass required file properties to uploadFile to avoid
	// garbage uploads (they will be removed by deleteUnusedFiles).
	if res.file.FileType != common.JPEG {
		err = aerrBadPreview
		return
	}

	width := res.file.Dims[0]
	height := res.file.Dims[1]
	if width != height {
		err = aerrBadPreviewDims
		return
	}

	if err = db.UpsertIdolPreview(idolId, res.file.SHA1); err != nil {
		switch {
		case db.IsUniqueViolationError(err):
			err = aerrDupPreview
		case db.IsForeignKeyViolationError(err):
			err = aerrNoIdol
		default:
			err = aerrInternal.Hide(err)
		}
		return
	}

	kpopnet.ClearProfilesCache()

	answer = map[string]string{"SHA1": res.file.SHA1}
	return
}

func serveImageInfo(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", idolOrigin)
	kpopnet.ServeImageInfo(w, r)
}
