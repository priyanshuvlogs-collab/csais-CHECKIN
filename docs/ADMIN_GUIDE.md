# CSAIS Dispatch Admin Panel — User Guide

This guide is for dispatch operators and supervisors. The admin panel is the
control room: it shows every guard on duty, alerts you the moment someone
misses a check-in, and produces the daily report.

The same guide is available inside the app under **Dispatch → Help**.

---

## 1. Log in

1. On the home page choose **ADMIN LOGIN** (or go to `/admin/login`).
2. Enter your admin **email** and password.
   - The seeded first admin is `admin@csais.local` / `ChangeMe!123` — change
     this password in production.
3. You land on the **Live board**. Guards can never see this panel; admins are
   redirected here automatically.

First thing after logging in: click **Enable browser alerts** in the header so
missed check-ins pop up as system notifications even when you are in another
tab or window.

## 2. Live board (main screen)

The board **refreshes itself every 5 seconds** — keep it open on the dispatch
desk. It has three sections:

### 🔴 MISSED — CALL NOW
Guards who did not upload within their 5-minute window. Each red card shows:

- **Name**, **Site**
- **Phone** with a **Copy** button — copy it and call the guard NOW
- **Pinged at** and **Missed at** timestamps
- **Last GPS** with an **Open map** link (Google Maps)
- **Details** link to the full check-in record

A red toast also pops up in the corner the moment a miss happens, plus a
browser notification if enabled.

### 🟠 WAITING FOR PHOTO
Guards currently inside their 5-minute upload window, with a live countdown,
site and phone. No action needed unless the countdown reaches zero.

### 🟢 ON DUTY — OK
Guards whose last check-in was fine. Shows the countdown to their next ping,
when their shift started, their last GPS, and two buttons:

- **Ping now** — send an immediate, out-of-schedule check-in ping (the guard
  gets the usual 5 minutes). Use it when something feels off.
- **Map** — open the guard's last position.

Empty states are normal: "No one on duty", "No missed check-ins".

## 3. When a guard misses — the drill

1. Red **CALL NOW — MISSED UPLOAD** card + toast appear within seconds.
2. Click **Copy** next to the phone number, call the guard.
3. Click **Details** if you need context: all timestamps, last GPS, and any
   media that arrived late.
4. If the guard uploads after the deadline, the check-in flips to **LATE** and
   you receive a "Late check-in received" notification — the card clears from
   the missed section.

## 4. Check-in details page

From any card, table or notification, open a check-in to see:

- The **media** itself (photo or video, playable in the browser)
- The **source verdict**:
  - **LIVE CAPTURE** — proven fresh (in-page camera or EXIF time inside the
    ping window)
  - **UNVERIFIED STILL** — camera-app photo without EXIF proof; ask the guard
    to prefer live video
- Every timestamp: ping sent, deadline, responded (+ seconds taken), server
  recorded, EXIF capture time if present, file hash
- **GPS points** with both the phone clock and the server clock, accuracy,
  and one-time vs live tracking

## 5. Missed page

**Dispatch → Missed** lists every missed and late check-in from the last
7 days in one table: guard, phone, site, timestamps, last GPS, details link.
Use it for morning follow-ups and discipline records.

## 6. Guards page

- Every registered guard with phone number and **profile completeness**.
- Guards with an incomplete profile (missing phone or unconfirmed full name)
  **cannot start a shift** — tell them to finish the steps in their panel.
- Shows who is currently ON DUTY and where.
- Guards register themselves at `/register`; you do not create guard accounts.

## 7. Sites page

- Sites are created automatically when a guard types a new site name at shift
  start.
- Add a site manually, or **Deactivate** one you no longer use — history keeps
  the site name on old shifts.

## 8. 24h report

**Dispatch → 24h report** shows, per guard + site: shift start/end, OK / Late
/ Missed counts, and the exact missed times. Switch between **Last 24 hours**
and **Last 7 days**.

The same report is **delivered automatically to every admin at 7:00 AM
Toronto time** as an in-app notification (and by email when SMTP is
configured in `.env`).

## 9. Security page (anti-cheat)

**Dispatch → Security** lists every anti-cheat flag from the last 7 days.
Guards with flags also show a red **⚠ n** badge on their live-board card.

What the system detects and how:

| Cheat attempt | Defence |
| --- | --- |
| Changing the phone clock to get more time | Impossible by design — all deadlines and timestamps use the **server clock**. A device clock off by more than 3 minutes is additionally flagged (`clock_skew`). |
| Sending an old/gallery photo | Rejected before it counts (EXIF capture time and file `lastModified` must not predate the ping) and logged as `gallery_rejected`. |
| Reusing the same photo/video twice | Rejected by file-hash matching and logged as `reused_media_rejected`. |
| Uploading via a normal file picker | Rejected and logged as `file_picker_rejected`. |
| Handing the link to someone off-site / VPN switching | Each shift is bound to the IP it started from; a new IP mid-shift raises `ip_change` (warn — WiFi→cellular can also cause this, use judgement). |
| Someone else answering pings on another phone | Each shift is bound to the starting device (browser device-id + user agent); a different device mid-shift raises `device_change` (**critical**). |
| Fake/mock GPS apps | GPS jumps faster than ~150 km/h raise `impossible_speed` (**critical**); perfect 0 m accuracy raises `mock_gps`; replayed fixes with wrong timestamps raise `gps_time_mismatch`. |

Critical flags alert every admin immediately, like a missed check-in.

## 10. Admins page

- **Add an admin** with full name, email (their login) and a password.
- **Every admin receives every notification** — there is no per-site split.
- **Remove admin** turns that account into a guard account. You cannot remove
  yourself, and the last remaining admin can never be removed.

## 11. Notifications you will receive

| Event | What it means |
| --- | --- |
| CALL NOW — MISSED UPLOAD | Guard missed the 5-minute window. Call them. |
| Late check-in received | A missed/overdue guard finally uploaded. |
| On duty / Shift ended | A guard started or ended a shift. |
| Shift auto-ended after 12 hours | Guard forgot to end their shift. |
| First GPS this shift / Moved ≥ 50 m | Location updates worth knowing. |
| Manual ping sent | An admin used Ping now. |
| Daily 24h report | The 7:00 AM summary. |

All of them appear as toasts on the live board, in the unread counter, as
browser notifications (if enabled), and as email (if SMTP is configured).
