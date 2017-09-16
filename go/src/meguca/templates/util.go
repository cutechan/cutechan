package templates

import (
	"html"
	"meguca/common"
	"time"
)

const numBanners = 4

// Extract reverse links to linked posts on a page
func extractBacklinks(cap int, threads ...common.Thread) common.Backlinks {
	bls := make(common.Backlinks, cap)
	register := func(p *common.Post, op uint64) {
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

	omit := int(t.PostCtr) - (len(t.Posts) + 1)
	imgOmit := 0
	if omit != 0 {
		imgOmit = int(t.ImageCtr) - len(t.Files)
		for _, p := range t.Posts {
			imgOmit -= len(p.Files)
		}
	}
	return omit, imgOmit
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

// https://stackoverflow.com/a/38608022
type sortableUInt64 []uint64

func (a sortableUInt64) Len() int           { return len(a) }
func (a sortableUInt64) Swap(i, j int)      { a[i], a[j] = a[j], a[i] }
func (a sortableUInt64) Less(i, j int) bool { return a[i] < a[j] }
