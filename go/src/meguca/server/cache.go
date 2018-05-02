package server

import (
	"net/http"
	"strconv"

	"meguca/cache"
	"meguca/common"
	"meguca/db"
	"meguca/lang"
	"meguca/templates"
)

var threadCache = cache.FrontEnd{
	GetCounter: func(k cache.Key) (uint64, error) {
		return db.ThreadCounter(k.ID)
	},

	GetFresh: func(k cache.Key) (interface{}, error) {
		return db.GetThread(k.ID, k.LastN)
	},

	RenderHTML: func(data interface{}, json []byte, k cache.Key) []byte {
		last100 := k.LastN == common.NumPostsOnRequest
		return []byte(templates.ThreadPosts(k.Lang, data.(common.Thread), json, last100))
	},
}

var catalogCache = cache.FrontEnd{
	GetCounter: func(k cache.Key) (uint64, error) {
		if k.Board == "all" {
			return db.AllBoardCounter()
		}
		return db.BoardCounter(k.Board)
	},

	GetFresh: func(k cache.Key) (interface{}, error) {
		if k.Board == "all" {
			return db.GetAllBoardCatalog()
		}
		return db.GetBoardCatalog(k.Board)
	},

	RenderHTML: func(data interface{}, json []byte, k cache.Key) []byte {
		all := k.Board == "all"
		return []byte(templates.CatalogThreads(data.(common.Board), json, all))
	},
}

type boardPage struct {
	pageN     int
	pageTotal int
	json      []byte
	data      common.Board
}

var boardPageCache = cache.FrontEnd{
	GetCounter: func(k cache.Key) (uint64, error) {
		if k.Board == "all" {
			return db.AllBoardCounter()
		}
		return db.BoardCounter(k.Board)
	},

	GetFresh: func(k cache.Key) (data interface{}, err error) {
		var ids []uint64
		if k.Board == "all" {
			ids, err = db.GetAllThreadsIDs()
		} else {
			ids, err = db.GetThreadIDs(k.Board)
		}
		if err != nil {
			return
		}

		totalPages := (len(ids)-1)/common.ThreadsPerPage + 1
		atLastPage := k.Page+1 == totalPages
		if totalPages == 0 {
			data = boardPage{json: []byte("[]")}
			return
		}
		if k.Page+1 > totalPages {
			err = errPageOverflow
			return
		}

		page := boardPage{
			pageN:     k.Page,
			pageTotal: totalPages,
			json:      []byte("["),
		}
		lowIdx := k.Page * common.ThreadsPerPage
		highIdx := (k.Page + 1) * common.ThreadsPerPage
		if atLastPage {
			highIdx = len(ids)
		}
		pageIDs := ids[lowIdx:highIdx]
		for i, id := range pageIDs {
			k := cache.ThreadKey(k.Lang, id, common.NumPostsAtIndex)
			tjson, tdata, _, terr := cache.GetJSONAndData(k, threadCache)
			if terr != nil {
				return nil, terr
			}
			if i > 0 {
				page.json = append(page.json, ',')
			}
			page.json = append(page.json, tjson...)
			page.data = append(page.data, tdata.(common.Thread))
		}
		page.json = append(page.json, ']')
		return page, nil
	},

	EncodeJSON: func(data interface{}) ([]byte, error) {
		return data.(boardPage).json, nil
	},

	RenderHTML: func(data interface{}, json []byte, k cache.Key) []byte {
		all := k.Board == "all"
		return []byte(templates.IndexThreads(k.Lang, data.(boardPage).data, json, all))
	},
}

// Returns arguments for accessing the board page JSON/HTML cache
func boardCacheArgs(r *http.Request, board string, catalog bool) (
	k cache.Key, f cache.FrontEnd,
) {
	page := 0
	// TODO(Kagami): Make catalogs paginated too.
	if !catalog {
		pStr := r.URL.Query().Get("page")
		if p, err := strconv.ParseUint(pStr, 10, 64); err == nil {
			page = int(p)
		}
	}
	k = cache.BoardKey(lang.FromReq(r), board, page)
	if catalog {
		f = catalogCache
	} else {
		f = boardPageCache
	}
	return
}
