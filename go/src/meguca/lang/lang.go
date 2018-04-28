//go:generate go-bindata -o bin_data.go --pkg lang --nometadata --prefix ../../../../i18n ../../../../i18n/...

package lang

import (
	"encoding/json"
)

var (
	// Available languages.
	Langs = []string{
		"en", "ru",
	}

	// Preloaded packs.
	packs = map[string]Pack{}
)

// Localization strings for a single language.
// TODO(Kagami): Use plain map.
type Pack struct {
	Tabs, SortModes []string
	Forms           map[string][]string
	UI              map[string]string
	Common          struct {
		Posts   map[string]string
		Sizes   map[string]string
		Plurals map[string][]string
		Time    map[string][]string
		UI      map[string]string
	}
}

// Preload all available language packs.
func Load() (err error) {
	for _, langID := range Langs {
		var pack Pack
		// Will fail on mismatch of Langs/jsons which is fine.
		err = json.Unmarshal(MustAsset(langID+".json"), &pack)
		if err != nil {
			return
		}
		packs[langID] = pack
	}
	return
}

// Get pack by lang.
// API user can potentially ask for invalid langID but this should be
// used only in conjuction with "getReqLang".
func Get(langID string) Pack {
	return packs[langID]
}

// Gettext-alike helper.
func GT(langID, msgID string) string {
	if text, ok := Get(langID).UI[msgID]; ok {
		return text
	}
	return msgID
}
