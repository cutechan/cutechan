package common

import (
	"regexp"
)

// Maximum lengths of various input fields
const (
	MaxLenName         = 50
	MaxLenAuth         = 50
	MaxLenPostPassword = 100
	MaxLenSubject      = 100
	MaxLenBody         = 2000
	MaxLinesBody       = 100
	MaxLenPassword     = 50
	MaxLenFileArist    = 100
	MaxLenFileTitle    = 100
	MaxLenUserID       = 20
	MaxLenBoardID      = 10
	MaxLenBoardTitle   = 100
	MaxBanReasonLength = 100
	MaxNumBanners      = 20
	MaxBannerSize      = 100 << 10
)

// Various cryptographic token exact lengths
const (
	LenSession    = 171
	LenImageToken = 86
)

// Some hardcoded options
const (
	ThumbSize = 200
	MaxWidth = 12000
	MaxHeight = 12000
	JPEGQuality = 90
	SessionExpiry = 5 * 365  // Days
	DefaultMaxSize = 20  // Megabytes
	DefaultLang = "en"
	DefaultCSS = "light"
)

// Available language packs and themes. Change this, when adding any new ones.
var (
	Langs = []string{
		"en", "ru",
	}
	Themes = []string{
		"light", "dark", "photon",
	}
)

// Common Regex expressions
var (
	CommandRegexp = regexp.MustCompile(`^#(flip|\d*d\d+|pyu|pcount|sw(?:\d+:)?\d+:\d+(?:[+-]\d+)?)$`)
	DiceRegexp    = regexp.MustCompile(`(\d*)d(\d+)`)
)

// Server paths
var (
	WebRoot string
	ImageWebRoot string
)
