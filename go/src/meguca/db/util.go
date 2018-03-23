//go:generate go-bindata -o bin_data.go --pkg db --nometadata --prefix sql sql/...

package db

import (
	"database/sql"
	"fmt"
	"log"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/lib/pq"
)

var (
	// Stores generated prepared statements
	prepared = make(map[string]*sql.Stmt)
)

type executor interface {
	Exec(args ...interface{}) (sql.Result, error)
}

type rowScanner interface {
	Scan(dest ...interface{}) error
}

type tableScanner interface {
	rowScanner
	Next() bool
	Err() error
	Close() error
}

func logError(prefix string, err error) {
	if err != nil {
		log.Printf("db: %s: %s\n", prefix, err)
	}
}

func makeError(id string, err error) error {
	return fmt.Errorf("Error preparing %s: %v", id, err)
}

// Generate prepared statements
func genPrepared() error {
	names := AssetNames()
	sort.Strings(names)
	left := make([]string, 0, len(names))

	for _, id := range names {
		switch {
		case strings.HasPrefix(id, "init"):
			continue
		case strings.HasPrefix(id, "functions"):
			_, err := db.Exec(getQuery(id))
			if err != nil {
				return makeError(id, err)
			}
		default:
			left = append(left, id)
		}
	}

	for _, id := range left {
		var err error
		k := strings.TrimSuffix(filepath.Base(id), ".sql")
		prepared[k], err = db.Prepare(getQuery(id))
		if err != nil {
			return makeError(id, err)
		}
	}

	return nil
}

// Deprecated: use BeginTx instead.
func StartTransaction() (*sql.Tx, error) {
	return BeginTx()
}

// RollbackOnError on error undoes the transaction on error.
// Deprecated: move to EndTx instead.
func RollbackOnError(tx *sql.Tx, err *error) {
	if *err != nil {
		tx.Rollback()
	}
}

// Initiate a new DB transaction. It is the responsibility of the caller
// to commit or rollback the transaction.
func BeginTx() (tx *sql.Tx, err error) {
	return db.Begin()
}

// Commit/rollback transaction depending on the error state.
func EndTx(tx *sql.Tx, err *error) {
	if *err != nil {
		if rbErr := tx.Rollback(); rbErr != nil {
			// Can only log this because original err should be preserved.
			logError("rollback", rbErr)
		}
		return
	}
	*err = tx.Commit()
}

func getExecutor(tx *sql.Tx, key string) executor {
	if tx != nil {
		return tx.Stmt(prepared[key])
	}
	return prepared[key]
}

func execPrepared(id string, args ...interface{}) error {
	_, err := prepared[id].Exec(args...)
	return err
}

func execPreparedTx(tx *sql.Tx, id string, args ...interface{}) error {
	stmt, ok := prepared[id]
	if !ok {
		return fmt.Errorf("no such prepared id: %s', id")
	}
	_, err := tx.Stmt(stmt).Exec(args...)
	return err
}

func getStatement(tx *sql.Tx, id string) *sql.Stmt {
	stmt := prepared[id]
	if tx != nil {
		stmt = tx.Stmt(stmt)
	}
	return stmt
}

func setReadOnly(tx *sql.Tx) error {
	_, err := tx.Exec("SET TRANSACTION READ ONLY")
	return err
}

// IsConflictError returns if an error is a unique key conflict error
func IsConflictError(err error) bool {
	if err, ok := err.(*pq.Error); ok && err.Code.Name() == "unique_violation" {
		return true
	}
	return false
}

// Retrieve binary-encoded SQL query
func getQuery(id string) string {
	return string(MustAsset(id))
}

// Assigns a function to listen to Postgres notifications on a channel
func listenFunc(event string, fn func(msg string) error) error {
	if IsTest {
		return nil
	}
	l, err := Listen(event)
	if err != nil {
		return err
	}

	go func() {
		for msg := range l.Notify {
			if msg == nil {
				continue
			}
			if err := fn(msg.Extra); err != nil {
				log.Println(err)
			}
		}
	}()

	return nil
}

// Listen starts listening for notification events on a specific channel
func Listen(event string) (*pq.Listener, error) {
	l := pq.NewListener(
		ConnArgs,
		time.Second,
		time.Second*10,
		func(_ pq.ListenerEventType, _ error) {},
	)
	if err := l.Listen(event); err != nil {
		return nil, err
	}
	return l, nil
}

// Execute all SQL statement strings and return on first error, if any
func execAll(tx *sql.Tx, q ...string) error {
	for _, q := range q {
		if _, err := tx.Exec(q); err != nil {
			return err
		}
	}
	return nil
}
