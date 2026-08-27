import Link from "next/link";

export const dynamic = "force-dynamic";

const STEPS: { title: string; body: string[] }[] = [
  {
    title: "1. Log in to the guard panel",
    body: [
      "Go to the CSAIS website and tap GUARD LOGIN.",
      "Enter your mobile phone number and your password.",
      "New guard? Tap Register and enter your first AND last name, your mobile number, and a password.",
    ],
  },
  {
    title: "2. Start your shift when you arrive on post",
    body: [
      "Type the site name where you are posted (example: Costco).",
      "Tap the big START SHIFT button.",
      "Your start time is saved automatically. You will see the ON DUTY card with your name, site, start time, time on duty, and the countdown to your next check-in.",
    ],
  },
  {
    title: "3. Answer every check-in ping",
    body: [
      "The first ping arrives about 15 seconds after you start. After that, one ping every 15 minutes.",
      "When the orange CHECK-IN REQUIRED banner appears, you have 5 minutes (the TIME LEFT timer counts down).",
      "Tap TAKE PHOTO or RECORD VIDEO (max 45 seconds) using your camera. A short live video is the strongest proof.",
      "If the in-page camera does not start, use the 'phone camera app' button — it opens your camera directly.",
      "IMPORTANT: photos from your gallery, old photos, or files are REJECTED. Only a fresh camera capture counts.",
    ],
  },
  {
    title: "4. What happens if you miss",
    body: [
      "If the 5 minutes run out with no photo or video, the check-in is marked MISSED.",
      "Every dispatch admin is alerted immediately with your name, site, and phone number.",
      "Expect a phone call. Stay by your phone. The next ping still arrives on schedule.",
    ],
  },
  {
    title: "5. Send your location (optional)",
    body: [
      "Tap 'Send GPS once' to send your position one time.",
      "Tap 'Start live location' to keep sending your position while you patrol.",
      "GPS never replaces the camera check-in — the photo or video is always required.",
    ],
  },
  {
    title: "6. End your shift when you leave",
    body: [
      "Tap END SHIFT at the bottom of the on-duty screen and confirm.",
      "Pings stop right away. If you forget, the shift ends automatically after 12 hours.",
      "You can review your own check-ins for today under 'My check-ins today'.",
    ],
  },
];

export default function GuardHelpPage() {
  return (
    <main>
      <h1 className="text-2xl font-black">How to use the guard panel</h1>
      <p className="mt-1 text-sm text-muted">
        Keep this page open on your first shift if you are unsure what to do next.
      </p>

      <ol className="mt-4 space-y-3">
        {STEPS.map((s) => (
          <li key={s.title} className="rounded-xl border border-line bg-surface p-4">
            <h2 className="font-black text-accent">{s.title}</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {s.body.map((line, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-muted">•</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      <div className="mt-6 rounded-xl border-2 border-warn bg-warn/10 p-4 text-sm">
        <p className="font-black text-warn">Golden rules</p>
        <p className="mt-1">
          Keep this page open and your phone unlocked while on duty. Answer every
          ping within 5 minutes with a fresh camera photo or video. If anything
          goes wrong, dispatch will call you — answer the phone.
        </p>
      </div>

      <p className="mt-6 text-center">
        <Link href="/app" className="font-bold text-accent underline">
          Back to my shift
        </Link>
      </p>
    </main>
  );
}
