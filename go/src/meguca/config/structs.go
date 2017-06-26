//go:generate easyjson --all --no_std_marshalers $GOFILE

package config

// Configs stores the global server configuration
type Configs struct {
	Public
	PruneBoards   bool `json:"pruneBoards"`
	Pyu           bool `json:"pyu"`
	JPEGQuality   uint8
	MaxWidth      uint16 `json:"maxWidth"`
	MaxHeight     uint16 `json:"maxHeight"`
	BoardExpiry   uint   `json:"boardExpiry"`
	MaxSize       uint   `json:"maxSize"`
	SessionExpiry uint   `json:"sessionExpiry"`
	RootURL       string `json:"rootURL"`
	Salt          string `json:"salt"`
}

// Public contains configurations exposeable through public availability APIs
type Public struct {
	Captcha           bool              `json:"captcha"`
	DisableUserBoards bool              `json:"disableUserBoards"`
	PruneThreads      bool              `json:"pruneThreads"`
	ThreadExpiryMin   uint              `json:"threadExpiryMin"`
	ThreadExpiryMax   uint              `json:"threadExpiryMax"`
	DefaultLang       string            `json:"defaultLang"`
	DefaultCSS        string            `json:"defaultCSS"`
	ImageRootOverride string            `json:"imageRootOverride"`
}

// BoardConfigs stores board-specific configuration
type BoardConfigs struct {
	BoardPublic
	ID            string   `json:"id"`
}

// BoardPublic contains publically accessible board-specific configurations
type BoardPublic struct {
	ReadOnly   bool   `json:"readOnly"`
	TextOnly   bool   `json:"textOnly"`
	Title      string `json:"title"`
	Notice     string `json:"notice"`
	Rules      string `json:"rules"`
}

// BoardConfContainer contains configurations for an individual board as well
// as pregenerated public JSON and it's hash
type BoardConfContainer struct {
	BoardConfigs
	JSON []byte
	Hash string
}

// BoardTitle contains a board's ID and title
type BoardTitle struct {
	ID    string `json:"id"`
	Title string `json:"title"`
}

// BoardTitles implements sort.Interface
type BoardTitles []BoardTitle

func (b BoardTitles) Len() int {
	return len(b)
}

func (b BoardTitles) Less(i, j int) bool {
	return b[i].ID < b[j].ID
}

func (b BoardTitles) Swap(i, j int) {
	b[i], b[j] = b[j], b[i]
}
