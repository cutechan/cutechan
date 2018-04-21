//go:generate easyjson --all --no_std_marshalers $GOFILE

package config

type ServerConfig struct {
	ServerPublic
}

type ServerPublic struct {
	Captcha           bool   `json:"captcha"`
	DisableUserBoards bool   `json:"disableUserBoards"`
	MaxSize           int64  `json:"maxSize"`
	MaxFiles          int    `json:"maxFiles"`
	DefaultLang       string `json:"defaultLang"`
	DefaultCSS        string `json:"defaultCSS"`
	ImageRootOverride string `json:"imageRootOverride"`
}

type BoardConfig struct {
	BoardPublic
	ID      string `json:"-"`
	ModOnly bool   `json:"-"`
}

type BoardPublic struct {
	Title    string `json:"title"`
	ReadOnly bool   `json:"readOnly,omitempty"`
}

type BoardConfContainer struct {
	BoardConfig
	JSON []byte
}

type BoardTitle struct {
	ID    string `json:"id"`
	Title string `json:"title"`
}

// Implements sort.Interface
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
