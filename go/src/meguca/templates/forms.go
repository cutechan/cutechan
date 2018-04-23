// Renders various HTML forms

package templates

import (
	"reflect"
	"strings"

	"meguca/config"
)

func configurationTable(v reflect.Value, key string) string {
	// Copy over all spec structs, so the mutations don't affect them
	noValues := specs[key]
	withValues := make([]inputSpec, len(noValues))
	copy(withValues, noValues)

	// Assign values to all specs
	for i, s := range withValues {
		v := v.FieldByName(strings.Title(s.ID))
		if !v.IsValid() {
			continue
		}
		switch k := v.Kind(); k {
		case reflect.Int:
			v = v.Convert(reflect.TypeOf(int64(0)))
		}
		withValues[i].Val = v.Interface()
	}

	return tableForm(withValues)
}

// Renders the form for changing server configuration.
func ConfigureServer(conf config.ServerConfig) string {
	v := reflect.ValueOf(conf)
	return configurationTable(v, "configureServer")
}

// ChangePassword renders a form for changing an account's password
func ChangePassword() string {
	return tableForm(specs["changePassword"])
}
