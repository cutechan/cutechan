package websockets

import (
	"github.com/cutechan/cutechan/go/common"
	"github.com/cutechan/cutechan/go/config"
	"github.com/cutechan/cutechan/go/db"
	"github.com/cutechan/cutechan/go/feeds"
	. "github.com/cutechan/cutechan/go/test"
	"strconv"
	"testing"
	"time"
)

var (
	// JPEG sample image standard struct
	stdJPEG = common.ImageCommon{
		SHA1:     "012a2f912c9ee93ceb0ccb8684a29ec571990a94",
		FileType: 0,
		Dims:     [4]uint16{1, 1, 1, 1},
		MD5:      "YOQQklgfezKbBXuEAsqopw",
		Size:     300792,
	}
)

func TestInsertThread(t *testing.T) {
	assertTableClear(t, "boards", "images")
	if err := db.SetPostCounter(5); err != nil {
		t.Fatal(err)
	}

	conf := [...]db.BoardConfigs{
		{
			BoardConfigs: config.BoardConfigs{
				ID: "c",
			},
		},
		{
			BoardConfigs: config.BoardConfigs{
				ID: "r",
				BoardPublic: config.BoardPublic{
					Title: "123",
				},
			},
		},
	}
	for _, c := range conf {
		if _, err := config.SetBoardConfigs(c.BoardConfigs); err != nil {
			t.Fatal(err)
		}
		if err := db.WriteBoard(nil, c); err != nil {
			t.Fatal(err)
		}
	}

	cases := [...]struct {
		name, board string
		err         error
	}{
		{"invalid board", "all", errInvalidBoard},
		{"invalid board", "x", errInvalidBoard},
	}

	for i := range cases {
		c := cases[i]
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()

			req := ThreadCreationRequest{
				Board: c.board,
			}
			if _, err := CreateThread(req, ""); err != c.err {
				UnexpectedError(t, err)
			}
		})
	}

	t.Run("with image", testCreateThread)
}

func testCreateThread(t *testing.T) {
	writeSampleImage(t)
	token, err := db.NewImageToken(stdJPEG.SHA1)
	if err != nil {
		t.Fatal(err)
	}

	std := common.Thread{
		Board:    "c",
		Subject:  "subject",
		ImageCtr: 1,
		PostCtr:  1,
		Post: common.Post{
			ID:   6,
			Name: "name",
			Image: &common.Image{
				Spoiler:     true,
				ImageCommon: stdJPEG,
				Name:        "foo",
			},
		},
		Posts: []common.Post{},
	}

	req := ThreadCreationRequest{
		ReplyCreationRequest: ReplyCreationRequest{
			Name:     "name",
			Password: "123",
			Image: ImageRequest{
				Name:    "foo.jpeg",
				Token:   token,
				Spoiler: true,
			},
		},
		Subject: "subject",
		Board:   "c",
	}
	if _, err := CreateThread(req, "::1"); err != nil {
		t.Fatal(err)
	}

	thread, err := db.GetThread(6, 0)
	if err != nil {
		t.Fatal(err)
	}

	// Pointers have to be dereferenced to be asserted
	AssertDeepEquals(t, *thread.Image, *std.Image)

	// Normalize timestamps and pointer fields
	then := thread.ReplyTime
	std.ReplyTime = then
	std.BumpTime = then
	std.Time = then
	std.Image = thread.Image

	AssertDeepEquals(t, thread, std)
}

func setBoardConfigs(t testing.TB) {
	config.ClearBoards()
	_, err := config.SetBoardConfigs(config.BoardConfigs{
		ID: "a",
	})
	if err != nil {
		t.Fatal(err)
	}
}

func assertIP(t *testing.T, id uint64, ip string) {
	res, err := db.GetIP(id)
	if err != nil {
		t.Fatal(err)
	}
	AssertDeepEquals(t, res, ip)
}

func TestGetInvalidImage(t *testing.T) {
	assertTableClear(t, "images")

	const (
		name  = "foo.jpeg"
		token = "dasdasd-ad--dsad-ads-d-ad-"
	)

	cases := [...]struct {
		testName, token, name string
		err                   error
	}{
		{"token too long", GenString(128), name, errInvalidImageToken},
		{"image name too long", token, GenString(201), errImageNameTooLong},
		{"no token in DB", token, name, errInvalidImageToken},
	}

	for i := range cases {
		c := cases[i]
		t.Run(c.testName, func(t *testing.T) {
			t.Parallel()
			if _, err := getImage(c.token, c.name, false); err != c.err {
				UnexpectedError(t, err)
			}
		})
	}
}

func TestClosePreviousPostOnCreation(t *testing.T) {
	feeds.Clear()
	assertTableClear(t, "boards")
	writeSampleBoard(t)
	writeSampleThread(t)
	writeSamplePost(t)
	if err := db.SetPostCounter(5); err != nil {
		t.Fatal(err)
	}
	setBoardConfigs(t)

	sv := newWSServer(t)
	defer sv.Close()
	cl, wcl := sv.NewClient()
	registerClient(t, cl, 1, "a")
	cl.post = openPost{
		id:    2,
		op:    1,
		len:   3,
		board: "a",
		time:  time.Now().Unix(),
		body:  []byte("abc"),
	}
	data := marshalJSON(t, ReplyCreationRequest{
		Name:     "name",
		Body:     "foo",
		Password: "123",
	})

	if err := cl.insertPost(data); err != nil {
		t.Fatal(err)
	}

	assertMessage(t, wcl, `326`)
	assertPostClosed(t, 2)
}

func TestPostCreationValidations(t *testing.T) {
	setBoardConfigs(t)

	sv := newWSServer(t)
	defer sv.Close()
	cl, _ := sv.NewClient()
	registerClient(t, cl, 1, "a")

	cases := [...]struct {
		testName, token, name string
	}{
		{"no token", "", "abc"},
		{"no image name", "abc", ""},
	}

	for i := range cases {
		c := cases[i]
		t.Run(c.testName, func(t *testing.T) {
			t.Parallel()

			req := ReplyCreationRequest{
				Image: ImageRequest{
					Name:  c.name,
					Token: c.token,
				},
			}
			err := cl.insertPost(marshalJSON(t, req))
			if err != errNoTextOrImage {
				UnexpectedError(t, err)
			}
		})
	}
}

func TestPostCreation(t *testing.T) {
	feeds.Clear()
	prepareForPostCreation(t)
	setBoardConfigs(t)
	writeSampleImage(t)
	token, err := db.NewImageToken(stdJPEG.SHA1)
	if err != nil {
		t.Fatal(err)
	}

	sv := newWSServer(t)
	defer sv.Close()
	cl, wcl := sv.NewClient()
	cl.ip = "::1"
	registerClient(t, cl, 1, "a")
	defer cl.Close(nil)

	req := ReplyCreationRequest{
		Open:     true,
		Body:     "Δ",
		Password: "123",
		Image: ImageRequest{
			Name:    "foo.jpeg",
			Token:   token,
			Spoiler: true,
		},
	}

	if err := cl.insertPost(marshalJSON(t, req)); err != nil {
		t.Fatal(err)
	}

	assertMessage(t, wcl, encodeMessageType(common.MessagePostID)+"6")

	stdPost := common.StandalonePost{
		Post: common.Post{
			Editing: true,
			ID:      6,
			Body:    "Δ",
			Image: &common.Image{
				Name:        "foo",
				Spoiler:     true,
				ImageCommon: stdJPEG,
			},
		},
		OP:    1,
		Board: "a",
	}

	post, err := db.GetPost(6)
	if err != nil {
		t.Fatal(err)
	}
	AssertDeepEquals(t, *post.Image, *stdPost.Image)
	stdPost.Image = post.Image
	stdPost.Time = post.Time
	AssertDeepEquals(t, post, stdPost)

	assertIP(t, 6, "::1")

	thread, err := db.GetThread(1, 0)
	if err != nil {
		t.Fatal(err)
	}
	AssertDeepEquals(t, thread.PostCtr, uint32(1))
	AssertDeepEquals(t, thread.ImageCtr, uint32(2))

	AssertDeepEquals(t, cl.post, openPost{
		id:          6,
		op:          1,
		time:        stdPost.Time,
		board:       "a",
		len:         1,
		hasImage:    true,
		isSpoilered: true,
		body:        []byte("Δ"),
	})
}

func registerClient(t testing.TB, cl *Client, id uint64, board string) {
	var err error
	cl.feed, err = feeds.SyncClient(cl, id, board)
	if err != nil {
		t.Fatal(err)
	}
}

func encodeMessageType(typ common.MessageType) string {
	return strconv.Itoa(int(typ))
}

func prepareForPostCreation(t testing.TB) {
	assertTableClear(t, "boards", "images")
	writeSampleBoard(t)
	writeSampleThread(t)
	if err := db.SetPostCounter(5); err != nil {
		t.Fatal(err)
	}
}

func writeSampleBoard(t testing.TB) {
	b := db.BoardConfigs{
		BoardConfigs: config.BoardConfigs{
			ID: "a",
		},
	}
	if err := db.WriteBoard(nil, b); err != nil {
		t.Fatal(err)
	}
}

func writeSampleThread(t testing.TB) {
	now := time.Now().Unix()
	thread := db.Thread{
		ID:        1,
		Board:     "a",
		PostCtr:   0,
		ImageCtr:  1,
		ReplyTime: now,
	}
	op := db.Post{
		StandalonePost: common.StandalonePost{
			Post: common.Post{
				ID:   1,
				Time: time.Now().Unix(),
			},
			OP: 1,
		},
	}
	if err := db.WriteThread(nil, thread, op); err != nil {
		t.Fatal(err)
	}
}

func BenchmarkPostCreation(b *testing.B) {
	feeds.Clear()
	prepareForPostCreation(b)
	setBoardConfigs(b)

	sv := newWSServer(b)
	defer sv.Close()
	cl, _ := sv.NewClient()
	registerClient(b, cl, 1, "a")
	defer cl.Close(nil)

	req := ReplyCreationRequest{
		Body:     "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
		Password: "123",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if err := cl.insertPost(marshalJSON(b, req)); err != nil {
			b.Fatal(err)
		}
		if err := cl.closePost(); err != nil {
			b.Fatal(err)
		}
	}
}
