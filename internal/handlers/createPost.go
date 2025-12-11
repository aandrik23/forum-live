package handlers

import (
	authutils "forum/internal/authUtils"
	"forum/internal/database"
	"forum/internal/models"
	"net/http"
	"strconv"
	"strings"
	"time"
)

func CreateHandler(w http.ResponseWriter, r *http.Request) {
	payload := authutils.GetJWTFromContext(r.Context())

	if r.Method == http.MethodGet {
		// Load categories from DB
		categories, err := database.GetAllCategories()
		if err != nil {
			http.Error(w, "Unable to load categories", http.StatusInternalServerError)
			return
		}

		// Use your common PageData so base.html works
		data := PageData{}
		if payload != nil && payload.Role != authutils.RoleAnonymous {
			data.Username = payload.Username
			data.Role = payload.Role
			data.User = true
		}
		data.Categories = categories

		// Support partials for SPA
		if r.URL.Query().Get("partial") == "1" {
			renderTemplate(w, "post_create_content", data)
			return
		}

		renderTemplate(w, "post_create", data)
		return
	}

	if r.Method == http.MethodPost {
		if err := r.ParseForm(); err != nil {
			http.Error(w, "Invalid Data", http.StatusBadRequest)
			return
		}

		if payload == nil || payload.Role == authutils.RoleAnonymous {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		title := strings.TrimSpace(r.FormValue("title"))
		content := strings.TrimSpace(r.FormValue("content"))
		categoryIDs := r.Form["categories"]
		author := payload.UserID

		if title == "" || content == "" {
			http.Error(w, "Missing fields", http.StatusBadRequest)
			return
		}

		// Convert []string to []models.Category
		var categories []models.Category
		for _, idStr := range categoryIDs {
			id, err := strconv.Atoi(idStr)
			if err != nil {
				http.Error(w, "Invalid category ID", http.StatusBadRequest)
				return
			}
			categories = append(categories, models.Category{ID: id})
		}

		post := models.Post{
			Title:      title,
			Content:    content,
			Categories: categories,
			AuthorID:   author,
			CreatedAt:  time.Now(),
		}

		if err := database.InsertPostWithCategories(post); err != nil {
			http.Error(w, "Failed to save post: "+err.Error(), http.StatusInternalServerError)
			return
		}

		// For now: regular redirect, SPA JS can still navigate back to home
		http.Redirect(w, r, "/", http.StatusSeeOther)
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}
