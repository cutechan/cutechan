// +build tools

// tools is a dummy package that will be ignored for builds, but included for dependencies
package tools

import (
	_ "github.com/kevinburke/go-bindata/go-bindata"
	_ "github.com/mailru/easyjson/easyjson"
	_ "github.com/valyala/quicktemplate/qtc"
)
