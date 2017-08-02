package server

import (
	"errors"
	"html"
	"io"
	"regexp"
	"strings"
	"time"
	"net/http"
	"meguca/templates"
)

var (
	errNoURL = errors.New("no url")
	errNotSupportedURL = errors.New("url not supported")
)

var (
	proxiedEmbeds = map[string]*regexp.Regexp{
		"vlive": templates.Embeds["vlive"],
	}
	vliveTitleRe = regexp.MustCompile(
		`<meta\s+property="og:title"\s+content="([^"]+)"`)
	vliveThumbRe = regexp.MustCompile(
		`<meta\s+property="og:image"\s+content="([^"]+)"`)
)

type oEmbedDoc struct {
	Title string `json:"title"`
	ThumbnailURL string `json:"thumbnail_url"`
	ThumbnailWidth int `json:"thumbnail_width"`
	ThumbnailHeight int `json:"thumbnail_height"`
}

// OEmbed-compatible response for some supported sites.
// See <https://noembed.com/> for details.
func serveEmbed(w http.ResponseWriter, r *http.Request) {
	url := r.URL.Query().Get("url")
	if url == "" {
		serveErrorJSON(w, r, errNoURL)
		return
	}

	var provider string
	for prv, pattern := range proxiedEmbeds {
		if pattern.MatchString(url) {
			provider = prv
			break
		}
	}
	if (provider != "vlive") {
		serveErrorJSON(w, r, errNotSupportedURL)
		return
	}

	doc, err := getVliveEmbed(url)
	if err != nil {
		serveErrorJSON(w, r, errInternal)
		return
	}

	serveJSON(w, r, "", doc)
}

func makeCleanVliveURL(url string) string {
	videoSeq := proxiedEmbeds["vlive"].FindStringSubmatch(url)[1]
	return "http://www.vlive.tv/video/" + videoSeq
}

func getVliveEmbed(url string) (doc oEmbedDoc, err error) {
	client := &http.Client{Timeout: time.Second * 5}
	url = makeCleanVliveURL(url)
	resp, err := client.Get(url)
	if err != nil || resp.StatusCode != 200 {
		err = errInternal
		return
	}

	defer resp.Body.Close()
	buf := make([]byte, 5000)
	_, err = io.ReadFull(resp.Body, buf)
	if err != nil {
		return
	}

	titleMatch := vliveTitleRe.FindSubmatch(buf)
	thumbMatch := vliveThumbRe.FindSubmatch(buf)
	if titleMatch == nil || thumbMatch == nil {
		err = errInternal
		return
	}

	title := string(titleMatch[1])
	title = strings.TrimPrefix(title, "[V LIVE] ")
	title = html.UnescapeString(title)
	thumb := string(thumbMatch[1])
	thumb = strings.TrimSuffix(thumb, "_play")

	doc.Title = title
	doc.ThumbnailURL = thumb
	doc.ThumbnailWidth = 720
	doc.ThumbnailHeight = 405
	return
}
