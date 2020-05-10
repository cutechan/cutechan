package geoip

import (
	"log"
	"net/http"
	"path/filepath"

	"github.com/cutechan/cutechan/go/auth"

	"github.com/oschwald/maxminddb-golang"
)

var (
	// nil if database not loaded.
	db *maxminddb.Reader
)

// NOTE(Kagami): We don't require presence of GetIP database files for a
// moment so in case of any loading errors we will just return empty
// lookup results.
func Load(dir string) error {
	dbPath := filepath.Join(dir, "GeoLite2-Country.mmdb")
	var err error
	db, err = maxminddb.Open(dbPath)
	if err != nil {
		log.Printf("GeoIP: %v", err)
	}
	return nil
}

type geoRecord struct {
	Country struct {
		ISOCode string `maxminddb:"iso_code"`
	} `maxminddb:"country"`
}

// Get request's country.
func CountyFromReq(r *http.Request) (code string) {
	if db == nil {
		return
	}
	ip, err := auth.GetByteIP(r)
	if err != nil {
		return
	}
	var rec geoRecord
	if err := db.Lookup(ip, &rec); err != nil {
		log.Printf("Country lookup error for %v: %v", ip, err)
		return
	}
	return rec.Country.ISOCode
}
