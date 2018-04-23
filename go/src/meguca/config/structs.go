//go:generate easyjson $GOFILE

package config

type ServerConfig struct {
	ServerPublic
}

//easyjson:json
type ServerPublic struct {
	DisableUserBoards bool   `json:"disableUserBoards,omitempty"`
	MaxSize           int64  `json:"maxSize"`
	MaxFiles          int    `json:"maxFiles"`
	DefaultLang       string `json:"defaultLang"`
	DefaultCSS        string `json:"defaultCSS"`
	ImageRootOverride string `json:"imageRootOverride,omitempty"`
}

type AccessMode int

const (
	AccessBypass AccessMode = iota - 1
	AccessViaBlacklist
	AccessViaWhitelist
)

// Some fields will be duplicated in DB because we need to pass them to
// JS client but that doesn't matter.
//easyjson:json
type BoardConfig struct {
	BoardPublic
	ModOnly     bool       `json:"modOnly,omitempty"`
	AccessMode  AccessMode `json:"accessMode,omitempty"`
	IncludeAnon bool       `json:"includeAnon,omitempty"`
	// Pregenerated public JSON.
	json []byte
}

//easyjson:json
type BoardPublic struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	ReadOnly bool   `json:"readOnly,omitempty"`
}

// Implements sort.Interface
//easyjson:json
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

func (cs *BoardConfigs) TryMarshal() []byte {
	data, err := cs.MarshalJSON()
	if err != nil {
		return []byte("null")
	}
	return data
}
