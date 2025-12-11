package database

import (
	"fmt"
	"forum/internal/models"
)

func InsertPostWithCategories(post models.Post) error {
	tx, err := DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// 🔍 Lookup user ID
	//var userID int
	// err = tx.QueryRow("SELECT id FROM users WHERE username = ?", post.Author).Scan(&userID)
	// if err != nil {
	// 	return fmt.Errorf("failed to find user ID: %w", err)
	// }

	// ✅ Insert post
	res, err := tx.Exec(`
		INSERT INTO posts (user_id, title, content, created_at)
		VALUES (?, ?, ?, ?)`,
		post.AuthorID, post.Title, post.Content, post.CreatedAt)
	if err != nil {
		return err
	}

	postID, err := res.LastInsertId()
	if err != nil {
		return err
	}

	fmt.Println("Post ID:", postID)
	fmt.Println("Categories received:", post.Categories)

	// 🔁 Handle categories
	for _, category := range post.Categories {
		// Use category.ID directly, no query needed
		_, err = tx.Exec("INSERT INTO post_categories (post_id, category_id) VALUES (?, ?)", postID, category.ID)
		if err != nil {
			return fmt.Errorf("failed to link post to category ID %d: %w", category.ID, err)
		}
	}

	return tx.Commit()
}
