// Post commands routines.

package common

import (
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/mailru/easyjson/jwriter"
)

type CommandType uint8

const (
	Dice CommandType = iota
)

// Command contains the type and value array of commands, such as dice
// rolls. The val field depends on the type field.
type Command struct {
	Type CommandType
	Dice []uint16
}

// Defined manually to dynamically marshal the appropriate fields by
// struct type.
func (c Command) MarshalEasyJSON(w *jwriter.Writer) {
	w.RawString(`{"type":`)
	w.Uint8(uint8(c.Type))
	w.RawString(`,"val":`)

	switch c.Type {
	case Dice:
		w.RawByte('[')
		for i, v := range c.Dice {
			if i != 0 {
				w.RawByte(',')
			}
			w.Uint16(v)
		}
		w.RawByte(']')
	}

	w.RawByte('}')
}

func (c Command) MarshalJSON() ([]byte, error) {
	var w jwriter.Writer
	c.MarshalEasyJSON(&w)
	return w.Buffer.BuildBytes(), w.Error
}

// Decode a dynamically-typed JSON-encoded command into the
// statically-typed Command struct.
func (c *Command) UnmarshalJSON(data []byte) error {
	if len(data) < 18 {
		return fmt.Errorf("data too short: %s", string(data))
	}

	typ, err := strconv.ParseUint(string(data[8]), 10, 8)
	if err != nil {
		return err
	}

	data = data[16 : len(data)-1]
	switch CommandType(typ) {
	case Dice:
		c.Type = Dice
		err = json.Unmarshal(data, &c.Dice)
	default:
		return fmt.Errorf("unknown command type: %d", typ)
	}
	return err
}
