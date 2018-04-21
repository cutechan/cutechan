//go:generate easyjson --all --no_std_marshalers $GOFILE

package config

import (
	"github.com/mailru/easyjson"
)

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

func (c *ServerConfig) Marshal() ([]byte, error) {
	return easyjson.Marshal(c)
}

func (c *ServerConfig) Unmarshal(data []byte) error {
	return easyjson.Unmarshal(data, c)
}

func (c *ServerPublic) Marshal() ([]byte, error) {
	return easyjson.Marshal(c)
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

func (c *BoardConfig) Marshal() ([]byte, error) {
	return easyjson.Marshal(c)
}

func (c *BoardConfig) Unmarshal(data []byte) error {
	return easyjson.Unmarshal(data, c)
}

func (c *BoardPublic) Marshal() ([]byte, error) {
	return easyjson.Marshal(c)
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
