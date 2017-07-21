// Specifications for various input elements

package templates

import (
	"meguca/common"
)

// NOTE: After adding inputSpec structs with new ID fields, be sure to add the
// description to at least `lang/en_GB/server.json.forms`. Then run
// `scripts/migrate_lang.js` to insert temporary placeholders into any language
// packs missing translations.

// Reused in multiple places
var (
	repeatPasswordSpec = inputSpec{
		ID:           "repeat",
		Type:         _password,
		MaxLength:    common.MaxLenPassword,
		NoID:         true,
		Required:     true,
		Autocomplete: "new-password",
	}
	staffTitleSpec = inputSpec{ID: "staffTitle"}
)

var specs = map[string][]inputSpec{
	"noscriptPostCreation": {
		inputSpec{
			ID:        "body",
			Type:      _textarea,
			Rows:      5,
			MaxLength: common.MaxLenBody,
		},
	},
	"login": {
		{
			ID:           "id",
			Type:         _string,
			MaxLength:    common.MaxLenUserID,
			NoID:         true,
			Required:     true,
			Autocomplete: "username",
		},
		{
			ID:           "password",
			Type:         _password,
			MaxLength:    common.MaxLenPassword,
			NoID:         true,
			Required:     true,
			Autocomplete: "current-password",
		},
	},
	"register": {
		{
			ID:           "id",
			Type:         _string,
			MaxLength:    common.MaxLenUserID,
			NoID:         true,
			Required:     true,
			Autocomplete: "off",
		},
		{
			ID:           "password",
			Type:         _password,
			MaxLength:    common.MaxLenPassword,
			NoID:         true,
			Required:     true,
			Autocomplete: "new-password",
		},
		repeatPasswordSpec,
	},
	"changePassword": {
		{
			ID:           "oldPassword",
			Type:         _password,
			MaxLength:    common.MaxLenPassword,
			NoID:         true,
			Required:     true,
			Autocomplete: "current-password",
		},
		{
			ID:           "newPassword",
			Type:         _password,
			MaxLength:    common.MaxLenPassword,
			NoID:         true,
			Required:     true,
			Autocomplete: "new-password",
		},
		repeatPasswordSpec,
	},
	"configureBoard": {
		{
			ID:        "title",
			Type:      _string,
			MaxLength: common.MaxLenBoardTitle,
		},
		{ID: "readOnly"},
	},
	"createBoard": {
		{
			ID:        "boardName",
			Type:      _string,
			Required:  true,
			Pattern:   "^[a-z0-9]{1,10}$",
			MaxLength: common.MaxLenBoardID,
		},
		{
			ID:        "boardTitle",
			Type:      _string,
			Required:  true,
			MaxLength: common.MaxLenBoardTitle,
		},
	},
	"configureServer": {
		{ID: "captcha"},
		{ID: "disableUserBoards"},
		{
			ID:      "defaultCSS",
			Type:    _select,
			Options: common.Themes,
		},
		{
			ID:      "defaultLang",
			Type:    _select,
			Options: common.Langs,
		},
		{
			ID:       "maxSize",
			Type:     _number,
			Min:      1,
			Required: true,
		},
		{ID: "pruneBoards"},
		{
			ID:       "boardExpiry",
			Type:     _number,
			Min:      1,
			Required: true,
		},
		{ID: "pruneThreads"},
		{
			ID:       "threadExpiryMin",
			Type:     _number,
			Min:      1,
			Required: true,
		},
		{
			ID:       "threadExpiryMax",
			Type:     _number,
			Min:      1,
			Required: true,
		},
		{
			ID:   "rootURL",
			Type: _string,
		},
		{
			ID:   "imageRootOverride",
			Type: _string,
		},
	},
}

// Specs of option inputs grouped by tab
var optionSpecs = [...][]inputSpec{
	{
		{
			ID:      "theme",
			Type:    _select,
			Options: common.Themes,
		},
		{ID: "imageHover"},
		{ID: "relativeTime"},
		{ID: "notification"},
		{ID: "workModeToggle"},
	},
	{
		{
			ID:   "newPost",
			Type: _shortcut,
		},
		{
			ID:   "workMode",
			Type: _shortcut,
		},
	},
}
