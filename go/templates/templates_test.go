package templates

import (
	"github.com/cutechan/cutechan/go/config"
	"github.com/cutechan/cutechan/go/lang"
	"github.com/cutechan/cutechan/go/util"
	"testing"
)

func init() {
	_, err := config.SetBoardConfigs(config.BoardConfigs{
		ID: "a",
	})
	if err != nil {
		panic(err)
	}
	config.Set(config.Configs{
		Public: config.Public{
			DefaultLang: "en_GB",
		},
	})

	if err := util.Waterfall(lang.Load, Compile); err != nil {
		panic(err)
	}
}

func TestCompileTemplates(t *testing.T) {
	config.SetClient([]byte{1}, "hash")
	(*config.Get()).Captcha = true

	if err := Compile(); err != nil {
		t.Fatal(err)
	}
}
