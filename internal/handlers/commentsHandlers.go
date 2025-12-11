package handlers

import (
	"encoding/json"
	authutils "forum/internal/authUtils"
	"forum/internal/database"
	"net/http"
)

func CommentsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	payload := authutils.GetJWTFromContext(r.Context())
	if payload == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var comment struct {
		PostID  int    `json:"post_id"`
		Content string `json:"content"`
	}

	if err := json.NewDecoder(r.Body).Decode(&comment); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if comment.Content == "" || comment.PostID == 0 {
		http.Error(w, "Missing fields", http.StatusBadRequest)
		return
	}

	err := database.InsertComment(payload.UserID, comment.PostID, comment.Content)
	if err != nil {
		http.Error(w, "Failed to save comment", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}
