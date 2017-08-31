//go:generate easyjson --all --no_std_marshalers $GOFILE

package config

// Configs stores the global server configuration
type Configs struct {
	RootURL string `json:"rootURL"`
	Public
}

// Public contains configurations exposeable through public availability APIs
type Public struct {
	Captcha           bool   `json:"captcha"`
	DisableUserBoards bool   `json:"disableUserBoards"`
	PruneBoards       bool   `json:"pruneBoards"`
	BoardExpiry       uint   `json:"boardExpiry"`
	PruneThreads      bool   `json:"pruneThreads"`
	ThreadExpiryMin   uint   `json:"threadExpiryMin"`
	ThreadExpiryMax   uint   `json:"threadExpiryMax"`
	MaxSize           uint   `json:"maxSize"`
	DefaultLang       string `json:"defaultLang"`
	DefaultCSS        string `json:"defaultCSS"`
	ImageRootOverride string `json:"imageRootOverride"`
}

// BoardConfigs stores board-specific configuration
type BoardConfigs struct {
	BoardPublic
	ID      string `json:"id"`
	ModOnly bool   `json:"modOnly"`
}

// BoardPublic contains publically accessible board-specific configurations
type BoardPublic struct {
	Title    string `json:"title"`
	ReadOnly bool   `json:"readOnly"`
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
