package main

import (
	"encoding/json"
	"net/http/httptest"
	"testing"
)

func TestCompactStatusAndSeparateHistory(t *testing.T) {
	config := defaultConfig()
	config.Devices = []Device{{ID: "test01", Address: "127.0.0.1", Scheme: "http", Port: 80, Path: "/"}}
	monitor := newMonitor(&Store{config: config})
	monitor.records["test01"].History = []map[string]any{{"observed_at": "test", "l1_current": 12.0}}
	app := &App{monitor: monitor}
	for _, url := range []string{"/api/status?history=false", "/api/status", "/api/history"} {
		response := httptest.NewRecorder()
		app.ServeHTTP(response, httptest.NewRequest("GET", url, nil))
		if response.Code != 200 {
			t.Fatalf("%s: %d", url, response.Code)
		}
		var data map[string]any
		if err := json.Unmarshal(response.Body.Bytes(), &data); err != nil {
			t.Fatal(err)
		}
		if url == "/api/history" {
			if len(data["test01"].([]any)) != 1 {
				t.Fatal("missing chart history")
			}
		} else {
			device := data["devices"].([]any)[0].(map[string]any)
			_, hasHistory := device["history"]
			if hasHistory != (url == "/api/status") {
				t.Fatalf("wrong history inclusion: %s", url)
			}
			if device["id"] != "test01" {
				t.Fatal("missing live record")
			}
		}
	}
	if len(monitor.records["test01"].History) != 1 {
		t.Fatal("status mutated stored history")
	}
}
