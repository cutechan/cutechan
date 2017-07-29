// Hash commands such as #flip, dice and #8ball

package parser

import (
	"bytes"
	"errors"
	"math/rand"
	"meguca/common"
	"meguca/config"
	"meguca/db"
	"strconv"
	"time"
)

var (
	errTooManyRolls = errors.New("too many rolls")
	errDieTooBig    = errors.New("die too big")
)

func init() {
	rand.Seed(time.Now().UnixNano())
}

// Parse a matched hash command
func parseCommand(match []byte, board string) (com common.Command, err error) {
	switch {

	// Coin flip
	case bytes.Equal(match, []byte("flip")):
		com.Type = common.Flip
		com.Flip = rand.Intn(2) == 0

	// Increment pyu counter
	case bytes.Equal(match, []byte("pyu")):
		if config.Get().Pyu {
			com.Type = common.Pyu
			com.Pyu, err = db.IncrementPyu()
		}

	// Return current pyu count
	case bytes.Equal(match, []byte("pcount")):
		if config.Get().Pyu {
			com.Type = common.Pcount
			com.Pyu, err = db.GetPyu()
		}

	default:
		matchStr := string(match)

		// Dice throw
		com.Type = common.Dice
		com.Dice, err = parseDice(matchStr)
	}

	return
}

// Parse dice throw commands
func parseDice(match string) (val []uint16, err error) {
	dice := common.DiceRegexp.FindStringSubmatch(match)

	var rolls int
	if len(dice[1]) == 0 {
		rolls = 1
	} else {
		rolls, err = strconv.Atoi(string(dice[1]))
		switch {
		case err != nil:
			return
		case rolls > 10:
			return nil, errTooManyRolls
		}
	}

	max, err := strconv.Atoi(string(dice[2]))
	switch {
	case err != nil:
		return
	case max > 100:
		return nil, errDieTooBig
	}

	val = make([]uint16, rolls)
	for i := 0; i < rolls; i++ {
		if max != 0 {
			val[i] = uint16(rand.Intn(max)) + 1
		} else {
			val[i] = 0
		}
	}
	return
}
