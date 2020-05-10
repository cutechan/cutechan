package geoip

import (
	"net/http"
)

// CountryHeader is HTTP header to look country code in.
var CountryHeader string

// CountryFromReq returns country code for the given request.
func CountryFromReq(r *http.Request) (code string) {
	if CountryHeader == "" {
		return
	}
	return r.Header.Get(CountryHeader)
}
