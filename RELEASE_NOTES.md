Power Monitor now prefers Modbus TCP for DKM-411 meters, with a validated web-feed fallback. The dashboard shows the active reading source. Existing meters use automatic web identification before switching; the device editor also offers explicit Modbus or web-only modes, with configurable port and unit ID.

Discovery searches a private IP range for compatible web interfaces, then validates every required Modbus measurement before enabling Add. Discovered PDs are added explicitly with Add and Save changes.

New installations default to one-second polling. Existing intervals are preserved. Polling cycles do not overlap and may run slower if a meter takes longer to respond. This implementation issues only read requests.

Mac and Windows installers are included. Quit Tech Hub before updating. Saved settings survive updates. Windows builds are unsigned; Mac builds are ad-hoc signed.
