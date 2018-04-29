//go:generate go-bindata -o bin_data.go --pkg lang --nometadata --prefix ../../../../po ../../../../po/...

// Internationalization support.
package lang

import (
	"github.com/leonelquinteros/gotext"
)

var (
	// Available languages.
	Langs = []string{
		"en", "ru",
	}

	// Some UI constants.
	Months = []string{
		"Jan", "Feb", "Mar", "Apr", "May", "Jun",
		"Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
	}
	Days = []string{
		"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat",
	}

	// Preloaded translations.
	packs = map[string]*gotext.Po{}
)

// Preload all available translations.
func Load() (err error) {
	// Will fail on mismatch of Langs/PO files which is fine.
	for _, langID := range Langs {
		pack := new(gotext.Po)
		pack.Parse(MustAsset(langID + ".po"))
		packs[langID] = pack
	}
	return
}

func get(langID string) *gotext.Po {
	return packs[langID]
}

// Translate given string.
// Will panic on invalid langID, must be checked by caller.
func Get(langID, str string) string {
	return get(langID).Get(str)
}

// Translate plural form.
// Will panic on invalid langID, must be checked by caller.
func GetN(langID, str, plural string, n int) string {
	return get(langID).GetN(str, plural, n)
}
