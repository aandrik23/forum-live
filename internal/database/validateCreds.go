package database

import (
	"database/sql"
	"errors"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

// Check credentials from DB
func ValidateCredsByEmail(email, password string) (username, role, bio, avatar string, userID int, status string, err error) {
	var storedHash string
	email = strings.ToLower(strings.TrimSpace(email))

	err = DB.QueryRow(`
		SELECT password, username, role, bio, avatar, id, status FROM users WHERE email = ?
	`, email).Scan(&storedHash, &username, &role, &bio, &avatar, &userID, &status)

	if err != nil {
		if err == sql.ErrNoRows {
			return "", "", "", "", 0, status, errors.New("user not found")
		}
		return "", "", "", "", 0, status, err
	}

	err = bcrypt.CompareHashAndPassword([]byte(storedHash), []byte(password))
	if err != nil {
		return "", "", "", "", 0, status, errors.New("invalid password")
	}

	return username, role, bio, avatar, userID, status, nil
}

func UpdateUserStatus(userID int, newStatus string) error {
	stmt, err := DB.Prepare("UPDATE users SET status = ? WHERE id = ?")
	if err != nil {
		return err
	}
	defer stmt.Close()

	_, err = stmt.Exec(newStatus, userID)
	return err
}
