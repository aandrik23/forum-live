package authutils

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"forum/internal/database"
	"forum/internal/logger"
	"forum/internal/utils"
	"net/http"
	"strings"
	"time"
)

func writeAPIUnauthorized(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"error": "unauthorized",
	})
}

// this is for better experience when tokens are expire or cant refresh , we issue anon token and redirect user to home page
func redirectToHomeAsAnon(w http.ResponseWriter, r *http.Request) {
	ExpireTokens(w, r)
	uuid := utils.GenerateUUID()
	createAnonymousToken(w, uuid)

	// If this is an API/fetch request, return 401 JSON instead of redirecting HTML
	wantsJSON := strings.Contains(r.Header.Get("Accept"), "application/json") ||
		r.Header.Get("X-Requested-With") == "XMLHttpRequest" ||
		strings.HasPrefix(r.URL.Path, "/api/")

	if wantsJSON {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"error": "unauthorized",
		})
		return
	}

	http.Redirect(w, r, "/home", http.StatusSeeOther)
}

func safeLogWithRequest(r *http.Request, msg string, payload *JWTPayload, level logger.LogLevel) {
	meta := fmt.Sprintf(" | Method:%s | IP:%s", r.Method, r.RemoteAddr)
	if payload != nil {
		msg += " UUID:" + payload.UUID
	}
	logger.Log(msg+meta, level)
}

// this is for first time visitors
func AuthMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {

		//  Block any access if session was killed
		if logoutCookie, err := r.Cookie("session_killed"); err == nil && logoutCookie.Value == "true" {
			expireSessionKilledToken(w)
		}

		//  Get the auth_token
		cookie, err := r.Cookie("auth_token")

		if err != nil || cookie.Value == "" {

			// allow auth endpoints without cookie
			if r.URL.Path == "/api/login" || r.URL.Path == "/api/register" {
				next.ServeHTTP(w, r)
				return
			}

			// // shell route (SPA deep links included) -> issue anon and allow
			uuid := utils.GenerateUUID()
			createAnonymousToken(w, uuid)
			next.ServeHTTP(w, r)
			return

		}

		//  Validate JWT
		payload, err := VerifyJWT(cookie.Value, TokenTypeAccess)
		if err != nil {
			if errors.Is(err, ErrTokenExpired) {
				// make sure we dont check refresh tokens for anonymous we just send a new anon token
				if anonPayload := checkForAnonymousPayload(cookie.Value); anonPayload != nil {
					ctx := context.WithValue(r.Context(), "jwtPayload", anonPayload)

					uuid := utils.GenerateUUID()
					createAnonymousToken(w, uuid)
					logger.Log(fmt.Sprint("Expired Anonymous Token. NEW JWT issued for anonymous user new uuid:", uuid), logger.InfoLevel)

					next.ServeHTTP(w, r.WithContext(ctx))
					return
				}
				// Try to refresh
				refreshCookie, err := r.Cookie("refresh_token")
				if err != nil || refreshCookie.Value == "" {
					msg := "Missing refresh token"
					safeLogWithRequest(r, msg, payload, logger.ErrorLevel)

					// force anon experience
					redirectToHomeAsAnon(w, r)
					return
				}

				newAccessToken, err := refreshAccessToken(refreshCookie.Value, w, r)
				if err != nil {
					msg := "Session expired"
					safeLogWithRequest(r, msg, payload, logger.ErrorLevel)
					redirectToHomeAsAnon(w, r)
					//http.Error(w, msg, http.StatusUnauthorized)
					return
				}
				payload, err = VerifyJWT(newAccessToken, TokenTypeAccess)
				if err != nil {
					msg := "Token refresh failed"
					safeLogWithRequest(r, msg, payload, logger.ErrorLevel)
					redirectToHomeAsAnon(w, r)
					return
				}

			} else {
				msg := "Invalid token"
				safeLogWithRequest(r, msg, payload, logger.ErrorLevel)
				redirectToHomeAsAnon(w, r)
				return
			}
		}

		//  Check if access token's JTI is in the database
		if payload.JTI != "" {
			exists, err := database.TokenExists(payload.JTI)
			if err != nil || !exists {
				msg := "Access token revoked or invalid"
				redirectToHomeAsAnon(w, r)
				// http.Error(w, msg, http.StatusUnauthorized)
				safeLogWithRequest(r, msg, payload, logger.ErrorLevel)
				return
			}
		} else if payload.Role != RoleAnonymous {
			// Defensive: only allow missing JTI for anonymous
			http.Error(w, "Invalid token structure", http.StatusUnauthorized)
			return
		}

		logger.Log(fmt.Sprint("Verified token UUID:", payload.UUID, "| Role:", payload.Role), logger.InfoLevel)

		//  SPA RULE: anonymous token is allowed for shell only, NOT for API data
		if payload.Role == RoleAnonymous && strings.HasPrefix(r.URL.Path, "/api/") {
			switch r.URL.Path {
			case "/api/login", "/api/register", "/api/logout":
				// allow
			default:
				writeAPIUnauthorized(w)
				return
			}
		}

		ctx := context.WithValue(r.Context(), "jwtPayload", payload)
		r = r.WithContext(ctx)
		next.ServeHTTP(w, r)
	}
}

func checkForAnonymousPayload(token string) *JWTPayload {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil
	}

	payloadRaw, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil
	}

	var tempPayload JWTPayload
	if err := json.Unmarshal(payloadRaw, &tempPayload); err != nil {
		return nil
	}

	if tempPayload.Role == RoleAnonymous {
		return &tempPayload
	}
	return nil
}

func refreshAccessToken(refreshToken string, w http.ResponseWriter, r *http.Request) (string, error) {

	// 1. Verify the refresh token
	payload, err := VerifyJWT(refreshToken, TokenTypeRefresh)
	if err != nil {
		msg := "invalid or expired refresh token"
		safeLogWithRequest(r, msg, payload, logger.ErrorLevel)
		return "", errors.New(msg)
	}
	logger.Log("Refresh Token verrified "+"UUID:"+payload.UUID, logger.DebugLevel)

	// 1.1 Anonymous users can't refresh
	if payload.Role == RoleAnonymous {
		msg := "anonymous users cannot refresh token"
		return "", errors.New(msg)
	}

	// 2. Check that refresh token exists in DB
	exists, err := database.TokenExists(payload.JTI)
	if err != nil || !exists {
		logger.Log(fmt.Sprintf("Refresh token not recognized: JTI=%s | Exists=%v | Err=%v"+" | UUID=%s", payload.JTI, exists, err, payload.UUID), logger.DebugLevel)
		return "", errors.New("refresh token not recognized")
	}
	logger.Log("Refresh Token ID exists in DB ID:"+payload.JTI, logger.DebugLevel)

	// 3. Delete old Access and refresh token ID (rotation)
	if err := database.DeleteToken(payload.JTI); err != nil {
		msg := "failed to revoke old refresh token"
		safeLogWithRequest(r, msg, payload, logger.ErrorLevel)
		return "", errors.New(msg)
	}
	logger.Log("Refresh Token ID deleted from DB", logger.DebugLevel)

	if payload.AccessJTI != "" {
		if err := database.DeleteToken(payload.AccessJTI); err != nil {
			msg := "failed to revoke old access token"
			safeLogWithRequest(r, msg, payload, logger.ErrorLevel)
			return "", errors.New(msg)
		}
	}
	logger.Log("Access Token ID deleted from DB", logger.DebugLevel)

	// 5. Generate new refresh & access token ID and store it
	new_refresh_JTI := utils.GenerateUUID()
	new_access_JTI := utils.GenerateUUID()
	refresh_expiry := time.Now().Add(RefreshTokenTime).Unix()
	access_expiry := time.Now().Add(AccessTokenTime).Unix()

	if err := database.SaveToken(payload.UUID, new_refresh_JTI, TokenTypeRefresh, refresh_expiry); err != nil {
		msg := "failed to store new refresh token"
		safeLogWithRequest(r, msg, payload, logger.ErrorLevel)
		return "", errors.New(msg)
	}
	logger.Log("Refresh Token ID added to DB"+" \n[ UUID:"+payload.UUID+" \nNEW_Refresh_jti: "+new_refresh_JTI+" \nToken Type:"+TokenTypeRefresh+" ]", logger.DebugLevel)

	if err := database.SaveToken(payload.UUID, new_access_JTI, TokenTypeAccess, access_expiry); err != nil {
		msg := "failed to store new refresh token"
		safeLogWithRequest(r, msg, payload, logger.ErrorLevel)
		return "", errors.New(msg)
	}
	logger.Log("Access Token ID added to DB"+" \n[ UUID:"+payload.UUID+" \nNEW_Access_jti: "+new_access_JTI+" \nToken Type:"+TokenTypeAccess+" ]", logger.DebugLevel)

	// 6. Generate new access
	token := createAccessToken(w, payload.Username, payload.Role, payload.UUID, new_access_JTI, payload.Bio, payload.Avatar, payload.UserID)
	//logger.Log("New Access Token created"+"\n[ UUID:"+payload.UUID+" \nRole:"+payload.Role+" \nNEW_Access_jti: "+new_access_JTI+" \nToken Type:"+TokenTypeAccess+" \nExpire:"+AccessTokenTime.String()+" ]", logger.DebugLevel)

	// Expire old cookies
	expireRefreshToken(w)
	expireCsrfToken(w)

	// Set new tokens
	createRefreshToken(w, payload.Username, payload.Role, payload.UUID, new_refresh_JTI, new_access_JTI, payload.Bio, payload.Avatar, payload.UserID)
	createCsrfToken(w)

	return token, nil
}

//----------------------------------------------------------------

func RequireRoleMiddleware(allowedRoles ...string) func(http.HandlerFunc) http.HandlerFunc {
	roleSet := make(map[string]struct{})
	for _, role := range allowedRoles {
		roleSet[role] = struct{}{}
	}

	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			payload, ok := r.Context().Value("jwtPayload").(*JWTPayload)

			wantsJSON := strings.HasPrefix(r.URL.Path, "/api/") ||
				strings.Contains(r.Header.Get("Accept"), "application/json") ||
				r.Header.Get("X-Requested-With") == "XMLHttpRequest"

			if !ok || payload == nil {
				msg := "Unauthorized"
				safeLogWithRequest(r, msg, payload, logger.ErrorLevel)

				if wantsJSON {
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusUnauthorized)
					_ = json.NewEncoder(w).Encode(map[string]string{
						"error": "unauthorized",
					})
					return
				}

				http.Redirect(w, r, "/?show=register", http.StatusSeeOther)
				return
			}

			if _, ok := roleSet[payload.Role]; !ok {
				msg := "Forbidden: insufficient role"
				safeLogWithRequest(r, msg, payload, logger.ErrorLevel)

				if wantsJSON {
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusForbidden)
					_ = json.NewEncoder(w).Encode(map[string]string{
						"error": "forbidden",
					})
					return
				}

				http.Redirect(w, r, "/?show=register", http.StatusSeeOther)
				return
			}

			safeLogWithRequest(r,
				fmt.Sprintf("Access granted: Role: %s", payload.Role),
				payload,
				logger.InfoLevel,
			)
			next.ServeHTTP(w, r)
		}
	}
}
