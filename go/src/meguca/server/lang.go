package server

import (
	"net/http"

	"meguca/config"
	"meguca/lang"
)

var (
	langMap = map[string]bool{}
)

func init() {
	for _, langID := range lang.Langs {
		langMap[langID] = true
	}
}

func getReqLang(r *http.Request) string {
	c, err := r.Cookie("lang")
	if err != nil {
		return config.Get().DefaultLang
	}
	langID := c.Value
	if langMap[langID] {
		return langID
	}
	return config.Get().DefaultLang
}
