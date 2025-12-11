package handlers

import (
	"bytes"
	"fmt"
	"net/http"
	"strings"
	"text/template"
)

func renderTemplate(w http.ResponseWriter, page string, data any) {
	var files []string
	var tmplName string

	if strings.HasSuffix(page, "_content") {
		// partial: use only that page's template file, no base.html
		root := strings.SplitN(page, "_", 2)[0] // "profile_content" -> "profile"
		files = []string{
			fmt.Sprintf("templates/%s.html", root),
		}
		tmplName = page // e.g. "profile_content"
	} else {
		// full page: base layout + page file
		files = []string{
			"templates/base.html",
			fmt.Sprintf("templates/%s.html", page),
		}
		tmplName = "base"
	}

	t, err := template.ParseFiles(files...)
	if err != nil {
		http.Error(w, "Template parse error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	var buf bytes.Buffer
	if err := t.ExecuteTemplate(&buf, tmplName, data); err != nil {
		http.Error(w, "Template execution error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	buf.WriteTo(w)
}
