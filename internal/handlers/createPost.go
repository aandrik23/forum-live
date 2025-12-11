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
		// ✅ Load categories from DB
		categories, err := database.GetAllCategories()
		if err != nil {
			http.Error(w, "Unable to load categories", http.StatusInternalServerError)
			return
		}

		renderTemplate(w, "post_detail", map[string]any{
			"Categories": categories,
			"User":       payload.Username, // or payload.UserID / payload.Username depending on your base.html
		})
		return
	}

	if r.Method == http.MethodPost {
		er := r.ParseForm()

		// payload := authutils.GetJWTFromContext(r.Context())

		if er != nil {
			http.Error(w, "Invalid Data", http.StatusBadRequest)
		}
		title := strings.TrimSpace(r.FormValue("title"))
		content := strings.TrimSpace(r.FormValue("content"))
		categoryIDs := r.Form["categories"]
		author := payload.UserID // Implement based on your session

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

		err := database.InsertPostWithCategories(post)

		if err != nil {
			http.Error(w, "Failed to save post: "+err.Error(), http.StatusInternalServerError)

			return
		}

		http.Redirect(w, r, "/", http.StatusSeeOther)

	}

}
