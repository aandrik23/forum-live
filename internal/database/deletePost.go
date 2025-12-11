package database

func DeletePost(postID int) error {
	stmt := `DELETE FROM posts WHERE id = ?`
	_, err := DB.Exec(stmt, postID)
	return err
}
