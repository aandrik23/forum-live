package database

import (
	"time"
)

func InsertComment(userID int, postID int, content string) error {
	_, err := DB.Exec(`
		INSERT INTO comments (post_id, user_id, content, created_at)
		VALUES (?, ?, ?, ?)
	`, postID, userID, content, time.Now())

	return err
}
