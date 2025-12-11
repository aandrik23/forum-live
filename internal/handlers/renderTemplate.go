package handlers

import (
	"bytes"
	"fmt"
	"net/http"
	"text/template"
)

var templates = template.Must(template.ParseGlob("templates/*.html"))

func renderTemplate(w http.ResponseWriter, page string, data any) {
	files := []string{
		"templates/base.html",
		fmt.Sprintf("templates/%s.html", page),
	}
	t, err := template.ParseFiles(files...)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	// Buffer output before writing to the response
	var buf bytes.Buffer
	if err := t.ExecuteTemplate(&buf, "base", data); err != nil {
		http.Error(w, "Template execution error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Success: write buffered content to the response
	buf.WriteTo(w)
}
