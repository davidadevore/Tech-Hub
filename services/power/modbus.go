package main

import (
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"net"
	"strconv"
	"strings"
	"time"
)

func dkmTitle(title string) bool {
	return strings.Contains(strings.ToLower(title), "dkm411 web scada") || title == "Datakom DKM-411"
}

// DKM-411 register map V3.0. Read-only FC03; at most 16 registers per request.
// This meter uses low-word-first 32-bit values, verified against its web feed.
var modbusMetrics = []struct {
	address          uint16
	words            int
	scale            float64
	signed           bool
	key, label, unit string
}{
	{20480, 2, 10, false, "l1_voltage", "L1 voltage", "V"}, {20482, 2, 10, false, "l2_voltage", "L2 voltage", "V"}, {20484, 2, 10, false, "l3_voltage", "L3 voltage", "V"},
	{20486, 2, 10, false, "l12_voltage", "L12 voltage", "V"}, {20488, 2, 10, false, "l23_voltage", "L23 voltage", "V"}, {20490, 2, 10, false, "l31_voltage", "L31 voltage", "V"},
	{20492, 2, 10, false, "l1_current", "L1 current", "A"}, {20494, 2, 10, false, "l2_current", "L2 current", "A"}, {20496, 2, 10, false, "l3_current", "L3 current", "A"}, {20498, 2, 10, false, "neutral_current", "Neutral current", "A"},
	{20528, 1, 100, false, "frequency", "Frequency", "Hz"}, {20506, 2, 100, true, "power", "Total power", "kW"}, {20514, 2, 100, true, "reactive_power", "Total reactive power", "kVAr"}, {20522, 2, 100, false, "apparent_power", "Total apparent power", "kVA"}, {20527, 1, 1000, true, "power_factor", "Power factor", ""},
	{12460, 2, 10, false, "l1_demand", "Demand I1", "A"}, {12462, 2, 10, false, "l2_demand", "Demand I2", "A"}, {12464, 2, 10, false, "l3_demand", "Demand I3", "A"},
}

func readRegisters(c net.Conn, transaction uint16, unit byte, start, count uint16) ([]uint16, error) {
	if count == 0 || count > 16 {
		return nil, errors.New("invalid register count")
	}
	request := make([]byte, 12)
	binary.BigEndian.PutUint16(request, transaction)
	binary.BigEndian.PutUint16(request[4:], 6)
	request[6] = unit
	request[7] = 3
	binary.BigEndian.PutUint16(request[8:], start)
	binary.BigEndian.PutUint16(request[10:], count)
	if _, err := c.Write(request); err != nil {
		return nil, err
	}
	header := make([]byte, 7)
	if _, err := io.ReadFull(c, header); err != nil {
		return nil, err
	}
	length := binary.BigEndian.Uint16(header[4:])
	if binary.BigEndian.Uint16(header) != transaction || binary.BigEndian.Uint16(header[2:]) != 0 || header[6] != unit || length < 3 || length > 35 {
		return nil, errors.New("invalid Modbus response header")
	}
	body := make([]byte, length-1)
	if _, err := io.ReadFull(c, body); err != nil {
		return nil, err
	}
	if body[0] == 0x83 {
		return nil, fmt.Errorf("Modbus read exception %d", body[1])
	}
	if body[0] != 3 || int(body[1]) != int(count)*2 || len(body) != 2+int(count)*2 {
		return nil, errors.New("invalid Modbus register response")
	}
	values := make([]uint16, count)
	for i := range values {
		values[i] = binary.BigEndian.Uint16(body[2+i*2:])
	}
	return values, nil
}

func fetchModbus(device Device, settings Settings) (fetchResult, error) {
	return fetchModbusContext(context.Background(), device, settings)
}

func fetchModbusContext(parent context.Context, device Device, settings Settings) (fetchResult, error) {
	started := time.Now()
	checked := nowString()
	port, unit := device.ModbusPort, device.ModbusUnit
	if port == 0 {
		port = 502
	}
	if unit == 0 {
		unit = 1
	}
	ctx, cancel := context.WithTimeout(parent, time.Duration(settings.TimeoutSeconds*float64(time.Second)))
	defer cancel()
	c, err := (&net.Dialer{}).DialContext(ctx, "tcp", net.JoinHostPort(device.Address, strconv.Itoa(port)))
	if err != nil {
		return fetchResult{}, err
	}
	defer c.Close()
	deadline, _ := ctx.Deadline()
	_ = c.SetDeadline(deadline)
	registers := map[uint16]uint16{}
	for i, block := range [][2]uint16{{20480, 16}, {20496, 16}, {20512, 16}, {20528, 1}, {12460, 6}} {
		values, err := readRegisters(c, uint16(i+1), byte(unit), block[0], block[1])
		if err != nil {
			return fetchResult{}, err
		}
		for j, v := range values {
			registers[block[0]+uint16(j)] = v
		}
	}
	metrics := []Metric{}
	fields := []Field{}
	for _, def := range modbusMetrics {
		raw := uint32(registers[def.address])
		if def.words == 2 {
			raw |= uint32(registers[def.address+1]) << 16
		}
		value := float64(raw)
		if def.signed {
			if def.words == 2 {
				value = float64(int32(raw))
			} else {
				value = float64(int16(raw))
			}
		}
		text := strconv.FormatFloat(value/def.scale, 'f', -1, 64)
		metrics = append(metrics, Metric{Key: def.key, Label: def.label, Value: text, Unit: def.unit})
		fields = append(fields, Field{Label: def.label, Value: strings.TrimSpace(text + " " + def.unit), Source: "modbus"})
	}
	capture := &Capture{Title: "Datakom DKM-411", Metrics: metrics, Fields: fields, PhaseAlerts: phaseAlerts(metrics), FetchedAt: checked, URL: fmt.Sprintf("modbus://%s/%d", net.JoinHostPort(device.Address, strconv.Itoa(port)), unit), Text: "Read-only DKM-411 Modbus TCP measurements", LiveFeed: map[string]any{"protocol": "modbus-tcp", "unit_id": unit, "registers": registers}}
	return fetchResult{Status: "online", Source: "Modbus TCP", CheckedAt: checked, LastSeen: checked, ResponseMS: time.Since(started).Milliseconds(), ContentType: "application/modbus", Title: capture.Title, Metrics: metrics, Fields: fields, PhaseAlerts: capture.PhaseAlerts, Capture: capture}, nil
}

func fetchDevice(device Device, settings Settings) fetchResult {
	if device.PollingMode != "modbus" {
		r := fetchDeviceHTTP(device, settings)
		r.Source = "Web feed"
		return r
	}
	r, err := fetchModbus(device, settings)
	if err == nil {
		return r
	}
	fallback := fetchDeviceHTTP(device, settings)
	fallback.Source = "Web fallback"
	if fallback.Capture != nil && fallback.Capture.LiveFeed != nil && fallback.HTTPStatus == 200 && len(fallback.Metrics) > 0 {
		fallback.Status = "warning"
		fallback.Error = "Modbus unavailable; using web feed: " + err.Error()
		return fallback
	}
	fallback.Status = "offline"
	fallback.Error = "Modbus failed and no valid web feed is available: " + err.Error()
	fallback.Metrics = []Metric{}
	fallback.Fields = []Field{}
	fallback.PhaseAlerts = []string{}
	fallback.LastSeen = ""
	return fallback
}
