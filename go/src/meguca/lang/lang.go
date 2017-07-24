//go:generate go-bindata -o bin_data.go --pkg lang --nometadata --prefix ../../../../lang ../../../../lang/...

package lang

import (
	"encoding/json"
	"meguca/common"
	"meguca/config"
)

// Currently used language pack
var pack Pack

// Pack contains a localization language pack for a single language
type Pack struct {
	ID              string
	Tabs, SortModes []string
	Forms           map[string][2]string
	UI              map[string]string
	Templates       map[string][]string
	Common          struct {
		Posts   map[string]string
		Sizes   map[string]string
		Plurals map[string][]string
		Time    map[string][]string
		UI      map[string]string
	}
}

// Loads and parses the selected JSON language pack
func Load() (err error) {
	lang := config.Get().DefaultLang
	buf, err := Asset(lang + ".json")
	if err != nil {
		// In case if database value was corrupted/changed, let the server
		// load with default locale.
		buf, err = Asset(common.DefaultLang + ".json")
		if err != nil {
			return
		}
	}
	err = json.Unmarshal(buf, &pack)
	if err != nil {
		return
	}
	pack.ID = lang
	return
}

// Returns the loaded language pack
func Get() Pack {
	return pack
}
