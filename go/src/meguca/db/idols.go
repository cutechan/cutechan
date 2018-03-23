package db

// Update or insert preview for the idol.
func UpsertIdolPreview(idolId string, imageId string) (err error) {
	err = execPrepared("upsert_idol_preview", idolId, imageId)
	return
}
