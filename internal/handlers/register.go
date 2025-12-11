package handlers

import (
	"encoding/json"
	"fmt"
	"forum/internal/database"
	"forum/internal/logger"
	"net/http"
	"net/mail"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

// writeJSONError writes a JSON {"error": "..."} response with the given status code.
func WriteJSONError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

func RegisterHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		return
	}

	if r.Method == http.MethodPost {
		err := r.ParseForm()
		if err != nil {
			WriteJSONError(w, "Invalid form data", http.StatusBadRequest)
			return
		}

		username := r.FormValue("username")
		email := strings.ToLower(strings.TrimSpace(r.FormValue("email")))
		password := r.FormValue("password")
		passwordConfirm := r.FormValue("password2")

		// check for empty inputs
		if strings.Trim(username, " ") == "" || strings.Trim(email, " ") == "" || strings.Trim(password, " ") == "" || strings.Trim(passwordConfirm, " ") == "" {
			WriteJSONError(w, "Username, email and password required", http.StatusBadRequest)
			return
		}

		// password validation
		if password != passwordConfirm {
			WriteJSONError(w, "Passwords don't match", http.StatusBadRequest)
			return
		}

		// email validation
		if validateEmail(email) == false {
			WriteJSONError(w, "Invalid email address", http.StatusBadRequest)
			return
		}

		// Hash password
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			http.Error(w, "Server error", http.StatusInternalServerError)
			return
		}

		err = database.AddUserToDb(username, email, string(hashedPassword), "inactive")

		if err != nil {
			fmt.Println("DB ERROR:", err) // debug
			if err.Error() == "username already exists" {
				WriteJSONError(w, "Username already exists.", http.StatusBadRequest)
				return
			} else if err.Error() == "email already exists" {
				WriteJSONError(w, "Email already exists.", http.StatusBadRequest)
				return
			} else {
				http.Error(w, "Database error", http.StatusInternalServerError)
				return
			}
		}

		logger.Log(fmt.Sprintf("New user registered: %s | email: %s\n", username, email), logger.InfoLevel)
		// on success, you could still redirect, or return JSON with a redirect URL:
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"redirect": "/home"})
	}
}

func validateEmail(email string) bool {
	addr, err := mail.ParseAddress(email)
	if err != nil {
		return false
	}

	parts := strings.Split(addr.Address, "@")
	if len(parts) != 2 {
		return false
	}

	domain := parts[1]
	if !strings.Contains(domain, ".") {
		return false
	}

	tld := domain[strings.LastIndex(domain, ".")+1:]
	if len(tld) < 2 {
		return false // TLD too short
	}

	tlds := []string{"com", "gr", "org", "info", "net", "edu", "gov"}
	tldList := make(map[string]struct{}, len(tlds))
	for _, v := range tlds {
		tldList[v] = struct{}{}
	}

	if _, ok := tldList[tld]; !ok {
		return false
	}

	return true
}
