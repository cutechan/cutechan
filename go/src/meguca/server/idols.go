// Idol API handlers. See https://github.com/Kagami/kpopnet for details.
package server

import (
	"net/http"
	"regexp"

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

func setIdolPreview(w http.ResponseWriter, r *http.Request) {
	idolId := getParam(r, "id")
	if !uuidRe.MatchString(idolId) {
		serveErrorJSON(w, r, aerrBadUuid)
		return
	}

	_, m, err := parseUploadForm(w, r)
	if err != nil {
		serveErrorJSON(w, r, err)
		return
	}

	fhs := m.File["files[]"]
	if len(fhs) != 1 {
		serveErrorJSON(w, r, aerrNoFile)
		return
	}

	res, err := uploadFile(fhs[0])
	if err != nil {
		serveUploadError(w, r, err)
		return
	}

	if err := setIdolPreviewTx(idolId, res); err != nil {
		err = aerrInternal.Hide(err)
		serveErrorJSON(w, r, err)
	}

	answer := map[string]string{"SHA1": res.hash}
	serveJSON(w, r, answer)
}

func setIdolPreviewTx(idolId string, res uploadResult) (err error) {
	tx, err := db.BeginTx()
	if err != nil {
		return
	}
	defer db.EndTx(tx, &err)

	if err = db.UpsertIdolPreview(tx, idolId, res.hash); err != nil {
		return
	}

	err = db.DeleteImageToken(tx, res.token)
	return
}
