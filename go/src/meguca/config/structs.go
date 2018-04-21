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
	ModOnly bool `json:"-"`
	// Pregenerated public JSON.
	json []byte
}

type BoardPublic struct {
	// ID will be duplicated in DB because we need to pass it to client
	// but that doesn't matter.
	ID       string `json:"id"`
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

// Implements sort.Interface
type BoardConfigs []BoardConfig

func (b BoardConfigs) Len() int {
	return len(b)
}

func (b BoardConfigs) Less(i, j int) bool {
	return b[i].ID < b[j].ID
}

func (b BoardConfigs) Swap(i, j int) {
	b[i], b[j] = b[j], b[i]
}
