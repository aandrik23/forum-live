package handlers

import (
	"encoding/json"
	"fmt"
	authutils "forum/internal/authUtils"
	"forum/internal/database"
	"forum/internal/logger"
	"net/http"
	"strings"
)

func LoginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		return
	}

	if r.Method == http.MethodPost {
		// Parse form values
		err := r.ParseForm()
		if err != nil {
			WriteJSONError(w, "Invalid form data", http.StatusBadRequest)
			return
		}

		email := strings.ToLower(strings.TrimSpace(r.FormValue("email")))
		password := r.FormValue("password")

		username, role, bio, avatar, userID, status, err := database.ValidateCredsByEmail(email, password)
		if err != nil {
			ip := strings.Split(r.RemoteAddr, ":")[0]
			if authutils.TooManyAttempts(ip, email) {
				WriteJSONError(w, "Too many login attempts. Try again later.", http.StatusTooManyRequests)
				logger.Log(fmt.Sprintf("Login rate limit triggered for IP: %s | Email: %s", ip, email), logger.WarnLevel)
				return
			}
			WriteJSONError(w, "Invalid email or password", http.StatusUnauthorized)
			return
		}
		if status == "inactive" {
			err := database.UpdateUserStatus(userID, "active")
			if err != nil {
				WriteJSONError(w, "Unable to update user status", http.StatusInternalServerError)
				return
			}
		} else {
			WriteJSONError(w, "User already logged in", http.StatusInternalServerError)
			return
		}

		// create access tokens for valid user
		authutils.CreateTokens(w, username, role, bio, avatar, userID)
		logger.Log(fmt.Sprintf("User %s logged in with role %s", username, role), logger.InfoLevel)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"redirect": "/home"})
	}
}
