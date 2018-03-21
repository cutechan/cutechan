package db

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"meguca/auth"
	"meguca/common"
	"meguca/config"
	"meguca/util"

	"github.com/Kagami/kpopnet/go/src/kpopnet"
)

const (
	// TestConnArgs contains ConnArgs used for tests
	TestConnArgs = `user=meguca password=meguca dbname=meguca_test sslmode=disable`
)

var (
	version = len(upgrades) + 1

	// ConnArgs specifies the PostgreSQL connection arguments
	ConnArgs string

	// IsTest can be overridden to not launch several infinite loops
	// during tests
	IsTest bool

	// Stores the postgres database instance
	db *sql.DB
)

var upgrades = []func(*sql.Tx) error{
	func(tx *sql.Tx) (err error) {
		// Delete legacy columns
		return execAll(tx,
			`ALTER TABLE threads
				DROP COLUMN locked`,
			`ALTER TABLE boards
				DROP COLUMN hashCommands,
				DROP COLUMN codeTags`,
		)
	},
	func(tx *sql.Tx) (err error) {
		_, err = tx.Exec(
			`ALTER TABLE threads
				DROP COLUMN log`,
		)
		return
	},
	func(tx *sql.Tx) (err error) {
		_, err = tx.Exec(
			`ALTER TABLE boards
				DROP COLUMN ctr`,
		)
		return
	},
	// Restore correct image counters after incorrect updates
	func(tx *sql.Tx) (err error) {
		_, err = tx.Exec(
			`UPDATE threads
				SET imageCtr = (SELECT COUNT(*) FROM posts
					WHERE SHA1 IS NOT NULL
						AND op = threads.id
				)`,
		)
		return
	},
	func(tx *sql.Tx) (err error) {
		_, err = tx.Exec(
			`ALTER TABLE images
				ADD COLUMN Title varchar(100) not null default '',
				ADD COLUMN Artist varchar(100) not null default ''`,
		)
		return
	},
	func(tx *sql.Tx) (err error) {
		_, err = tx.Exec(
			`ALTER TABLE posts
				ADD COLUMN sage bool`,
		)
		return
	},
	func(tx *sql.Tx) (err error) {
		_, err = tx.Exec(`DROP INDEX deleted`)
		return
	},
	// Set default expiry configs, to keep all threads from deleting
	func(tx *sql.Tx) (err error) {
		var s string
		err = tx.QueryRow("SELECT val FROM main WHERE id = 'config'").Scan(&s)
		if err != nil {
			return
		}
		conf, err := decodeConfigs(s)
		if err != nil {
			return
		}

		conf.ThreadExpiryMin = config.Defaults.ThreadExpiryMin
		conf.ThreadExpiryMax = config.Defaults.ThreadExpiryMax
		buf, err := json.Marshal(conf)
		if err != nil {
			return
		}
		_, err = tx.Exec(
			`UPDATE main
				SET val = $1
				WHERE id = 'config'`,
			string(buf),
		)
		return
	},
	func(tx *sql.Tx) (err error) {
		_, err = tx.Exec(
			`ALTER TABLE boards
				ADD COLUMN disableRobots bool not null default false`,
		)
		return
	},
	func(tx *sql.Tx) (err error) {
		_, err = tx.Exec(
			`ALTER TABLE threads
				ADD COLUMN sticky bool default false`,
		)
		return
	},
	func(tx *sql.Tx) (err error) {
		_, err = tx.Exec(
			`ALTER TABLE bans
				ADD COLUMN forPost bigint default 0`,
		)
		return
	},
	func(tx *sql.Tx) (err error) {
		return execAll(tx,
			`create table mod_log (
				type smallint not null,
				board varchar(3) not null,
				id bigint not null,
				by varchar(20) not null,
				created timestamp default (now() at time zone 'utc')
			)`,
			`create index mod_log_board on mod_log (board)`,
			`create index mod_log_created on mod_log (created)`,
		)
	},
	func(tx *sql.Tx) (err error) {
		_, err = tx.Exec(`create index sticky on threads (sticky)`)
		return
	},
	func(tx *sql.Tx) (err error) {
		_, err = tx.Exec(
			`ALTER TABLE posts
				DROP COLUMN backlinks`,
		)
		return
	},
	func(tx *sql.Tx) (err error) {
		_, err = tx.Exec(
			`create table banners (
				board varchar(3) not null references boards on delete cascade,
				id smallint not null,
				data bytea not null,
				mime text not null
			);`,
		)
		return
	},
	func(tx *sql.Tx) (err error) {
		q := [...]string{
			`alter table boards
				alter column id type text`,
			`alter table bans
				alter column board type text`,
			`alter table mod_log
				alter column board type text`,
			`alter table staff
				alter column board type text`,
			`alter table banners
				alter column board type text`,
			`alter table threads
				alter column board type text`,
			`alter table posts
				alter column board type text`,
		}
		for _, q := range q {
			_, err = tx.Exec(q)
			if err != nil {
				return
			}
		}
		return
	},
	func(tx *sql.Tx) (err error) {
		_, err = tx.Exec(
			`ALTER TABLE boards
				DROP COLUMN eightball`,
		)
		return
	},
	func(tx *sql.Tx) (err error) {
		_, err = tx.Exec(
			`ALTER TABLE boards
				DROP COLUMN forcedanon`,
		)
		return
	},
	func(tx *sql.Tx) (err error) {
		_, err = tx.Exec(
			`ALTER TABLE boards
				DROP COLUMN disablerobots`,
		)
		return
	},
	func(tx *sql.Tx) (err error) {
		_, err = tx.Exec(
			`ALTER TABLE boards
				DROP COLUMN readonly,
				DROP COLUMN textonly`,
		)
		return
	},
	func(tx *sql.Tx) (err error) {
		_, err = tx.Exec(
			`create table news (
				id bigserial primary key,
				subject varchar(100) not null,
				body varchar(2000) not null,
				imageName varchar(200),
				time timestamp default (now() at time zone 'utc')
			)`,
		)
		return
	},
	func(tx *sql.Tx) (err error) {
		_, err = tx.Exec(
			`ALTER TABLE boards
				DROP COLUMN notice,
				DROP COLUMN rules`,
		)
		return
	},
	func(tx *sql.Tx) (err error) {
		return execAll(tx,
			`ALTER TABLE boards
				ADD COLUMN readOnly boolean NOT NULL DEFAULT FALSE`,
			`ALTER TABLE boards
				ALTER COLUMN readOnly DROP DEFAULT`,
		)
	},
	func(tx *sql.Tx) (err error) {
		_, err = tx.Exec(
			`ALTER TABLE images
				ALTER COLUMN Title TYPE varchar(300)`,
		)
		return
	},
	func(tx *sql.Tx) (err error) {
		_, err = tx.Exec(
			`create table post_tokens (
				id char(20) not null primary key,
				ip inet not null,
				expires timestamp not null
			)`,
		)
		return
	},
	func(tx *sql.Tx) (err error) {
		_, err = tx.Exec(
			`DELETE FROM main WHERE id = 'pyu'`,
		)
		return
	},
	func(tx *sql.Tx) (err error) {
		return execAll(tx,
			`ALTER TABLE boards
				ADD COLUMN modOnly boolean NOT NULL DEFAULT FALSE`,
			`ALTER TABLE boards
				ALTER COLUMN modOnly DROP DEFAULT`,
		)
	},
	func(tx *sql.Tx) (err error) {
		_, err = tx.Exec(
			`ALTER TABLE posts
				DROP COLUMN imageName`,
		)
		return
	},
	func(tx *sql.Tx) (err error) {
		_, err = tx.Exec(
			`ALTER TABLE posts
				DROP COLUMN spoiler`,
		)
		return
	},
	func(tx *sql.Tx) (err error) {
		return execAll(tx,
			`CREATE TABLE post_files (
				post_id BIGINT REFERENCES posts ON DELETE CASCADE,
				file_hash CHAR(40) REFERENCES images,
				PRIMARY KEY (post_id, file_hash)
			)`,
			`CREATE INDEX post_files_file_hash ON post_files (file_hash)`,
		)
	},
	func(tx *sql.Tx) (err error) {
		_, err = tx.Exec(
			`ALTER TABLE posts
				ALTER COLUMN editing DROP NOT NULL`,
		)
		return
	},
	func(tx *sql.Tx) (err error) {
		return execAll(tx,
			`DROP FUNCTION bump_thread(BIGINT, BOOL, BOOL, BOOL, BOOL)`,
			`DROP FUNCTION insert_thread(VARCHAR(100), BIGINT, BOOL, BIGINT, TEXT, BIGINT, BIGINT, VARCHAR(2000), VARCHAR(50), CHAR(10), VARCHAR(20), BYTEA, INET, CHAR(40), BIGINT[][2], JSON[])`,
			`DROP FUNCTION insert_thread(VARCHAR(100), BIGINT, BOOL, BOOL, BIGINT, TEXT, BIGINT, BIGINT, VARCHAR(2000), VARCHAR(50), CHAR(10), VARCHAR(20), BYTEA, INET, CHAR(40), VARCHAR(200), BIGINT[][2], JSON[])`,
		)
	},
	func(tx *sql.Tx) (err error) {
		return execAll(tx,
			`ALTER TABLE post_files
				ADD COLUMN id bigserial UNIQUE`,
		)
	},
	// Migrate post images to support multiple files per post.
	func(tx *sql.Tx) (err error) {
		type File struct {
			id   uint64
			sha1 string
		}
		files := make([]File, 0)

		// Keep old scheme values just in case.
		r, err := tx.Query("SELECT id, sha1 FROM posts WHERE sha1 IS NOT NULL ORDER BY id")
		if err != nil {
			return
		}
		defer r.Close()
		for r.Next() {
			var id uint64
			var sha1 string
			err = r.Scan(&id, &sha1)
			if err != nil {
				return
			}
			files = append(files, File{id, sha1})
		}
		err = r.Err()
		if err != nil {
			return
		}

		// Fill new scheme.
		for _, f := range files {
			_, err = tx.Exec(
				"INSERT INTO post_files (post_id, file_hash) VALUES ($1, $2)",
				f.id, f.sha1,
			)
			if err != nil {
				return
			}
		}
		return
	},
	func(tx *sql.Tx) (err error) {
		return execAll(tx,
			`DROP FUNCTION insert_thread(id bigint, now bigint, body character varying, auth character varying, links bigint[], op bigint, board text, ip inet, file_cnt bigint, subject character varying)`,
			`ALTER TABLE posts ALTER COLUMN body TYPE text`,
		)
	},
	func(tx *sql.Tx) (err error) {
		return execAll(tx,
			`ALTER TABLE post_files DROP CONSTRAINT post_files_pkey`,
			`ALTER TABLE post_files DROP CONSTRAINT post_files_id_key`,
			`ALTER TABLE post_files ADD PRIMARY KEY (id)`,
		)
	},
	func(tx *sql.Tx) (err error) {
		return execAll(tx,
			`CREATE TABLE stickers (
				sha1 char(40) PRIMARY KEY REFERENCES images
			)`,
			`CREATE TABLE tags (
				id bigserial PRIMARY KEY,
				name varchar(100) not null UNIQUE
			)`,
			`CREATE TABLE sticker_tags (
				sticker_hash char(40) REFERENCES stickers ON DELETE CASCADE,
				tag_id bigint REFERENCES tags ON DELETE CASCADE,
				PRIMARY KEY (sticker_hash, tag_id)
			)`,
			`CREATE INDEX sticker_tags_tag_id ON sticker_tags (tag_id)`,
		)
	},
	func(tx *sql.Tx) (err error) {
		return execAll(tx,
			`DROP FUNCTION insert_thread(id bigint, now bigint, body text, auth character varying, links bigint[], op bigint, board text, ip inet, file_cnt bigint, subject character varying)`,
		)
	},
}

func StartDb() (err error) {
	if db, err = sql.Open("postgres", ConnArgs); err != nil {
		return
	}

	var exists bool
	err = db.QueryRow(getQuery("init/check_db_exists.sql")).Scan(&exists)
	if err != nil {
		return
	}

	tasks := []func() error{}
	if exists {
		if err = checkVersion(); err != nil {
			return
		}
	} else {
		tasks = append(tasks, initDb)
	}
	tasks = append(tasks, startKpopnetDb)
	tasks = append(tasks, genPrepared)
	if !exists {
		tasks = append(tasks, createAdminAccount)
	}
	tasks = append(tasks, loadConfigs, loadBoardConfigs, loadBans)
	if err = util.Waterfall(tasks...); err != nil {
		return
	}

	go runCleanupTasks()
	return
}

func startKpopnetDb() (err error) {
	return kpopnet.StartDb(ConnArgs)
}

// Check database version perform any upgrades
func checkVersion() (err error) {
	var v int
	err = db.QueryRow(`select val from main where id = 'version'`).Scan(&v)
	if err != nil {
		return
	}

	var tx *sql.Tx
	for i := v; i < version; i++ {
		log.Printf("upgrading database to version %d\n", i+1)
		tx, err = db.Begin()
		if err != nil {
			return
		}

		err = upgrades[i-1](tx)
		if err != nil {
			return rollBack(tx, err)
		}

		// Write new version number
		_, err = tx.Exec(
			`update main set val = $1 where id = 'version'`,
			i+1,
		)
		if err != nil {
			return rollBack(tx, err)
		}

		err = tx.Commit()
		if err != nil {
			return
		}
	}

	return
}

func rollBack(tx *sql.Tx, err error) error {
	if rbErr := tx.Rollback(); rbErr != nil {
		err = util.WrapError(err.Error(), rbErr)
	}
	return err
}

func initDb() error {
	log.Println("initializing database")

	conf, err := json.Marshal(config.Defaults)
	if err != nil {
		return err
	}

	q := fmt.Sprintf(getQuery("init/init.sql"), version, string(conf))
	_, err = db.Exec(q)
	return err
}

// Create admin account with default password.
func createAdminAccount() error {
	hash, err := auth.BcryptHash(common.DefaultAdminPassword, 10)
	if err != nil {
		return err
	}
	return RegisterAccount("admin", hash)
}
