package server

import (
	"mime"
	"net/http"
	"net/http/pprof"
	"runtime/debug"
	"time"

	"meguca/file"
	"meguca/websockets"

	"github.com/dimfeld/httptreemux"
)

type Config struct {
	DebugRoutes  bool
	Address      string
	SecureCookie bool
	ThumbUser    string
	SiteDir      string
	IdolOrigin   string
}

var (
	secureCookie bool
	idolOrigin   string
)

func Start(conf Config) (err error) {
	// TODO(Kagami): Use config structs instead of globals.
	secureCookie = conf.SecureCookie
	idolOrigin = conf.IdolOrigin

	startThumbWorkers(conf.ThumbUser)
	router := createRouter(conf)
	go runForceFreeTask()
	return http.ListenAndServe(conf.Address, router)
}

// If user uploads large file (40MB max by default), Go consumes quite a
// lot of memory for temporal allocations (~200MB), releasing it
// (obviously) a bit later. Unfortunately it doesn't hurry to return it
// back to the OS, see:
// https://github.com/golang/go/blob/go1.10/src/runtime/proc.go#L4191-L4193
// See also detailed description: https://stackoverflow.com/a/14586361
//
// Here we force it to free memory much quicker in order to make it
// available to other applications on the same machine (e.g. database
// cache, file cache). This is especially useful in case of low memory
// VPS servers.
func runForceFreeTask() {
	for {
		time.Sleep(time.Minute * 5)
		debug.FreeOSMemory()
	}
}

func createRouter(conf Config) http.Handler {
	r := httptreemux.NewContextMux()
	r.NotFoundHandler = serve404
	r.PanicHandler = text500

	// Make sure to control access in production.
	if conf.DebugRoutes {
		r.Handle("GET", "/debug/pprof/*", pprof.Index)
	}

	// Pages.
	r.GET("/", serveLanding)
	r.GET("/404.html", serve404)
	r.GET("/stickers/", serveStickers)
	r.GET("/:board/", func(w http.ResponseWriter, r *http.Request) {
		boardHTML(w, r, getParam(r, "board"), false)
	})
	r.GET("/:board/:thread", threadHTML)
	r.GET("/:board/catalog", func(w http.ResponseWriter, r *http.Request) {
		boardHTML(w, r, getParam(r, "board"), true)
	})
	r.GET("/all/:id", crossRedirect)
	r.GET("/all/catalog", func(w http.ResponseWriter, r *http.Request) {
		boardHTML(w, r, "all", true)
	})
	r.GET("/admin/", assertBoardOwner(serveAdmin))
	// Exactly same route, will handle board ID on JS side.
	r.GET("/admin/:board", assertBoardOwner(serveAdmin))

	// Assets.
	r.GET("/static/*path", func(w http.ResponseWriter, r *http.Request) {
		serveFile(w, r, cleanJoin(conf.SiteDir, "static", getParam(r, "path")))
	})
	if file.Backend.IsServable() {
		r.GET(file.DefaultUploadsPath+"*path", file.Backend.Serve)
	}
	// Not yet in /etc/mime.types
	mime.AddExtensionType(".wasm", "application/wasm")

	// JSON API.
	// TODO(Kagami): RESTify.
	api := r.NewGroup("/api")
	// Common.
	api.GET("/socket", websockets.Handler)
	api.GET("/embed", serveEmbed)
	// Idols.
	api.GET("/idols/profiles", serveIdolProfiles)
	api.POST("/idols/recognize", serveIdolRecognize)
	api.POST("/idols/:id/preview", serveSetIdolPreview)
	api.GET("/idols/by-image/:id", serveImageInfo)
	// Posts.
	api.GET("/post/:post", servePost)
	api.POST("/post/token", createPostToken)
	api.POST("/post", createPost)
	api.POST("/thread", createThread)
	// Account.
	api.POST("/register", register)
	api.POST("/login", login)
	api.POST("/change-password", changePassword)
	api.POST("/account/settings", serverSetAccountSettings)
	api.POST("/logout", logout)
	api.POST("/logout/all", logoutAll)
	// Mod.
	api.POST("/ban", ban)
	api.POST("/unban/:board", unban)
	api.POST("/delete-post", deletePost)
	api.PUT("/boards/:board", assertBoardOwnerAPI(configureBoard))
	// Admin.
	api.POST("/create-board", createBoard)
	// Too dangerous.
	// api.POST("/delete-board", deleteBoard)
	api.POST("/configure-server", configureServer)

	// Partials.
	// TODO(Kagami): Rewrite client to JSON API.
	html := r.NewGroup("/html")
	html.GET("/change-password", changePasswordForm)
	html.GET("/create-board", boardCreationForm)
	html.POST("/configure-server", serverConfigurationForm)

	h := http.Handler(r)
	return h
}
