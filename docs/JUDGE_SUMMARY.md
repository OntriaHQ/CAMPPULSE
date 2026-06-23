# CampPulse — Judge Summary

**CampPulse** is a real-time camp operations platform for Redemption City (RCCG), connecting residents, drivers, and camp administrators through live incident reporting, congestion intelligence, and ride coordination.

## Core Features

**Incident Reporting (Resident App)**
Residents report issues (flooding, security, sanitation, road damage, etc.) with photo, location, and severity directly from their phone. Reports auto-route to the right department and get tracked through resolution.

**Live Camp Map**
Real-time map showing active incidents, driver locations, and congestion hotspots — visible to both residents (guest view) and admins (full operational view).

**Congestion Detection & Decongestion Tips**
A two-stage detection engine (flag → confirm) monitors live foot-traffic density per zone using anonymized location pings. When a zone gets busy, the system automatically broadcasts real-time alerts and actionable tips ("Zone B is busy — avoid this area") to everyone nearby — no manual monitoring needed.

**Ride-Hailing**
Residents can request a ride (bicycle/tricycle/car/van) to anywhere in camp. The system finds the nearest available driver, calculates fare and ETA, and tracks the full trip lifecycle live — request → accept → in progress → complete — with real-time push updates to both rider and driver.

**Emergency Dispatch**
Critical incidents (security, medical) automatically find and assign the nearest available driver/vehicle, with live ETA — no admin intervention required for urgent cases.

**Admin Dashboard**
Camp administrators get a live operations center: incident heatmap, congestion zone status board, driver fleet view, response team management, analytics, and camp-wide broadcast announcements — all updating in real time via WebSocket.

**Real-Time Notifications**
Zone-wide broadcasts, congestion alerts, and incident updates reach residents instantly, in-app and via push.

## What Makes It Different

- **Built for the specific scale of a camp/event**, not a city — tuned for dense, temporary populations
- **Fully real-time**: every layer (map, congestion, rides, dispatch) updates live via WebSocket, not polling
- **No infrastructure dependency**: works without expensive third-party routing APIs (built-in fallback routing)
- **One platform, three roles**: residents, drivers, and admins all served by the same live data layer
