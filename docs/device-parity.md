# Device data parity (PM-633)

Guy, 27 Nov 2026: everything Stedio takes from MiniMed CareLink should also come from the other sources (Dexcom,
LibreLinkUp, Tandem Source, Apple Health / Health Connect) when they expose it. This matrix is from the code in
`services/api` on 27 Nov 2026 and the open clients each integration follows (pydexcom, libre-link-up-api-client,
tconnectsync). No live call was made to any account for it.

Words: **yes** (read and used today), **built 27 Nov** (added in this epic), **available, not built** (the source sends
it, Stedio does not use it yet; reason given), **no** (the source does not send it).

| Feature (what CareLink gives) | CareLink | LibreLinkUp | Dexcom Share | Tandem Source | Apple Health / Health Connect |
|---|---|---|---|---|---|
| Sensor readings | yes | yes | yes | yes | yes |
| Trend arrow | yes | yes (current reading) | yes | no (pump log has none) | no |
| Fingerstick (meter) readings | yes (G-83) | no | no | **built 27 Nov** (event 16, typed on the pump only; PM-634) | yes (the phone sends each sample as meter or sensor) |
| New sensor warm-up | yes (pump state, PM-631) | yes (`sensor.a` start + 60 min) | no (Share has no sensor start) | yes (session start event + sensor type) | no |
| "Sensor reads again" push | yes | yes | no | yes | no |
| Sensor updating (message 801) | yes | no | no | no | no |
| Sensor end time / reminder | yes (pump's own time left) | yes (start + rated days) | no | yes (start + rated days) | no |
| Sensor details sheet from Overview (PM-647) | yes: own time left, sensor status, transmitter battery, in range, start | start + estimate end | connection and last reading only | start + estimate end, sensor type | no |
| Sensor time left row on Overview | yes (pump's own) | **built 27 Nov** (start + rated days, Guy approved; PM-640) | no | **built 27 Nov** (same; PM-640) | no |
| Sensor ends early insight | yes | yes | no | yes | no |
| Set change / set reminder | yes (PM-327, PM-422) | n/a (sensor only) | n/a | yes (cannula fill) | no |
| Cartridge / reservoir change | live reservoir rise | n/a | n/a | yes (cartridge fill) | no |
| Pump and sensor alerts in the Journal | yes (G-57) | no (only alarm settings, no alert history) | no | yes (alarms, alerts, malfunctions, CGM alerts) | no |
| Device alert pushes (person's choices) | yes | no | no | yes (late: Tandem uploads are not live) | no |
| Insulin paused / resumed | yes | n/a | n/a | yes | no |
| Boluses and carbs | yes | n/a | n/a | yes | yes (insulin delivery, carbs) |
| Pump modes: Temp Target, temp basal | yes (PM-171) | n/a | n/a | available, not built: temp rate (565/564) is not in the events Tandem Source's web page asks for | no |
| Closed loop off (SmartGuard off / Control-IQ off) | yes (`manual`, `safe_basal`) | n/a | n/a | **built 27 Nov** (event 230, `loop_off`; PM-635) | no |
| Exercise / sleep activity | Temp Target only | n/a | n/a | yes (event 229) | workouts, sleep (separately) |
| Read-only target range (G-48) | yes (alert limits, SG Review range) | **built 27 Nov** (`connection.targetLow/targetHigh`, Libre app's target range; PM-636) | no | yes (CGM alert limits, Tandem Source range) | no |
| Treatment settings (ratios, basal program) | basal pattern + rate now | n/a | n/a | yes (active profile) | no |
| Active insulin beside the reading | yes (live) | n/a | n/a | available, not built: only in a fingerstick or daily-status event, hours old because uploads are not live; showing it as "now" would mislead | no |
| Pump status card (reservoir, battery, in range) | yes (live) | no | no | available, not built: daily status only, not live | no |
| Insulin per day, time in closed loop, sensor wear (Overview pump card) | yes (CareLink history) | n/a | n/a | available, not built: daily basal total (event 81) is not in the events Tandem Source's web page asks for, and adding events up would be our own derived number; needs a shape check on a real account first | no |
| Libre sensor model (Libre 2 vs 3 Plus rated days) | n/a | available, not built: `sensor.pt` product type has no public meaning; needs a shape check on a real account | n/a | from the CGM event code | no |
| Libre alarm limits (`alarmRules`, `patientDevice.ll/hl`) | n/a | available, not built: a read-only "alarm limits" view would be a new screen (design gap) | n/a | n/a | n/a |

## Dexcom

Dexcom Share (the Follow service) gives readings and trend only. Sensor sessions, alerts and device data exist only in
Dexcom's official API (developer.dexcom.com v3: `/devices`, `/events`, `/alerts`), which is delayed (1 hour in the US,
3 hours elsewhere) and needs a partner sign-up. Guy kept Share on 13 Nov 2026 because of that delay; with most users now
in the US (23 Nov), the official API could add sensor start (warm-up, sensor end, reminders) and alert history for Dexcom
users. Guy, 27 Nov 2026: no change, Dexcom stays on Share only.

## Order of deploys

The new Libre range source and the Control-IQ off mode need the strings `set.tg_src_libre`, `mode.loop_off` and
`mode.b_loop_off`. An app or website without them would show the raw key for a Libre range, so the OTA and the website
go out before the API.
