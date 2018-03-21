package server

import (
	"meguca/websockets"
	"mime"
	"net/http"

	"github.com/dimfeld/httptreemux"
)

func Start(address string) (err error) {
	router := createRouter()
	return http.ListenAndServe(address, router)
}

func createRouter() http.Handler {
	r := httptreemux.NewContextMux()
	r.NotFoundHandler = serve404
	r.PanicHandler = text500

	// HTML.
	r.GET("/404.html", serve404)
	r.GET("/", serveLanding)
	r.GET("/stickers/", serveStickers)
	r.GET("/:board/", func(w http.ResponseWriter, r *http.Request) {
		boardHTML(w, r, extractParam(r, "board"), false)
	})
	r.GET("/:board/catalog", func(w http.ResponseWriter, r *http.Request) {
		boardHTML(w, r, extractParam(r, "board"), true)
	})
	// Needs override, because it conflicts with crossRedirect
	r.GET("/all/catalog", func(w http.ResponseWriter, r *http.Request) {
		// Artificially set board to "all"
		boardHTML(w, r, "all", true)
	})
	r.GET("/:board/:thread", threadHTML)
	r.GET("/all/:id", crossRedirect)

	// HTML partials.
	// TODO(Kagami): Remove.
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

	// JSON API.
	api := r.NewGroup("/api")
	api.GET("/socket", websockets.Handler)
	api.GET("/embed", serveEmbed)
	api.GET("/profiles", serveProfiles)
	api.GET("/idols/:id/preview", serveIdolPreview)
	api.GET("/idols/:id/preview/small", serveSmallIdolPreview)
	// TODO(Kagmi): Should be plural.
	api.GET("/post/:post", servePost)
	api.POST("/post/token", createPostToken)
	api.POST("/thread", createThread)
	api.POST("/post", createPost)
	api.POST("/register", register)
	api.POST("/login", login)
	api.POST("/logout", logout)
	api.POST("/logout/all", logoutAll)
	// TODO(Kagami): RESTify.
	api.POST("/change-password", changePassword)
	api.POST("/board-config/:board", servePrivateBoardConfigs)
	api.POST("/configure-board/:board", configureBoard)
	// api.POST("/config", servePrivateServerConfigs)
	api.POST("/configure-server", configureServer)
	api.POST("/create-board", createBoard)
	// api.POST("/delete-board", deleteBoard)
	api.POST("/delete-post", deletePost)
	api.POST("/ban", ban)
	api.POST("/unban/:board", unban)
	api.POST("/assign-staff", assignStaff)
	// api.POST("/notification", sendNotification)
	// api.POST("/same-IP/:id", getSameIPPosts)
	// api.POST("/sticky", setThreadSticky)
	// TODO(Kagami): Rework and move to /api.
	// json := r.NewGroup("/json")
	// boards := json.NewGroup("/boards")
	// boards.GET("/:board/", func(w http.ResponseWriter, r *http.Request) {
	// 	boardJSON(w, r, false)
	// })
	// boards.GET("/:board/catalog", func(w http.ResponseWriter, r *http.Request) {
	// 	boardJSON(w, r, true)
	// })
	// boards.GET("/:board/:thread", threadJSON)
	// json.GET("/config", serveConfigs)
	// json.GET("/extensions", serveExtensionMap)
	// json.GET("/board-config/:board", serveBoardConfigs)
	// json.GET("/board-list", serveBoardList)

	// Assets.
	r.GET("/uploads/*path", serveImages)
	r.GET("/static/*path", serveStatic)
	// Not yet in /etc/mime.types
	mime.AddExtensionType(".wasm", "application/wasm")

	h := http.Handler(r)
	return h
}
