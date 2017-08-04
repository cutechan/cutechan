// +build ignore

package db

import (
	"meguca/common"
)

// ClosePost closes an open post and commits any links and hash commands
func ClosePost(id, op uint64, body string, links [][2]uint64) (
	err error,
) {
	msg, err := common.EncodeMessage(common.MessageClosePost, struct {
		ID    uint64      `json:"id"`
		Links [][2]uint64 `json:"links,omitempty"`
	}{
		ID:    id,
		Links: links,
	})
	if err != nil {
		return err
	}

	err = execPrepared("close_post", id, body, linkRow(links))
	if err != nil {
		return
	}

	if !IsTest {
		common.ClosePost(id, op, msg)
	}
	return deleteOpenPostBody(id)
}
