// Renders various HTML forms

package templates

import (
	"meguca/config"
	"reflect"
	"sort"
	"strings"
)

// Render a form for setting board configuration.
func ConfigureBoard(conf config.BoardConfig) string {
	v := reflect.ValueOf(conf)
	return configurationTable(v, "configureBoard", true)
}

func configurationTable(v reflect.Value, key string, needCaptcha bool) string {
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

	return tableForm(withValues, needCaptcha)
}

// Renders the form for changing server configuration.
func ConfigureServer(conf config.ServerConfig) string {
	v := reflect.ValueOf(conf)
	return configurationTable(v, "configureServer", false)
}

// ChangePassword renders a form for changing an account's password
func ChangePassword() string {
	return tableForm(specs["changePassword"], true)
}

// StaffAssignment renders a staff assignment form with the current staff
// already filled in
func StaffAssignment(staff [3][]string) string {
	var specs [3]inputSpec
	for i, id := range [3]string{"owners", "moderators", "janitors"} {
		sort.Strings(staff[i])
		specs[i] = inputSpec{
			ID:   id,
			Type: _array,
			Val:  staff[i],
		}
	}

	return tableForm(specs[:], true)
}
