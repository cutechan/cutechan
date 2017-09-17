// Various periodic cleanup scripts and such

package db

import (
	"log"
	"math"
	"meguca/config"
	"meguca/imager/assets"
	"strings"
	"time"
)

// Run database clean up tasks at server start and regular intervals. Must be
// launched in separate goroutine.
func runCleanupTasks() {
	// To ensure even the once an hour tasks are run shortly after server start
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
	logPrepared("expire_post_tokens", "expire_image_tokens", "expire_bans")
	logError("file cleanup", deleteUnusedFiles())
}

func runHourTasks() {
	logPrepared("expire_user_sessions", "remove_identity_info")
	// logError("thread cleanup", deleteOldThreads())
	// logError("board cleanup", deleteUnusedBoards())
	// logError("vaccum database", func() error {
	// 	_, err := db.Exec(`vacuum`)
	// 	return err
	// }())
}

func logPrepared(ids ...string) {
	for _, id := range ids {
		logError(strings.Replace(id, "_", " ", -1), execPrepared(id))
	}
}

func logError(prefix string, err error) {
	if err != nil {
		log.Printf("%s: %s\n", prefix, err)
	}
}

// Delete boards that are older than N days and have not had any new
// posts for N days..
func deleteUnusedBoards() error {
	conf := config.Get()
	if !conf.PruneBoards {
		return nil
	}
	min := time.Now().Add(-time.Duration(conf.BoardExpiry) * time.Hour * 24)
	return execPrepared("delete_unused_boards", min)
}

// Delete stale threads. Thread retention measured in a bumptime
// threshold, that is calculated as a function of post count till bump
// limit with an N days floor and ceiling.
func deleteOldThreads() (err error) {
	conf := config.Get()
	if !conf.PruneThreads {
		return
	}

	tx, err := db.Begin()
	if err != nil {
		return
	}
	defer RollbackOnError(tx, &err)

	// Find threads to delete
	r, err := tx.Stmt(prepared["get_bump_data"]).Query()
	if err != nil {
		return
	}
	defer r.Close()
	var (
		now         = time.Now().Unix()
		min         = float64(conf.ThreadExpiryMin * 24 * 3600)
		max         = float64(conf.ThreadExpiryMax * 24 * 3600)
		toDel       = make([]uint64, 0, 16)
		id, postCtr uint64
		bumpTime    int64
	)
	for r.Next() {
		err = r.Scan(&id, &bumpTime, &postCtr)
		if err != nil {
			return
		}
		threshold := min + (-max+min)*math.Pow(float64(postCtr)/500-1, 3)
		if threshold < min {
			threshold = min
		}
		if float64(now-bumpTime) > threshold {
			toDel = append(toDel, id)
		}
	}
	err = r.Err()
	if err != nil {
		return
	}

	// Deleted any matched threads
	q := tx.Stmt(prepared["delete_thread"])
	for _, id := range toDel {
		_, err = q.Exec(id, "system")
		if err != nil {
			return
		}
	}

	return tx.Commit()
}

// DeleteBoard deletes a board and all of its contained threads and
// posts.
func DeleteBoard(board string) error {
	_, err := prepared["delete_board"].Exec(board)
	return err
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
		err = assets.Delete(sha1, fileType, thumbType)
		if err != nil {
			return
		}
	}

	return r.Err()
}
