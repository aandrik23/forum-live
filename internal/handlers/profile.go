package handlers

import (
	"fmt"
	authutils "forum/internal/authUtils"
	"forum/internal/database"
	"net/http"
)

func ProfileHandler(w http.ResponseWriter, r *http.Request) {
	payload := authutils.GetJWTFromContext(r.Context())

	data := PageData{}

	if payload != nil && payload.Role != authutils.RoleAnonymous {
		data.Username = payload.Username
		data.Role = payload.Role
		data.User = true
		data.Bio = payload.Bio
		data.Avatar = payload.Avatar
	}

	posts, err := database.GetPostsByAuthorID(payload.UserID)

	if len(posts) > 2 {
		posts = posts[:2]
	}
	data.Posts = posts

	data.Posts = posts

	stats, err := database.GetUserStats(payload.UserID)

	if err != nil {
		http.Error(w, "Failed to load user stats", http.StatusInternalServerError)
		return

	}
	data.Stats = stats

	categories, err := database.GetAllCategories()
	if err != nil {
		http.Error(w, "Unable to load categories", http.StatusInternalServerError)
		return
	}
	data.Categories = categories

	fmt.Println("Rendering profile for", payload.Username, "with avatar:", payload.Avatar)

	renderTemplate(w, "profile", data)
}
