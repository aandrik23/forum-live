package handlers

import "net/http"

// NotFoundHandler renders your custom 404 page.
func NotFoundHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusNotFound)
	renderTemplate(w, "404", nil)
}
