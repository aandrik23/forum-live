package handlers

import (
	"encoding/json"
	authutils "forum/internal/authUtils"
	"forum/internal/database"
	"net/http"
)

type ProfileUpdateRequest struct {
	Username   string `json:"username"`
	Bio        string `json:"bio"`
	AvatarSeed string `json:"avatarSeed"`
}

func UpdateProfileHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	payload := authutils.GetJWTFromContext(r.Context())
	if payload == nil || payload.Role == authutils.RoleAnonymous {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var data struct {
		Username string `json:"username"`
		Bio      string `json:"bio"`
		Avatar   string `json:"avatarSeed"`
	}
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if len(data.Username) < 3 || len(data.Username) > 20 {
		http.Error(w, "Username must be 3-20 characters", http.StatusBadRequest)
		return
	}

	if err := database.ChangeUserDataFromDb(payload.Username, data.Username, data.Bio, data.Avatar); err != nil {
		http.Error(w, "Update failed", http.StatusInternalServerError)
		return
	}

	// Expire old tokens
	authutils.ExpireTokens(w, r)

	// Generate new tokens with updated bio/avatar
	authutils.CreateTokens(w, data.Username, payload.Role, data.Bio, data.Avatar, payload.UserID)

	w.WriteHeader(http.StatusOK)
}
