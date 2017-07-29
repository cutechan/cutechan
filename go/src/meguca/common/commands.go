package common

import (
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/mailru/easyjson/jwriter"
)

// CommandType are the various struct types of hash commands and their
// responses, such as dice rolls, #flip, etc.
type CommandType uint8

const (
	// Dice is the dice roll command type
	Dice CommandType = iota

	// Flip is the coin flip command type
	Flip
)

// Command contains the type and value array of hash commands, such as dice
// rolls, #flip, etc. The Val field depends on the Type field.
// Dice: []uint16
// Flip: bool
type Command struct {
	Type      CommandType
	Flip      bool
	Dice      []uint16
}

// MarshalJSON implements json.Marshaler
func (c Command) MarshalJSON() ([]byte, error) {
	var w jwriter.Writer
	c.MarshalEasyJSON(&w)
	return w.Buffer.BuildBytes(), w.Error
}

// MarshalEasyJSON implements easyjson.Marshaler. Defined manually to
// dynamically marshal the appropriate fields by struct type.
func (c Command) MarshalEasyJSON(w *jwriter.Writer) {
	w.RawString(`{"type":`)
	w.Uint8(uint8(c.Type))
	w.RawString(`,"val":`)

	switch c.Type {
	case Flip:
		w.Bool(c.Flip)
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

// UnmarshalJSON decodes a dynamically-typed JSON-encoded command into the
// statically-typed Command struct
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
	case Flip:
		c.Type = Flip
		err = json.Unmarshal(data, &c.Flip)
	case Dice:
		c.Type = Dice
		err = json.Unmarshal(data, &c.Dice)
	default:
		return fmt.Errorf("unknown command type: %d", typ)
	}
	return err
}
