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

type profileUpdateErrorResponse struct {
	Error string `json:"error"`
}

type profileUpdateSuccessResponse struct {
	Username   string `json:"username"`
	Bio        string `json:"bio"`
	AvatarSeed string `json:"avatarSeed"`
}

func writeProfileError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(profileUpdateErrorResponse{Error: msg})
}

func UpdateProfileHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeProfileError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	payload := authutils.GetJWTFromContext(r.Context())
	if payload == nil || payload.Role == authutils.RoleAnonymous {
		writeProfileError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req ProfileUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeProfileError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}

	// Basic validation
	if len(req.Username) < 3 || len(req.Username) > 20 {
		writeProfileError(w, http.StatusBadRequest, "Username must be 3–20 characters")
		return
	}

	// Persist changes
	if err := database.ChangeUserDataFromDb(
		payload.Username,
		req.Username,
		req.Bio,
		req.AvatarSeed,
	); err != nil {
		writeProfileError(w, http.StatusInternalServerError, "Update failed")
		return
	}

	// Expire old tokens
	authutils.ExpireTokens(w, r)

	// Generate new tokens with updated bio/avatar
	authutils.CreateTokens(
		w,
		req.Username,
		payload.Role,
		req.Bio,
		req.AvatarSeed,
		payload.UserID,
	)

	// Return JSON so SPA can optionally use it
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(profileUpdateSuccessResponse{
		Username:   req.Username,
		Bio:        req.Bio,
		AvatarSeed: req.AvatarSeed,
	})
}
