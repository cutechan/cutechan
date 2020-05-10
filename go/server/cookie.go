package server

import (
	"net/http"
)

type SameSite int

const (
	SAMESITE_DEFAULT_MODE SameSite = iota + 1
	SAMESITE_LAX_MODE
	SAMESITE_STRICT_MODE
)

// https://github.com/golang/go/issues/15867
func setSameSiteCookie(w http.ResponseWriter, cookie *http.Cookie, sameSite SameSite) {
	if v := cookie.String(); v != "" {
		v += "; SameSite"
		switch sameSite {
		case SAMESITE_LAX_MODE:
			v += "=Lax"
		case SAMESITE_STRICT_MODE:
			v += "=Strict"
		}
		w.Header().Add("Set-Cookie", v)
	}
}
