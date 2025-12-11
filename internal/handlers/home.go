package handlers

import (
	authutils "forum/internal/authUtils"
	"forum/internal/database"
	"forum/internal/models"
	"log"
	"net/http"
	"sort"
	"strconv"
)

func HomeHandler(w http.ResponseWriter, r *http.Request) {
	payload := authutils.GetJWTFromContext(r.Context())

	data := PageData{}

	// if payload == nil || payload.Role == authutils.RoleAnonymous {
	// 	renderTemplate(w, "guest", data) // or reuse base with condition
	// 	return
	// }

	if payload != nil && payload.Role != authutils.RoleAnonymous {
		data.Username = payload.Username
		data.Role = payload.Role
		data.User = true
		data.Posts = []models.Post{}
	} else {
		data.User = false
	}
	// Get query params
	filter := r.URL.Query().Get("filter")
	categoryIDStr := r.URL.Query().Get("category")

	var posts []models.Post
	var err error
	if categoryIDStr != "" {
		// Filter posts by category ID
		categoryID, err := strconv.Atoi(categoryIDStr)
		if err != nil {
			http.Error(w, "Invalid category id", http.StatusBadRequest)
			return
		}
		posts, err = database.GetPostsByCategoryID(categoryID)

	} else {
		// Use filter param if no category filter
		switch filter {
		case "created":
			if payload != nil {
				posts, err = database.GetPostsByAuthorID(payload.UserID)
			}
		case "liked":
			if payload != nil {
				posts, err = database.GetLikedPostsByUserID(payload.UserID, "liked")
			}
		case "disliked":
			if payload != nil {
				posts, err = database.GetLikedPostsByUserID(payload.UserID, "disliked")
			}
		default:
			posts, err = database.GetAllPosts()
		}
	}

	if err != nil {
		log.Printf("Error loading posts with filter %q: %v", filter, err)
		http.Error(w, "unable to load posts: "+err.Error(), http.StatusInternalServerError)
		return
	}

	sort.Slice(posts, func(i, j int) bool {
		return posts[i].CreatedAt.After(posts[j].CreatedAt)
	})

	data.Posts = posts

	Categories, err := database.GetAllCategories()

	if err != nil {
		http.Error(w, "unable to load categories", http.StatusInternalServerError)
		return
	}

	data.Categories = Categories

	renderTemplate(w, "home", data)
}
