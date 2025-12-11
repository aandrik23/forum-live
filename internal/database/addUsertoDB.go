package database

import (
	"errors"
	"strings"
)

func AddUserToDb(username, email, hashedPassword, status string) error {
	stmt := `INSERT INTO users (username, email, password, role, bio, avatar, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
	_, err := DB.Exec(stmt, username, email, hashedPassword, "user", "", "", status)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed: users.username") {
			return errors.New("username already exists")
		} else if strings.Contains(err.Error(), "UNIQUE constraint failed: users.email") {
			return errors.New("email already exists")
		}
		return err
	}
	return nil
}

func ChangeUserDataFromDb(oldUsername, newUsername, newbio, newavatar string) error {
	stmt := `UPDATE users SET username = ?, bio = ?, avatar = ? WHERE username = ?`
	_, err := DB.Exec(stmt, newUsername, newbio, newavatar, oldUsername)
	return err
}
