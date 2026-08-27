import Link from "next/link";

export const dynamic = "force-dynamic";

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "Live board — your main screen",
    body: [
      "The live board refreshes itself every 5 seconds. Keep it open on the dispatch desk.",
      "MISSED — CALL NOW (red): guards who did not upload in time. Call them immediately — the card shows name, site, phone (with a Copy button), when they were pinged, when they missed, and their last GPS with a map link.",
      "WAITING FOR PHOTO (orange): guards inside their 5-minute upload window, with a live countdown.",
      "ON DUTY — OK (green): guards whose last check-in was fine, with the countdown to their next ping.",
      "Click 'Enable browser alerts' once in the header so missed check-ins also pop up as system notifications, even when you are in another tab.",
    ],
  },
  {
    title: "When a guard misses a check-in",
    body: [
      "A red CALL NOW — MISSED UPLOAD card appears on the live board and a toast pops up immediately.",
      "Use the Copy button next to the phone number and call the guard.",
      "Click Details to see the full check-in: every timestamp, the media (if any arrived late), and GPS points.",
      "If the guard uploads after the deadline, the check-in turns LATE and you get a 'Late check-in received' notification.",
    ],
  },
  {
    title: "Ping now (manual check)",
    body: [
      "On any ON DUTY card, click 'Ping now' to send an immediate check-in ping outside the normal 15-minute schedule.",
      "The guard then has the usual 5 minutes to respond with live camera media.",
    ],
  },
  {
    title: "Missed page",
    body: [
      "Dispatch → Missed lists every missed and late check-in from the last 7 days with phone numbers, timestamps, last GPS and a Details link.",
    ],
  },
  {
    title: "Guards page",
    body: [
      "Lists every registered guard, their phone number, and whether their profile is complete (full name + phone).",
      "Guards with an incomplete profile cannot start a shift — tell them to finish the steps in their guard panel.",
      "Guards register themselves at /register; you do not create guard accounts here.",
    ],
  },
  {
    title: "Sites page",
    body: [
      "Sites are created automatically when a guard types a new site name at shift start.",
      "You can also add a site manually, or deactivate one you no longer use (history keeps the name).",
    ],
  },
  {
    title: "24h report",
    body: [
      "Shows every shift in the window per guard + site: shift times, OK / late / missed counts, and the exact missed times.",
      "Use the 'Last 24 hours' and 'Last 7 days' buttons to switch the window.",
      "The same report is delivered automatically to every admin at 7:00 AM Toronto time as an in-app notification (and email if SMTP is configured).",
    ],
  },
  {
    title: "Check-in details",
    body: [
      "From any card or table, click Details to open one check-in.",
      "You see the media with a source verdict: LIVE CAPTURE (proven fresh), UNVERIFIED STILL (camera app photo without proof — ask the guard to prefer live video), and every timestamp: ping sent, deadline, responded, server recorded, EXIF capture time if present.",
      "GPS points show both the phone's clock and the server's clock, accuracy, and whether it was a one-time pin or live tracking.",
    ],
  },
  {
    title: "Security page (anti-cheat)",
    body: [
      "Dispatch → Security lists every anti-cheat flag from the last 7 days.",
      "Time cheating is impossible by design: all deadlines use the SERVER clock, so changing the phone's time never extends a window. A badly wrong device clock is still flagged.",
      "Each shift is bound to the phone and network it started on. If a different device or a new IP address answers mid-shift (VPN, someone else doing the check-ins), you get a flag — device changes are CRITICAL.",
      "GPS points are checked for impossible jumps (teleporting), mock-provider signatures (perfect accuracy), and replayed fixes with wrong timestamps.",
      "Rejected upload attempts (gallery files, reused files, over-length videos, file-picker uploads) are logged as flags too, so you can see who TRIED to cheat even though the upload never counted.",
      "Guards with flags show a red ⚠ badge on the live board — click it to review.",
    ],
  },
  {
    title: "Admins page",
    body: [
      "Add a new admin with name, email and password. Every admin receives every notification.",
      "Remove admin access from a colleague (their account becomes a guard account). The last remaining admin can never be removed.",
    ],
  },
];

export default function AdminHelpPage() {
  return (
    <main>
      <h1 className="text-2xl font-black">How to use the dispatch admin panel</h1>
      <p className="mt-1 text-sm text-muted">
        Everything dispatch needs to run wellness check-ins without phone-call rounds.
      </p>

      <div className="mt-4 space-y-3">
        {SECTIONS.map((s) => (
          <section key={s.title} className="rounded-xl border border-line bg-surface p-4">
            <h2 className="font-black text-warn">{s.title}</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {s.body.map((line, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-muted">•</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-6 rounded-xl border-2 border-danger bg-danger/10 p-4 text-sm">
        <p className="font-black text-danger">The one rule that matters</p>
        <p className="mt-1">
          When a red CALL NOW card appears, call the guard right away. The whole
          system exists so you find out within seconds — not at the end of the
          hour — that someone may be asleep or in trouble.
        </p>
      </div>

      <p className="mt-6 text-center">
        <Link href="/dispatch" className="font-bold text-accent underline">
          Back to the live board
        </Link>
      </p>
    </main>
  );
}
