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
	// Roll number between X and Y.
	Roll CommandType = iota
	// Flip coin with X% probability.
	Flip
)

type Command struct {
	Type CommandType
	Roll int
	Flip bool
}

// Dynamically marshal the appropriate fields by struct type.
func (c Command) MarshalEasyJSON(w *jwriter.Writer) {
	w.RawString(`{"type":`)
	w.Uint8(uint8(c.Type))
	w.RawString(`,"val":`)

	switch c.Type {
	case Roll:
		w.Int(c.Roll)
	case Flip:
		w.Bool(c.Flip)
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
	case Roll:
		c.Type = Roll
		err = json.Unmarshal(data, &c.Roll)
	case Flip:
		c.Type = Flip
		err = json.Unmarshal(data, &c.Flip)
	default:
		return fmt.Errorf("unknown command type: %d", typ)
	}
	return err
}
