package common

// Maximum lengths of various input fields
const (
	MaxLenName         = 50
	MaxLenAuth         = 50
	MaxLenSubject      = 100
	MaxLenBody         = 4000
	MaxLinesBody       = 100
	MaxLenPassword     = 50
	MaxLenUserID       = 20
	MaxLenBoardID      = 10
	MaxLenBoardTitle   = 100
	MaxBanReasonLength = 100
	MaxLenIgnoreList   = 100
	MaxLenStaffList    = 1000
	MaxLenBansList     = 1000
)

// Various cryptographic token exact lengths
const (
	LenSession    = 171
	LenImageToken = 86
)

// Some default options.
const (
	SessionExpiry        = 5 * 365 // Days
	DefaultMaxSize       = 40      // Megabytes
	DefaultMaxFiles      = 4
	DefaultLang          = "en"
	DefaultCSS           = "light"
	DefaultAdminPassword = "password"
)

// Available themes. Change this, when adding any new ones.
var (
	Themes = []string{
		"light", "dark",
	}
)

// Server paths
var (
	WebRoot      string
	ImageWebRoot string
)
