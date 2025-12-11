package internal

import (
	"fmt"
	authutils "forum/internal/authUtils"
	"forum/internal/handlers"
	"net/http"
)

var rootRoutes = map[string]http.HandlerFunc{
	"/":     homeHandler,
	"/home": homeHandler,
}

// rootHandler does map lookup, calls real handler or 404
func rootHandler(w http.ResponseWriter, r *http.Request) {
	if h, ok := rootRoutes[r.URL.Path]; ok {
		h(w, r)
	} else {
		notFoundHandler(w, r)
	}
}

func Handlers() {
	http.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("static"))))

	// Home: allow anon or user, decided inside HomeHandler
	http.HandleFunc("/", authutils.AuthMiddleware(rootHandler))
	http.HandleFunc("/home", authutils.AuthMiddleware(rootHandler))

	// Public
	http.HandleFunc("/register", registerHandler)
	http.HandleFunc("/login", loginHandler)

	// Protected: ONLY logged in users/admins
	http.HandleFunc("/logout",
		authutils.AuthMiddleware(handlers.LogoutHandler))

	http.HandleFunc("/admin",
		authutils.AuthMiddleware(
			authutils.CSRFMiddleware(
				authutils.RequireRoleMiddleware(authutils.RoleAdmin)(adminHandler),
			),
		),
	)

	http.HandleFunc("/post/",
		authutils.AuthMiddleware(
			authutils.CSRFMiddleware(
				authutils.RequireRoleMiddleware(authutils.RoleUser, authutils.RoleAdmin)(postDetailHandler),
			),
		),
	)

	http.HandleFunc("/profile",
		authutils.AuthMiddleware(
			authutils.CSRFMiddleware(
				authutils.RequireRoleMiddleware(authutils.RoleUser, authutils.RoleAdmin)(profileHandler),
			),
		),
	)

	http.HandleFunc("/profile/update",
		authutils.AuthMiddleware(
			authutils.CSRFMiddleware(
				authutils.RequireRoleMiddleware(authutils.RoleUser, authutils.RoleAdmin)(profileUpdateHandler),
			),
		),
	)

	http.HandleFunc("/posts/new",
		authutils.AuthMiddleware(
			authutils.CSRFMiddleware(
				authutils.RequireRoleMiddleware(authutils.RoleUser, authutils.RoleAdmin)(createHandler),
			),
		),
	)

	http.HandleFunc("/posts/react",
		authutils.AuthMiddleware(
			authutils.CSRFMiddleware(
				authutils.RequireRoleMiddleware(authutils.RoleUser, authutils.RoleAdmin)(reactHandler),
			),
		),
	)

	http.HandleFunc("/posts/comments",
		authutils.AuthMiddleware(
			authutils.CSRFMiddleware(
				authutils.RequireRoleMiddleware(authutils.RoleUser, authutils.RoleAdmin)(commentsHandler),
			),
		),
	)

	http.HandleFunc("/posts/delete",
		authutils.AuthMiddleware(
			authutils.CSRFMiddleware(
				authutils.RequireRoleMiddleware(authutils.RoleUser, authutils.RoleAdmin)(deleteHandler),
			),
		),
	)
}

func profileUpdateHandler(w http.ResponseWriter, r *http.Request) {
	handlers.UpdateProfileHandler(w, r)
}

func homeHandler(w http.ResponseWriter, r *http.Request) {
	handlers.HomeHandler(w, r)
}

func loginHandler(w http.ResponseWriter, r *http.Request) {
	handlers.LoginHandler(w, r)
}

func registerHandler(w http.ResponseWriter, r *http.Request) {
	handlers.RegisterHandler(w, r)
}

func profileHandler(w http.ResponseWriter, r *http.Request) {
	handlers.ProfileHandler(w, r)
}

func postDetailHandler(w http.ResponseWriter, r *http.Request) {
	handlers.PostDetailHandler(w, r)
}

func adminHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintln(w, "Welcome to the admin dashboard")
}

func createHandler(w http.ResponseWriter, r *http.Request) {
	handlers.CreateHandler(w, r)
}
func reactHandler(w http.ResponseWriter, r *http.Request) {
	handlers.LikesHandler(w, r)
}

func commentsHandler(w http.ResponseWriter, r *http.Request) {
	handlers.CommentsHandler(w, r)
}

/// ERROR HANDLERS

func notFoundHandler(w http.ResponseWriter, r *http.Request) {
	handlers.NotFoundHandler(w, r)
}

func deleteHandler(w http.ResponseWriter, r *http.Request) {
	handlers.DeleteHandler(w, r)
}
