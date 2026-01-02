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
	sendErr := func(msg string) {
		_ = conn.WriteJSON(map[string]any{
			"type":  "dm_error",
			"error": msg,
		})
	}

	userID := payload.UserID

	// Register presence
	becameOnline := realtime.DM.AddConn(userID, conn)
	// also tell this client they are online (useful for UI)
	_ = conn.WriteJSON(map[string]any{
		"type":    "presence",
		"user_id": userID,
		"online":  true,
	})

	// Send presence snapshot to this client (initial state) - partners only
	partners, err := database.GetDMPartnerIDs(userID)
	online := []int{}
	if err == nil && len(partners) > 0 {
		for _, pid := range partners {
			if realtime.DM.IsOnline(pid) {
				online = append(online, pid)
			}
		}
	}

	_ = conn.WriteJSON(map[string]any{
		"type":       "presence_snapshot",
		"online_ids": online,
	})

	if becameOnline {
		partners, err := database.GetDMPartnerIDs(userID)
		if err == nil && len(partners) > 0 {
			realtime.DM.SendPresenceToUsers(partners, userID, true)
		}
	}

	defer func() {
		becameOffline := realtime.DM.RemoveConn(userID, conn)
		if becameOffline {
			partners, err := database.GetDMPartnerIDs(userID)
			if err == nil && len(partners) > 0 {
				realtime.DM.SendPresenceToUsers(partners, userID, false)
			}
		}
	}()

	// Heartbeat
	conn.SetReadLimit(64 * 1024)
	_ = conn.SetReadDeadline(time.Now().Add(realtime.PongWait))
	conn.SetPongHandler(func(string) error {
		return conn.SetReadDeadline(time.Now().Add(realtime.PongWait))
	})

	ticker := time.NewTicker(realtime.PingPeriod)
	defer ticker.Stop()

	// Ping loop (separate)
	go func() {
		for range ticker.C {
			_ = conn.SetWriteDeadline(time.Now().Add(realtime.WriteWait))
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				_ = conn.Close()
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
			sendErr("invalid recipient")
			continue
		}
		body := strings.TrimSpace(msg.Body)
		if body == "" {
			sendErr("empty message")
			continue
		}
		if len(body) > 2000 {
			sendErr("message too long")
			continue
		}

		exists, err := database.UserExists(msg.ToUserID)
		if err != nil {
			sendErr("server error")
			continue
		}
		if !exists {
			sendErr("recipient not found")
			continue
		}

		// Persist
		convID, created, err := database.GetOrCreateConversation(userID, msg.ToUserID)
		if err != nil {
			sendErr("server error")
			continue
		}

		if created {
			// If this is a brand new DM relationship, nudge presence both ways.
			// This keeps partners-only presence logic consistent.
			realtime.DM.SendToUser(msg.ToUserID, map[string]any{
				"type":    "presence",
				"user_id": userID,
				"online":  true,
			})
			_ = conn.WriteJSON(map[string]any{
				"type":    "presence",
				"user_id": msg.ToUserID,
				"online":  realtime.DM.IsOnline(msg.ToUserID),
			})
		}

		msgID, createdAt, err := database.InsertDM(convID, userID, body)
		if err != nil {
			sendErr("server error")
			continue
		}

		if err := database.UpdateConversationLast(convID, msgID, createdAt); err != nil {
			sendErr("server error")
			continue
		}
		// thread bump for recipient: their "other_user_id" should be the sender
		bumpToRecipient := map[string]any{
			"type":                "thread_bump",
			"other_user_id":       userID,
			"last_message_body":   body,
			"last_message_at":     createdAt,
			"last_message_sender": userID,
		}

		// thread bump for sender: their "other_user_id" should be the recipient
		bumpToSender := map[string]any{
			"type":                "thread_bump",
			"other_user_id":       msg.ToUserID,
			"last_message_body":   body,
			"last_message_at":     createdAt,
			"last_message_sender": userID,
		}
		realtime.DM.SendToUser(msg.ToUserID, bumpToRecipient)
		_ = conn.WriteJSON(bumpToSender)

		// payload for recipient (their "conversation_with" must be the sender)
		outToRecipient := map[string]any{
			"type":              "dm_new",
			"conversation_with": userID, // sender id
			"message": map[string]any{
				"id":              msgID,
				"sender_id":       userID,
				"sender_username": payload.Username,
				"body":            body,
				"created_at":      createdAt,
			},
		}

		// payload for sender (their "conversation_with" is the recipient)
		outToSender := map[string]any{
			"type":              "dm_new",
			"conversation_with": msg.ToUserID, // recipient id
			"message": map[string]any{
				"id":              msgID,
				"sender_id":       userID,
				"sender_username": payload.Username,
				"body":            body,
				"created_at":      createdAt,
			},
		}

		realtime.DM.SendToUser(msg.ToUserID, outToRecipient)
		_ = conn.WriteJSON(outToSender)

	}

}
