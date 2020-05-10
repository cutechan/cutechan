// Various periodic cleanup scripts and such.

package db

import (
	"strings"
	"time"

	"github.com/cutechan/cutechan/go/file"
)

// Run database clean up tasks at server start and regular intervals.
// Must be launched in separate goroutine.
func runCleanupTasks() {
	// To ensure even the once an hour tasks are run shortly after server
	// start.
	time.Sleep(time.Minute)
	runFiveMinuteTasks()
	runHourTasks()

	fiveMin := time.Tick(time.Minute * 5)
	hour := time.Tick(time.Hour)
	for {
		select {
		case <-fiveMin:
			runFiveMinuteTasks()
		case <-hour:
			runHourTasks()
		}
	}
}

func runFiveMinuteTasks() {
	runPrepared("expire_post_tokens", "expire_image_tokens", "expire_bans")
	logError("file cleanup", deleteUnusedFiles())
}

func runHourTasks() {
	runPrepared("expire_user_sessions", "remove_identity_info")
}

func runPrepared(ids ...string) {
	for _, id := range ids {
		logError(strings.Replace(id, "_", " ", -1), execPrepared(id))
	}
}

// Delete files not used in any posts.
func deleteUnusedFiles() (err error) {
	r, err := prepared["delete_unused_files"].Query()
	if err != nil {
		return
	}
	defer r.Close()

	for r.Next() {
		var (
			sha1                string
			fileType, thumbType uint8
		)
		err = r.Scan(&sha1, &fileType, &thumbType)
		if err != nil {
			return
		}
		err = file.Backend.Delete(sha1, fileType, thumbType)
		if err != nil {
			return
		}
	}

	return r.Err()
}
