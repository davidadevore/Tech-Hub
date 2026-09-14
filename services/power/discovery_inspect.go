package main

import (
	"context"
	"encoding/binary"
	"encoding/xml"
	"errors"
	"io"
	"math"
	"net"
	"strconv"
	"strings"
	"time"
)

// A bounded set of common TCP services, not an exhaustive scan or UDP discovery.
var inspectionPorts = []int{21, 22, 23, 53, 80, 81, 443, 502, 8080, 8081, 8443, 10001}

func discoveryMeasurements(body []byte) []Metric {
	metrics := []Metric{}
	valid, _ := validateSCADAXML(body)
	if !valid {
		return metrics
	}
	var feed struct {
		Values []struct {
			Value string `xml:"v,attr"`
		} `xml:"s"`
	}
	if xml.Unmarshal(body, &feed) != nil {
		return metrics
	}
	for _, def := range liveDefinitions {
		if def.index >= len(feed.Values) {
			continue
		}
		value := strings.TrimSpace(feed.Values[def.index].Value)
		number, err := strconv.ParseFloat(value, 64)
		if err == nil && !math.IsNaN(number) && !math.IsInf(number, 0) {
			metrics = append(metrics, Metric{Key: def.key, Label: def.label, Value: value, Unit: def.unit})
		}
	}
	return metrics
}

func inspectDiscoveryPorts(ctx context.Context, address string, result map[string]any) map[string]any {
	open := []int{}
	for _, port := range inspectionPorts {
		if ctx.Err() != nil {
			break
		}
		if discoveryPortOpen(ctx, address, port) {
			open = append(open, port)
		}
	}
	result["checked_ports"], result["open_ports"] = inspectionPorts, open

	return result
}

// Datakom DKM-411 Modbus manual V3.0: FC03, address 20480, two registers,
// low word first (verified against the DKM-411 web feed), voltage scaled by 10.
// The manual has conflicting word-order descriptions. Never issue write functions.
// https://www.datakom.com.tr/upload/Files/411_MODBUS.pdf
func discoveryModbusVoltage(ctx context.Context, address string) (float64, error) {
	connection, err := (&net.Dialer{Timeout: time.Second}).DialContext(ctx, "tcp", net.JoinHostPort(address, "502"))
	if err != nil {
		return 0, err
	}
	defer connection.Close()
	_ = connection.SetDeadline(time.Now().Add(time.Second))
	stop := context.AfterFunc(ctx, func() { connection.Close() })
	defer stop()
	request := []byte{0, 1, 0, 0, 0, 6, 1, 3, 0x50, 0, 0, 2}
	if _, err = connection.Write(request); err != nil {
		return 0, err
	}
	reply := make([]byte, 13)
	if _, err = io.ReadFull(connection, reply); err != nil {
		return 0, err
	}
	return parseDiscoveryModbusVoltage(reply)
}
func parseDiscoveryModbusVoltage(reply []byte) (float64, error) {
	if len(reply) != 13 || binary.BigEndian.Uint16(reply[0:2]) != 1 || binary.BigEndian.Uint16(reply[2:4]) != 0 || binary.BigEndian.Uint16(reply[4:6]) != 7 || reply[6] != 1 || reply[7] != 3 || reply[8] != 4 {
		return 0, errors.New("invalid Modbus read response")
	}
	return float64(uint32(binary.BigEndian.Uint16(reply[11:13]))<<16|uint32(binary.BigEndian.Uint16(reply[9:11]))) / 10, nil
}

func verifyDiscoveryModbus(ctx context.Context, address string, result map[string]any) map[string]any {
	result["modbus_verified"] = false
	sample, err := fetchModbusContext(ctx, Device{Address: address, ModbusPort: 502, ModbusUnit: 1}, Settings{TimeoutSeconds: 2.5})
	if err != nil {
		result["modbus_probe"] = "Required Modbus readings did not validate on port 502, unit 1. Check the device settings before adding."
		return result
	}
	result["modbus_verified"] = true
	result["modbus_probe"] = "Verified required Modbus measurements (port 502, unit 1)."
	result["modbus_measurements"] = sample.Metrics
	return result
}
