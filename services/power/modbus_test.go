package main

import (
	"encoding/binary"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"testing"
	"time"
)

func mockMeter(t *testing.T, fail bool) int {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { listener.Close() })
	go func() {
		for {
			c, err := listener.Accept()
			if err != nil {
				return
			}
			go func() {
				defer c.Close()
				for {
					request := make([]byte, 12)
					if _, err := io.ReadFull(c, request); err != nil {
						return
					}
					if request[7] != 3 {
						return
					}
					count := int(binary.BigEndian.Uint16(request[10:]))
					start := binary.BigEndian.Uint16(request[8:])
					if count > 16 {
						return
					}
					if fail {
						c.Write(append(append([]byte{}, request[:4]...), 0, 3, request[6], 0x83, 2))
						return
					}
					response := make([]byte, 9+count*2)
					copy(response, request[:4])
					binary.BigEndian.PutUint16(response[4:], uint16(3+count*2))
					response[6] = request[6]
					response[7] = 3
					response[8] = byte(count * 2)
					regs := map[uint16]uint16{20480: 2400, 20492: 105, 20494: 79, 20496: 186, 20498: 287, 20528: 6000, 20527: 950, 20506: 0xff9c, 20507: 0xffff, 12460: 125}
					for i := 0; i < count; i++ {
						binary.BigEndian.PutUint16(response[9+i*2:], regs[start+uint16(i)])
					}
					// Split frames to exercise TCP reassembly.
					c.Write(response[:5])
					c.Write(response[5:])
				}
			}()
		}
	}()
	return listener.Addr().(*net.TCPAddr).Port
}
func TestModbusPollingDecodesReadingsAndSignedPower(t *testing.T) {
	p := mockMeter(t, false)
	r, err := fetchModbus(Device{Address: "127.0.0.1", ModbusPort: p, ModbusUnit: 7}, Settings{TimeoutSeconds: 1})
	if err != nil {
		t.Fatal(err)
	}
	values := map[string]string{}
	for _, m := range r.Metrics {
		values[m.Key] = m.Value
	}
	for k, want := range map[string]string{"l1_voltage": "240", "l1_current": "10.5", "frequency": "60", "power_factor": "0.95", "power": "-1", "l1_demand": "12.5"} {
		if values[k] != want {
			t.Fatalf("%s: got %s want %s", k, values[k], want)
		}
	}
	if r.Source != "Modbus TCP" || r.Status != "online" || len(r.Metrics) != 18 {
		t.Fatalf("bad result %+v", r)
	}
}
func TestModbusFailureFallsBackOnlyToValidLiveFeed(t *testing.T) {
	p := mockMeter(t, true)
	for _, valid := range []bool{true, false} {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/scd.xml" {
				if valid {
					io.WriteString(w, `<m>`)
					for i := 0; i < 35; i++ {
						io.WriteString(w, `<s v="1"/>`)
					}
					io.WriteString(w, `</m>`)
				} else {
					io.WriteString(w, "invalid")
				}
				return
			}
			io.WriteString(w, `<title>DKM411 Web Scada</title><script>var scadaArray; var ml1b; ajax.open('GET','scd.xml');</script>`)
		}))
		host, port, _ := net.SplitHostPort(server.Listener.Addr().String())
		httpPort, _ := strconv.Atoi(port)
		d := Device{Address: host, Scheme: "http", Port: httpPort, Path: "/", PollingMode: "modbus", ModbusPort: p}
		r := fetchDevice(d, Settings{TimeoutSeconds: 1, MaxResponseKB: 128})
		server.Close()
		if valid && (r.Source != "Web fallback" || r.Status != "warning" || len(r.Metrics) == 0) {
			t.Fatalf("missing fallback: %+v", r)
		}
		if !valid && (r.Status != "offline" || len(r.Metrics) != 0 || r.LastSeen != "") {
			t.Fatalf("invalid feed reported live: %+v", r)
		}
	}
}
func TestLiveModbusPolling(t *testing.T) {
	address := os.Getenv("TECH_HUB_TEST_DP")
	if address == "" {
		t.Skip("live hardware test is opt-in")
	}
	for i := 0; i < 3; i++ {
		r, err := fetchModbus(Device{Address: address}, Settings{TimeoutSeconds: 2.5})
		if err != nil {
			t.Fatal(err)
		}
		if len(r.Metrics) != 18 {
			t.Fatal("incomplete measurements")
		}
		t.Logf("cycle %d: %d measurements, %d ms", i+1, len(r.Metrics), r.ResponseMS)
		time.Sleep(time.Second)
	}
}

func TestEndpointChangeDropsIdentificationAndRejectsOldPoll(t *testing.T) {
	old := Device{ID: "meter01", Address: "172.20.10.40", Scheme: "http", Port: 80, Path: "/"}
	config := defaultConfig()
	config.Devices = []Device{old}
	m := newMonitor(&Store{config: config})
	m.apply(old.ID, fetchResult{Status: "online", Title: "Datakom DKM-411"}, old)
	changed := old
	changed.Address = "172.20.10.41"
	config.Devices = []Device{changed}
	m.syncRecords(config)
	m.apply(old.ID, fetchResult{Status: "online", Title: "Datakom DKM-411"}, old)
	if m.records[old.ID].Title != "" || m.records[old.ID].Status != "pending" {
		t.Fatal("old endpoint contaminated new device")
	}
}
