package handlers

import (
	"net/http"
	"strings"
	"time"

	authutils "forum/internal/authUtils"
	"forum/internal/database"
	"forum/internal/realtime"

	"github.com/gorilla/websocket"
)

var dmUpgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,

	// Same-origin planned: allow same host.
	// If you later add cross-origin, tighten this explicitly.
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		if origin == "" {
			return true // some clients omit it
		}
		// allow exact same host
		return strings.Contains(origin, r.Host)
	},
}

type dmClientMsg struct {
	Type     string `json:"type"`
	ToUserID int    `json:"to_user_id"`
	Body     string `json:"body"`
}

func DMWebSocketHandler(w http.ResponseWriter, r *http.Request) {
	// Must be authenticated already via apiAuth (AuthMiddleware)
	payload := authutils.GetJWTFromContext(r.Context())
	if payload == nil || payload.Role == authutils.RoleAnonymous {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	// Enforce access JTI exists (same as API)
	if payload.JTI == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	ok, err := database.TokenExists(payload.JTI)
	if err != nil || !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	// Upgrade
	conn, err := dmUpgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	userID := payload.UserID

	// Register presence
	becameOnline := realtime.DM.AddConn(userID, conn)
	if becameOnline {
		realtime.DM.BroadcastPresence(userID, true)
	}
	defer func() {
		becameOffline := realtime.DM.RemoveConn(userID, conn)
		if becameOffline {
			realtime.DM.BroadcastPresence(userID, false)
		}
	}()

	// Heartbeat
	conn.SetReadLimit(64 * 1024)
	_ = conn.SetReadDeadline(time.Now().Add(realtime.PongWait))
	conn.SetPongHandler(func(string) error {
		return conn.SetReadDeadline(time.Now().Add(realtime.PongWait))
	})

	done := make(chan struct{})

	ticker := time.NewTicker(realtime.PingPeriod)
	defer ticker.Stop()

	// Ping loop (separate)
	go func() {
		defer close(done)
		for range ticker.C {
			_ = conn.SetWriteDeadline(time.Now().Add(realtime.WriteWait))
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}()

	// Read loop (blocking)
	for {
		var msg dmClientMsg
		if err := conn.ReadJSON(&msg); err != nil {
			return
		}

		if strings.ToLower(msg.Type) != "dm_send" {
			continue
		}

		// Validate
		if msg.ToUserID <= 0 || msg.ToUserID == userID {
			continue
		}
		body := strings.TrimSpace(msg.Body)
		if body == "" {
			continue
		}

		// Persist
		convID, err := database.GetOrCreateConversation(userID, msg.ToUserID)
		if err != nil {
			continue
		}

		msgID, createdAt, err := database.InsertDM(convID, userID, body)
		if err != nil {
			continue
		}
		_ = database.UpdateConversationLast(convID, msgID, createdAt)

		out := map[string]any{
			"type":              "dm_new",
			"conversation_with": msg.ToUserID,
			"message": map[string]any{
				"id":         msgID,
				"sender_id":  userID,
				"body":       body,
				"created_at": createdAt,
			},
		}

		realtime.DM.SendToUser(msg.ToUserID, out)

		// Echo to sender
		_ = conn.WriteJSON(out)
	}

}
