// Package config stores and exports the configuration for server-side use and
// the public availability JSON struct, which includes a small subset of the
// server configuration.
package config

import (
	"reflect"
	"sort"
	"sync"

	"meguca/common"
)

var (
	// Ensures no reads happen, while the configuration is reloading
	globalMu, boardMu sync.RWMutex

	// Contains currently loaded global server configuration
	global *ServerConfig

	// Map of board IDs to their configuration structs
	boardConfigs = map[string]BoardConfContainer{}

	// Configurations for the /all/ metaboard.
	AllBoardConfig = BoardConfContainer{
		BoardConfig: BoardConfig{
			ID: "all",
		},
	}

	// JSON of client-accessible configuration
	clientJSON []byte

	// Defaults contains the default server configuration values
	Defaults = ServerConfig{
		ServerPublic: ServerPublic{
			DisableUserBoards: true,
			MaxSize:           common.DefaultMaxSize,
			MaxFiles:          common.DefaultMaxFiles,
			DefaultLang:       common.DefaultLang,
			DefaultCSS:        common.DefaultCSS,
		},
	}
)

func init() {
	var err error
	AllBoardConfig.JSON, err = AllBoardConfig.BoardPublic.Marshal()
	if err != nil {
		panic(err)
	}
}

func Get() *ServerConfig {
	globalMu.RLock()
	defer globalMu.RUnlock()
	return global
}

func Set(c ServerConfig) error {
	client, err := c.ServerPublic.Marshal()
	if err != nil {
		return err
	}
	globalMu.Lock()
	clientJSON = client
	global = &c
	globalMu.Unlock()
	return nil
}

// GetClient returns public availability configuration JSON.
func GetClient() []byte {
	return clientJSON
}

// Return board configurations for a board combined with pregenerated
// public JSON.
func GetBoardConfig(b string) BoardConfContainer {
	if b == "all" {
		return AllBoardConfig
	}
	boardMu.RLock()
	defer boardMu.RUnlock()
	return boardConfigs[b]
}

// Return configurations for all boards.
func GetBoardConfigs() []BoardConfContainer {
	boardMu.RLock()
	defer boardMu.RUnlock()

	conf := make([]BoardConfContainer, 0, len(boardConfigs))
	for _, c := range boardConfigs {
		conf = append(conf, c)
	}
	return conf
}

// GetBoardTitles returns a slice of all existing boards and their titles
func GetBoardTitles() BoardTitles {
	boardMu.RLock()
	defer boardMu.RUnlock()

	bt := make(BoardTitles, 0, len(boardConfigs))
	for id, conf := range boardConfigs {
		if conf.ModOnly {
			continue
		}
		bt = append(bt, BoardTitle{
			ID:    id,
			Title: conf.Title,
		})
	}

	sort.Sort(bt)
	return bt
}

func GetBoardTitlesByList(boards []string) BoardTitles {
	boardMu.RLock()
	defer boardMu.RUnlock()

	bt := make(BoardTitles, 0, len(boards))
	for _, id := range boards {
		conf, ok := boardConfigs[id]
		if ok {
			bt = append(bt, BoardTitle{
				ID:    id,
				Title: conf.Title,
			})
		}
	}

	sort.Sort(bt)
	return bt
}

// GetBoards returns an array of currently existing boards
func GetBoards() []string {
	boardMu.RLock()
	defer boardMu.RUnlock()
	boards := make([]string, 0, len(boardConfigs))
	for b := range boardConfigs {
		boards = append(boards, b)
	}
	sort.Strings(boards)
	return boards
}

// IsBoard returns whether the passed string is a currently existing board
func IsBoard(b string) bool {
	boardMu.RLock()
	defer boardMu.RUnlock()
	_, ok := boardConfigs[b]
	return ok
}

func IsServeBoard(b string) bool {
	return b == "all" || IsBoard(b)
}

func IsReadOnlyBoard(b string) bool {
	boardMu.RLock()
	defer boardMu.RUnlock()
	conf, ok := boardConfigs[b]
	return ok && conf.ReadOnly
}

func IsModOnlyBoard(b string) bool {
	boardMu.RLock()
	defer boardMu.RUnlock()
	conf, ok := boardConfigs[b]
	return ok && conf.ModOnly
}

// Set configurations for a specific board as well as pregenerate its
// public JSON. Return if any changes were made to the configs.
func SetBoardConfig(conf BoardConfig) (bool, error) {
	cont := BoardConfContainer{
		BoardConfig: conf,
	}
	var err error
	cont.JSON, err = conf.BoardPublic.Marshal()
	if err != nil {
		return false, err
	}

	boardMu.Lock()
	defer boardMu.Unlock()

	// Nothing changed
	noChange := reflect.DeepEqual(
		boardConfigs[conf.ID].BoardConfig,
		cont.BoardConfig,
	)
	if noChange {
		return false, nil
	}

	// Swap config
	boardConfigs[conf.ID] = cont
	return true, nil
}

// RemoveBoard removes a board from the exiting board list and deletes its
// configurations. To be called, when a board is deleted.
func RemoveBoard(b string) {
	boardMu.Lock()
	defer boardMu.Unlock()
	delete(boardConfigs, b)
}
