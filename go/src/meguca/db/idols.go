package db

import (
	"database/sql"
)

// Update or insert preview for the idol.
func UpsertIdolPreview(tx *sql.Tx, idolId string, imageId string) (err error) {
	err = execPreparedTx(tx, "upsert_idol_preview", idolId, imageId)
	return
}
