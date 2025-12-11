package handlers

import (
	"net/http"
	"strings"
)

func PostDetailHandler(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) != 3 || parts[2] == "" {
		http.NotFound(w, r)
		return
	}
	postID := parts[2]
	renderTemplate(w, "post_detail", map[string]string{"PostID": postID})
}
