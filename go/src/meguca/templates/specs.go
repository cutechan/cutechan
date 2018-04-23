// Specifications for various input elements

package templates

import (
	"meguca/common"
)

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
)

var specs = map[string][]inputSpec{
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
		{
			ID:       "maxFiles",
			Type:     _number,
			Min:      1,
			Required: true,
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
		{ID: "popupBackdrop"},
		{ID: "imageHover"},
		{ID: "relativeTime"},
		{ID: "scrollToBottom"},
		{ID: "notification"},
		{ID: "workModeToggle"},
	},
	{
		{
			ID:   "workMode",
			Type: _shortcut,
		},
		{
			ID:   "newPost",
			Type: _shortcut,
		},
		{
			ID:   "cancelPost",
			Type: _shortcut,
		},
		{
			ID:   "selectFile",
			Type: _shortcut,
		},
		{
			ID:   "previewPost",
			Type: _shortcut,
		},
		{
			ID:   "bold",
			Type: _shortcut,
		},
		{
			ID:   "italic",
			Type: _shortcut,
		},
		{
			ID:   "spoiler",
			Type: _shortcut,
		},
		{
			ID:   "search",
			Type: _shortcut,
		},
	},
}
