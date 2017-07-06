//go:generate go-bindata -o bin_data.go --pkg templates --nometadata --prefix ../../../../mustache-pp ../../../../mustache-pp/...

package templates

import (
	"html"
	"meguca/common"
	"time"
	"github.com/hoisie/mustache"
)

// Extract reverse links to linked posts on a page
func extractBacklinks(cap int, threads ...common.Thread) common.Backlinks {
	bls := make(common.Backlinks, cap)
	register := func(p common.Post, op uint64) {
		for _, l := range p.Links {
			m, ok := bls[l[0]]
			if !ok {
				m = make(map[uint64]uint64, 4)
				bls[l[0]] = m
			}
			m[p.ID] = op
		}
	}

	for _, t := range threads {
		register(t.Post, t.ID)
		for _, p := range t.Posts {
			register(p, t.ID)
		}
	}

	return bls
}

// CalculateOmit returns the omitted post and image counts for a thread
func CalculateOmit(t common.Thread) (int, int) {
	// There might still be posts missing due to deletions even in complete
	// thread queries. Ensure we are actually retrieving an abbreviated thread
	// before calculating.
	if !t.Abbrev {
		return 0, 0
	}

	var (
		omit    = int(t.PostCtr) - (len(t.Posts) + 1)
		imgOmit uint32
	)
	if omit != 0 {
		imgOmit = t.ImageCtr
		if t.Image != nil {
			imgOmit--
		}
		for _, p := range t.Posts {
			if p.Image != nil {
				imgOmit--
			}
		}
	}
	return omit, int(imgOmit)
}

func bold(s string) string {
	s = html.EscapeString(s)
	b := make([]byte, 3, len(s)+7)
	copy(b, "<b>")
	b = append(b, s...)
	b = append(b, "</b>"...)
	return string(b)
}

// Manually correct time zone, because it gets stored wrong in the database
// somehow.
func correctTimeZone(t time.Time) time.Time {
	t = t.Round(time.Second)
	return time.Date(
		t.Year(),
		t.Month(),
		t.Day(),
		t.Hour(),
		t.Minute(),
		t.Second(),
		0,
		time.Local,
	).UTC()
}

// Return either the singular or plural form of a translation, depending on
// number
func pluralize(num int, plurals [2]string) string {
	if num > 1 {
		return plurals[1]
	} else {
		return plurals[0]
	}
}

// TODO(Kagami): Partials?
// FIXME(Kagami): Pre-parse, check for errors.
func renderMustache(name string, ctx interface{}) string {
	buf, err := Asset(name + ".mustache")
	if err != nil {
		return ""
	}
	return mustache.Render(string(buf), ctx)
}
