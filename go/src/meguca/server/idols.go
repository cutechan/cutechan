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
	IdolOrigin string

	uuidRe = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)
)

func serveIdolProfiles(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", IdolOrigin)
	kpopnet.ServeProfiles(w, r)
}

func serveSetIdolPreview(w http.ResponseWriter, r *http.Request) {
	if !assertPowerUser(w, r) {
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

	// Can safely check only after thumbnail generation (uploaded file may
	// have wrong mime/extension). If this check is failed we may have to
	// remove just uploaded file but this shouldn't occur often.
	if res.file.FileType != common.JPEG {
		err = aerrBadPreview
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
