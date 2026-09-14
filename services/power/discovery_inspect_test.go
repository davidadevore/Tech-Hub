package main

import "testing"

func TestModbusInspectionValidatesFrame(t *testing.T) {
	reply := []byte{0, 1, 0, 0, 0, 7, 1, 3, 4, 0, 0, 9, 96}
	value, err := parseDiscoveryModbusVoltage(reply)
	if err != nil || value != 240 {
		t.Fatalf("%v %v", value, err)
	}
	for _, index := range []int{1, 3, 5, 6, 7, 8} {
		bad := append([]byte{}, reply...)
		bad[index]++
		if _, err := parseDiscoveryModbusVoltage(bad); err == nil {
			t.Fatalf("accepted invalid frame at %d", index)
		}
	}
	if _, err := parseDiscoveryModbusVoltage(reply[:8]); err == nil {
		t.Fatal("accepted short frame")
	}
}
func TestDiscoveryPreviewUsesLiveValuesAndExcludesNonnumericData(t *testing.T) {
	body := []byte(`<m><s v=" 120.5 "/><s v="NaN"/><s v="invalid"/><s v="208"/><s v="208"/><s v="208"/><s v="10.5"/><s v="7.9"/><s v="18.6"/><s v="28.7"/><s v="60.00"/></m>`)
	metrics := discoveryMeasurements(body)
	if len(metrics) != 9 || metrics[0].Value != "120.5" || metrics[0].Unit != "V" {
		t.Fatalf("wrong preview: %+v", metrics)
	}
	if len(discoveryMeasurements([]byte(`<error>not live data</error>`))) != 0 {
		t.Fatal("accepted invalid feed")
	}
}
