# Device data inventory

What the connected diabetes devices expose, what Stedio shows of it today, where it should show and how it helps.
Guy, 12 Nov 2026: "every piece of data the source exposes needs a place in the app, and we need to see how it helps the
patient." Field names come from a read-only inspection on the Mac on 12 Nov 2026 (names, types and enum values only;
no personal values). Apple Health is included at Guy's request (apps such as Fitness write to it).

Status words: **shown** (in the app today), **stored** (kept on the server, not shown), **not read** (available from
the source, unused). Rated device lives and change intervals are marked *verify*: they must come from the maker's
labelling before any reminder uses them (no invented thresholds).

## CareLink (MiniMed 780G with Guardian 4 / Simplera)

### display/message (polled every 5 minutes)

| Field | Status | Where it should show | How it helps |
|---|---|---|---|
| `sgs[]`, `lastSG`, `lastSGTrend` | shown | Companion, Overview, Journal | The glucose record itself |
| `markers` INSULIN (`deliveredFastAmount`, `activationType`, `bolusType`, `completed`) | shown | Journal (bolus kind, carbs) | Bolus history; meal-to-bolus timing insights |
| `markers` MEAL (`amount`) | shown | Journal, meal linking (G-47) | Carb entries; carb mismatch insights |
| `markers` AUTO_BASAL_DELIVERY (`bolusAmount`, about 150 a day) | not read | Overview: automatic insulin per day; Journal detail of a moment | How much SmartGuard adds on its own, by time of day |
| `markers` LOW_GLUCOSE_SUSPENDED (`deliverySuspended`) | not read | Journal row "Insulin paused"; suspend insight | Suspends seen directly, not only through alerts |
| `markers` AUTO_MODE_STATUS | not read | Journal row; Overview: time in SmartGuard | When and how often SmartGuard is off |
| `notificationHistory`, `lastAlarm` (`faultId`, `type`, `additionalInfo.unitsRemaining`, `alertSilenced`) | shown (G-57) | Journal "Alerts" filter | Every pump alert, named; alert insights |
| `activeInsulin.amount` | shown (G-59) | Companion header beside the latest reading, read-only "from the pump" | The pump's own active insulin when the person looks at glucose |
| `reservoirRemainingUnits`, `reservoirLevelPercent` | shown (G-59) | Devices > CareLink status card | Reservoir state without the pump in hand; refill pattern |
| `pumpBatteryLevelPercent` | shown (G-59) | Devices status card | Battery state |
| `pumpSuspended` | shown (G-59) | Devices status card, Companion note | Insulin delivery paused right now |
| `sensorDurationHours/Minutes`, `sensorLifeText` | shown, hours (G-59) | Devices status card; sensor change insight | Sensor life left; how long each sensor lasts |
| `calibStatus`, `timeToNextCalib*`, `calFreeSensor` | not read | Devices status card | When a calibration is due (Guardian 4 needs none) |
| `gstBatteryLevel`, `gstCommunicationState` | shown, battery (G-59) | Devices status card | Transmitter charge and link |
| `conduitInRange`, `conduitSensorInRange`, `conduitMedicalDeviceInRange`, `conduitBatteryLevel` | shown (G-59) | Devices status card | Why data stopped: phone away from pump, sensor out of range |
| `sensorState`, `systemStatusMessage` | shown, six known states (G-59) | Devices status card in plain words | Sensor warm-up, change sensor, signal loss |
| `therapyAlgorithmState` (`autoModeShieldState`, `autoModeReadinessState`, `plgmLgsState`) | shown, shield state (G-59) | Devices status card | SmartGuard on or off and why |
| `limits[]` (`lowLimit`, `highLimit`) | used | Target range when none typed (G-48) | Range for insights |
| `maxAutoBasalRate`, `maxBolusAmount` | used | Treatment settings, read-only (G-48) | Pump settings shown from the source |
| `averageSG`, `timeInRange`, `aboveHyperLimit`, `belowHypoLimit` | not read | Not needed: computed from readings | (Check our numbers against the pump's) |
| `medicalDeviceInformation` (model, firmware) | stored (model) | Devices detail | Which pump and firmware |

### personalWebView (30-day history, about daily)

| Field | Status | Where it should show | How it helps |
|---|---|---|---|
| `Agg1d[].sg.sgVal` | shown | All glucose views | 30 days of readings |
| `Agg1d[].setChange` | not read | Journal row "Set changed"; set change insight | Real set change dates: interval, reminder when overdue (*verify* the set's rated days) |
| `Agg7d/14d/30d.avgSetChange` | not read | Set change insight | The person's usual interval |
| `tdd` (total daily dose) | shown (G-60) | Overview: insulin per day | Daily insulin trend |
| `autoMode`, `autoModeExit` | shown (G-60) | Overview: time in SmartGuard; exits per day | SmartGuard use and exits |
| `sensorUsage` | shown (G-60) | Overview: sensor wear time | Gaps in sensor wear |
| `bg.avg`, `sg.sd` | not read | Overview (variability) | Glucose variability |
| `hypoPattern[]`, `hyperPattern[]` (`episodes[]` with `category`, `duration`, `startTS`) | not read | Insights | The pump's own recurring lows and highs by time |
| `sensorOverlay` (mean, 5/25/75/95 percentiles) | not read | Overview chart (daily profile) | A one-glance typical day |
| `tirTrend` | not read | Overview | Range trend the pump shows |

## LibreLinkUp (follower account)

| Field | Status | Where it should show | How it helps |
|---|---|---|---|
| `graphData[]`, `glucoseMeasurement` (`ValueInMgPerDl`, `FactoryTimestamp`, `TrendArrow`) | shown | All glucose views | The glucose record |
| `isHigh`, `isLow`, `MeasurementColor` | not read | Not needed (our own range) | — |
| logbook (`type`, scans) | shown (values) | Journal | Older readings; carries no alarm fields |
| `connection.targetLow/targetHigh` | not read | Target range when none typed, read-only like the pump's (G-48) | The range set in the Libre app |
| `alarmRules` (high/low on and thresholds), `patientDevice.ll/hl`, `fixedLowAlarmValues` | not read | Treatment settings, read-only | The alarm limits set in the Libre app |
| `sensor` (`sn`, `a` activation time, `pt`), `activeSensors[]` | not read | Devices status card; sensor change insight | Sensor start: life left, and sensors ending early (*verify* rated days per model) |
| `ticket` (refreshed token) | not used | Kept with the sign-in | Fewer sign-ins (less lockout risk) |

## Dexcom Share

Readings and trend only (`Value`, `Trend`, `WT`). No alerts, sensor or settings fields.

## Tandem Source (G-65, 13 Nov 2026)

Reading only. `bff/pumper`: pumps (model, last upload; serial number not kept), the account's low/high range, the active
profile (carb ratio, correction factor, target BG, basal by time, insulin duration, max bolus) and CGM alert limits.
`bff/pump-logs`: CGM readings (shown), bolus requests and completions (insulin and carbs records), cannula and
cartridge fills, CGM session starts, alarms, alerts, malfunctions, CGM alerts, suspend and resume (journal, Alerts
filter). Read but not shown yet: basal, target BG, insulin duration, max bolus. Not read: basal delivery, daily
status, Control-IQ mode changes (sleep, exercise), BG meter readings.

## Apple Health (read today, 13 types)

Glucose, insulin delivery, heart rate, resting heart rate, HRV, steps, distance, active energy, workouts, sleep,
weight, blood oxygen, dietary carbohydrates. Shown: glucose, heart rate beside readings, workouts and steps
(activity insights). Not read yet and useful: menstrual flow (the profile already asks about the cycle), dietary
protein and fat (late-rise insight, G-54), exercise minutes, VO2 max, respiratory rate, wrist temperature, alcoholic
beverages. Each new type needs a new permission on the phone.

## Order proposed

1. Set and sensor changes: CareLink `setChange` and sensor life, LibreLinkUp sensor activation: journal rows,
   intervals, an overdue reminder, sensors ending early (needs the rated days from the makers).
2. A device status card (reservoir, battery, sensor life, transmitter, SmartGuard state, in range).
3. Active insulin beside the latest reading, read-only from the pump.
4. Overview: insulin per day, automatic insulin, time in SmartGuard, sensor wear.
5. SmartGuard and suspend rows in the journal from the markers.
6. Libre targets and alarm limits as read-only settings.
