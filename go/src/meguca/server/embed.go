package server

import (
	"fmt"
	"html"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"

	"meguca/templates"
)

var (
	proxiedEmbeds = map[string]*regexp.Regexp{
		"vlive": templates.LinkEmbeds["vlive"],
	}
	vliveTitleRe = regexp.MustCompile(
		`<meta\s+property="og:title"\s+content="([^"]+)"`)
	vliveThumbRe = regexp.MustCompile(
		`<meta\s+property="og:image"\s+content="([^"]+)"`)
)

type oEmbedDoc struct {
	Title           string `json:"title"`
	HTML            string `json:"html"`
	Width           int    `json:"width"`
	Height          int    `json:"height"`
	ThumbnailURL    string `json:"thumbnail_url"`
	ThumbnailWidth  int    `json:"thumbnail_width"`
	ThumbnailHeight int    `json:"thumbnail_height"`
}

// OEmbed-compatible response for some supported sites.
// See <https://noembed.com/> for details.
func serveEmbed(w http.ResponseWriter, r *http.Request) {
	url := r.URL.Query().Get("url")
	if url == "" {
		serveErrorJSON(w, r, aerrNoURL)
		return
	}

	var provider string
	for prv, pattern := range proxiedEmbeds {
		if pattern.MatchString(url) {
			provider = prv
			break
		}
	}
	if provider != "vlive" {
		serveErrorJSON(w, r, aerrNotSupportedURL)
		return
	}

	doc, err := getVliveEmbed(url)
	if err != nil {
		serveErrorJSON(w, r, aerrInternal.Hide(err))
		return
	}

	serveJSON(w, r, doc)
}

func getVliveEmbed(url string) (doc oEmbedDoc, err error) {
	videoSeq := proxiedEmbeds["vlive"].FindStringSubmatch(url)[1]
	url = "https://www.vlive.tv/video/" + videoSeq

	client := &http.Client{Timeout: time.Second * 5}
	resp, err := client.Get(url)
	if err != nil || resp.StatusCode != 200 {
		err = fmt.Errorf("bad vlive response: %v (%d)", err, resp.StatusCode)
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
		err = fmt.Errorf("can't match vlive title/preview")
		return
	}

	title := string(titleMatch[1])
	title = strings.TrimPrefix(title, "[V LIVE] ")
	title = html.UnescapeString(title)
	doc.Title = title

	doc.HTML = `<iframe src="https://www.vlive.tv/embed/` +
		videoSeq + `"></iframe>`
	// TODO(Kagami): This is not quite correct.
	doc.Width = 1280
	doc.Height = 720

	thumb := string(thumbMatch[1])
	thumb = strings.TrimSuffix(thumb, "_play")
	doc.ThumbnailURL = thumb
	doc.ThumbnailWidth = 720
	doc.ThumbnailHeight = 405

	return
}
