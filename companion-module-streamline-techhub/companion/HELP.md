# Streamline Tech Hub

Displays D’san Limitimer clocks and PerfectCue arrows on Companion buttons.
Requires Companion 5.0 or newer (module API 2.0) and Tech Hub.
No internet is required after downloading and importing the module package.

## Connect

1. Start Tech Hub and connect the Limitimer and/or PerfectCue in D’san Ready.
2. Find the **D’san Ready public port** on Tech Hub’s master page (normally 8701; it can change if occupied).
3. In Companion, add a **Streamline Tech Hub** connection.
4. Enter the **Tech Hub computer’s IP address or hostname**, and that D’san port.
   Use 127.0.0.1 only when Companion and Tech Hub run on the same computer.
5. If D’san is password protected in Tech Hub, enter its service password.
6. Save, then open **Buttons → Presets → your Tech Hub connection**.

Companion requests /api/state over the local network every 250 ms by default.
Tech Hub replies with the timer and cue data; no additional listening port or
destination address is needed in Tech Hub. Use a trusted local network.
The module does not make a second connection to the physical D’san hardware.

## Ready-made buttons

Drag a preset onto an empty button:

- **Active minutes and seconds** — the selected program’s clock.
- **Active minutes** and **Active seconds** — separate display buttons.
- **Program 1–4 clock** — each program independently.
- **PerfectCue previous arrow** and **PerfectCue next arrow** — arrows that light when a cue arrives.

These are display buttons; pressing them does not send timer or slide commands.

## Custom text and colors

The connection’s **Preset text** fields let you choose clock, minutes, seconds,
previous, and next text for newly placed presets. Keep timer variables wherever
you want live values. Empty text is allowed.

For any button already placed, use Companion’s button editor to change its text,
size, and colors. This also applies to the four program presets.
Editing connection preset text does not overwrite existing buttons.

Active next text/arrow is green; active previous text/arrow is red. Both use a
dark background. Idle arrows are gray. To change active colors on a placed
button, edit its **Feedbacks → PerfectCue arrow lit** style.

**Arrow text size** defaults to **72** for large arrow glyphs. Choose a size
up to 96, or **0 (auto)** to fit longer custom labels. Arrow presets hide the
top bar to use more of the button face. These changes apply when placing a
new preset; existing buttons can be resized in Companion’s button editor.

## PerfectCue options

**Flash arrow buttons on every received cue** enables two brief flashes at the
start of each received direction cue. Turn it off for a steady arrow.
Each new cue restarts the display time and flashing, including repeated clicks
in the same direction.

**Arrow display time** is in seconds. Set it to **0** to follow Tech Hub’s
PerfectCue Display time (two seconds in older Tech Hub versions), or enter a
Companion-specific duration. The Companion flash option is independent of
Tech Hub’s “Flash on multiple clicks” setting.

Arrow buttons work even when Limitimer is disabled. Disconnected arrows have a
red background. Reconnecting does not replay the last stored cue.
Cues are sampled at the poll interval: if several arrive between requests, the
latest one is displayed. This is a status display, not a lossless cue recorder.

## Variables for custom buttons

With a connection labeled techhub, use:

| Variable | Example |
| --- | --- |
| $(techhub:minutes) | 09 |
| $(techhub:seconds) | 47 |
| $(techhub:time) | 09:47 |
| $(techhub:total_seconds) | 587 |
| $(techhub:sign) | Minus sign in overtime, otherwise empty |
| $(techhub:program_2_time) | Program 2 clock |
| $(techhub:cue_direction) | next, previous, or empty |

Use the actual connection label if you renamed it. All four programs expose
minutes, seconds, time, sign, total_seconds, running, and signal.
Minutes are total minutes (61:01 after an hour); seconds are 00–59. The minus
sign is included in minutes during overtime. The clock follows Tech Hub’s
stop-at-zero setting.

The timer’s last measured time is shown; the module does not invent ticks between
hardware updates. Missing/disconnected/stale timer data displays --:--.
The stale timeout defaults to 10 seconds without a new timer packet or heartbeat
and can be adjusted. Arrow status is independent of timer freshness.

## Troubleshooting

- Use the D’san service port, not the master-page port or internal backend port.
- Allow Companion to reach Tech Hub’s D’san TCP port through the host firewall.
- Incorrect passwords retry once per minute to avoid login lockouts.
- “Limitimer disabled/waiting/stale” describes the timer; PerfectCue may still be connected.
- No timer control actions are provided.
