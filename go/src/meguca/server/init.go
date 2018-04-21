package server

import (
	"meguca/websockets"
	"mime"
	"net/http"
	"net/http/pprof"
	"runtime/debug"
	"time"

	"github.com/dimfeld/httptreemux"
)

func Start(address string, debugRoutes bool) (err error) {
	go runForceFreeTask()
	startThumbWorkers()
	router := createRouter(debugRoutes)
	return http.ListenAndServe(address, router)
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

func createRouter(debugRoutes bool) http.Handler {
	r := httptreemux.NewContextMux()
	r.NotFoundHandler = serve404wr
	r.PanicHandler = text500

	// Make sure to control access in production.
	if debugRoutes {
		r.Handle("GET", "/debug/pprof/*", pprof.Index)
	}

	// Pages.
	r.GET("/", serveLanding)
	r.GET("/404.html", serve404wr)
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

	// Assets.
	r.GET("/static/*path", serveStatic)
	r.GET("/uploads/*path", serveFiles)
	// Not yet in /etc/mime.types
	mime.AddExtensionType(".wasm", "application/wasm")

	// JSON API.
	// TODO(Kagami): RESTify.
	api := r.NewGroup("/api")
	api.GET("/socket", websockets.Handler)
	api.GET("/embed", serveEmbed)
	api.GET("/idols/profiles", serveIdolProfiles)
	api.POST("/idols/recognize", serveIdolRecognize)
	api.POST("/idols/:id/preview", serveSetIdolPreview)
	api.GET("/post/:post", servePost)
	api.POST("/post/token", createPostToken)
	api.POST("/thread", createThread)
	api.POST("/post", createPost)
	api.POST("/register", register)
	api.POST("/login", login)
	api.POST("/logout", logout)
	api.POST("/logout/all", logoutAll)
	api.POST("/change-password", changePassword)
	api.POST("/account/settings", serverSetAccountSettings)
	api.POST("/configure-board/:board", configureBoard)
	api.POST("/configure-server", configureServer)
	api.POST("/create-board", createBoard)
	api.POST("/delete-post", deletePost)
	api.POST("/ban", ban)
	api.POST("/unban/:board", unban)
	api.POST("/assign-staff", assignStaff)
	// NOTE(Kagami): Currently commented because it's too dangerous.
	// api.POST("/delete-board", deleteBoard)

	// Partials.
	// TODO(Kagami): Rewrite client to JSON API.
	html := r.NewGroup("/html")
	// html.GET("/board-navigation", boardNavigation)
	html.GET("/owned-boards", ownedBoardSelection)
	html.GET("/create-board", boardCreationForm)
	html.GET("/change-password", changePasswordForm)
	html.GET("/captcha", renderCaptcha)
	html.POST("/configure-board/:board", boardConfigurationForm)
	html.POST("/configure-server", serverConfigurationForm)
	html.GET("/assign-staff/:board", staffAssignmentForm)
	html.GET("/bans/:board", banList)
	html.GET("/mod-log/:board", modLog)

	h := http.Handler(r)
	return h
}
