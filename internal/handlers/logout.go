package handlers

import (
	authutils "forum/internal/authUtils"
	"forum/internal/database"
	"net/http"
)

func LogoutHandler(w http.ResponseWriter, r *http.Request) {

	payload := authutils.GetJWTFromContext(r.Context())

	authutils.ExpireTokens(w, r)

	err := database.UpdateUserStatus(payload.UserID, "inactive")
	if err != nil {
		WriteJSONError(w, "Unable to update user status", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/", http.StatusSeeOther)
}
