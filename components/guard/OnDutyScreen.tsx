"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CameraCapture } from "./CameraCapture";
import { fmtCountdown, fmtElapsed, fmtTime } from "@/lib/time";
import { deviceHeaders } from "@/lib/deviceId";

type GuardState = {
  serverNow: string;
  profile: { name: string; phone: string | null };
  shift: { id: string; siteName: string; startedAt: string; nextPingAt: string | null } | null;
  pendingCheckin: { id: string; sentAt: string; deadlineAt: string } | null;
  lastCheckin: { id: string; status: string; sentAt: string; respondedAt: string | null } | null;
};

export function OnDutyScreen() {
  const router = useRouter();
  const [state, setState] = useState<GuardState | null>(null);
  const [clockOffset, setClockOffset] = useState(0); // serverNow - clientNow, ms
  const [now, setNow] = useState(Date.now());
  const [flash, setFlash] = useState<{ kind: "ok" | "warn" | "danger"; text: string } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const [liveWatchId, setLiveWatchId] = useState<number | null>(null);
  const [ending, setEnding] = useState(false);
  const lastGpsPostRef = useRef(0);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/guard/state", { cache: "no-store" });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data: GuardState = await res.json();
      setClockOffset(new Date(data.serverNow).getTime() - Date.now());
      setState(data);
      if (!data.shift) {
        if (liveWatchId != null) navigator.geolocation.clearWatch(liveWatchId);
        router.push("/app");
      }
    } catch {
      // Network blip — keep the last known state; next poll retries.
    }
  }, [router, liveWatchId]);

  useEffect(() => {
    poll();
    const p = setInterval(poll, 4000);
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => {
      clearInterval(p);
      clearInterval(t);
    };
  }, [poll]);

  // Stop the live GPS watch when leaving the page.
  useEffect(() => {
    return () => {
      if (liveWatchId != null) navigator.geolocation.clearWatch(liveWatchId);
    };
  }, [liveWatchId]);

  const serverNow = now + clockOffset;

  async function postGps(pos: GeolocationPosition, isLive: boolean, livePeriod: number | null) {
    const res = await fetch("/api/gps", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...deviceHeaders() },
      body: JSON.stringify({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? null,
        heading: Number.isFinite(pos.coords.heading) ? pos.coords.heading : null,
        isLive,
        livePeriod,
        clientAt: new Date(pos.timestamp).toISOString(),
        checkinId: state?.pendingCheckin?.id ?? null,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setGpsStatus(`GPS sent at ${fmtTime(new Date())}. ${isLive ? "Live location is ON." : ""}`);
    } else {
      setGpsStatus(data.error || "GPS failed.");
    }
  }

  function sendGpsOnce() {
    if (!navigator.geolocation) {
      setGpsStatus("This device does not support GPS in the browser.");
      return;
    }
    setGpsStatus("Getting your position...");
    navigator.geolocation.getCurrentPosition(
      (pos) => postGps(pos, false, null),
      (err) => setGpsStatus(`Could not get GPS: ${err.message}. Check location permission.`),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }

  function toggleLiveGps() {
    if (liveWatchId != null) {
      navigator.geolocation.clearWatch(liveWatchId);
      setLiveWatchId(null);
      setGpsStatus("Live location stopped.");
      return;
    }
    if (!navigator.geolocation) {
      setGpsStatus("This device does not support GPS in the browser.");
      return;
    }
    setGpsStatus("Starting live location...");
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        // Throttle live points to one every 20 seconds.
        if (Date.now() - lastGpsPostRef.current < 20000) return;
        lastGpsPostRef.current = Date.now();
        postGps(pos, true, 20);
      },
      (err) => setGpsStatus(`Live location error: ${err.message}`),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    setLiveWatchId(id);
  }

  async function onEndShift() {
    if (!confirm("End your shift now? Check-in pings will stop.")) return;
    setEnding(true);
    if (liveWatchId != null) {
      navigator.geolocation.clearWatch(liveWatchId);
      setLiveWatchId(null);
    }
    const res = await fetch("/api/shift/end", { method: "POST" });
    setEnding(false);
    if (res.ok) {
      router.push("/app");
      router.refresh();
    }
  }

  if (!state || !state.shift) {
    return (
      <div className="rounded-xl border border-line bg-surface p-8 text-center text-muted">
        Loading your shift...
      </div>
    );
  }

  const shift = state.shift;
  const pending = state.pendingCheckin;
  const onDutyMs = serverNow - new Date(shift.startedAt).getTime();
  const missedJustNow =
    state.lastCheckin?.status === "missed" && !pending;

  return (
    <main className="space-y-4">
      {/* Check-in ping takes over the top of the screen. */}
      {pending ? (
        <section className="rounded-xl border-2 border-warn bg-surface p-4">
          <CheckinBanner deadlineAt={pending.deadlineAt} serverNow={serverNow} />
          <p className="mt-2 text-center font-semibold">
            Prove you are awake: take a live photo or video with your camera
            NOW. Do not use the gallery.
          </p>
          <div className="mt-4">
            <CameraCapture
              key={pending.id}
              checkinId={pending.id}
              onDone={({ status, message }) => {
                setFlash({ kind: status === "ok" ? "ok" : "warn", text: message });
                poll();
              }}
            />
          </div>
        </section>
      ) : (
        flash && (
          <FlashBox kind={flash.kind} text={flash.text} onClose={() => setFlash(null)} />
        )
      )}

      {missedJustNow && !flash && (
        <div className="rounded-xl border-2 border-danger bg-danger/10 p-4 text-center">
          <p className="text-xl font-black text-danger">CHECK-IN MISSED</p>
          <p className="mt-1 text-sm">
            Dispatch has been alerted and may call you at {state.profile.phone}.
            Stay by your phone. The next ping will arrive on schedule.
          </p>
        </div>
      )}

      {/* ON DUTY card */}
      <section className="rounded-xl border border-line bg-surface p-5">
        <div className="flex items-center justify-between">
          <span className="rounded bg-accent px-2 py-0.5 text-xs font-black text-black">
            ON DUTY
          </span>
          <span className="text-xs text-muted">Times shown in Toronto time</span>
        </div>
        <dl className="mt-3 space-y-2 text-lg">
          <Row label="Name" value={state.profile.name} />
          <Row label="Site" value={shift.siteName} />
          <Row label="Shift started at" value={fmtTime(shift.startedAt)} />
          <Row label="Time on duty" value={fmtElapsed(onDutyMs)} mono />
          {!pending && shift.nextPingAt && (
            <Row
              label="Next check-in in"
              value={fmtCountdown(new Date(shift.nextPingAt).getTime() - serverNow)}
              mono
              highlight
            />
          )}
        </dl>
        {!pending && (
          <p className="mt-3 text-sm text-muted">
            Next step: wait for the check-in ping. Keep this page open and keep
            your phone unlocked.
          </p>
        )}
      </section>

      {/* GPS card */}
      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="font-bold">Live location (optional)</h2>
        <p className="mt-1 text-sm text-muted">
          GPS helps dispatch find you. It does NOT replace the camera check-in.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={sendGpsOnce}
            className="rounded-lg border border-line bg-surface-2 px-3 py-3 font-bold"
          >
            Send GPS once
          </button>
          <button
            type="button"
            onClick={toggleLiveGps}
            className={`rounded-lg px-3 py-3 font-bold ${
              liveWatchId != null
                ? "bg-danger text-white"
                : "border border-accent text-accent"
            }`}
          >
            {liveWatchId != null ? "Stop live location" : "Start live location"}
          </button>
        </div>
        {gpsStatus && <p className="mt-2 text-sm text-muted">{gpsStatus}</p>}
      </section>

      <button
        type="button"
        onClick={onEndShift}
        disabled={ending}
        className="w-full rounded-lg border-2 border-danger px-4 py-4 text-lg font-black text-danger disabled:opacity-50"
      >
        {ending ? "Ending shift..." : "END SHIFT"}
      </button>
      <p className="text-center text-xs text-muted">
        Shifts end automatically after 12 hours.
      </p>
    </main>
  );
}

function CheckinBanner({ deadlineAt, serverNow }: { deadlineAt: string; serverNow: number }) {
  const left = new Date(deadlineAt).getTime() - serverNow;
  const urgent = left < 60_000;
  return (
    <div
      className={`rounded-lg p-3 text-center ${
        urgent ? "pulse-danger bg-danger text-white" : "bg-warn text-black"
      }`}
    >
      <p className="text-sm font-bold uppercase tracking-wide">Check-in required</p>
      <p className="font-mono text-4xl font-black">TIME LEFT {fmtCountdown(left)}</p>
    </div>
  );
}

function FlashBox({
  kind,
  text,
  onClose,
}: {
  kind: "ok" | "warn" | "danger";
  text: string;
  onClose: () => void;
}) {
  const styles =
    kind === "ok"
      ? "border-accent bg-accent/10 text-accent"
      : kind === "warn"
        ? "border-warn bg-warn/10 text-warn"
        : "border-danger bg-danger/10 text-danger";
  return (
    <div className={`flex items-start justify-between rounded-xl border-2 p-4 ${styles}`}>
      <p className="font-bold">{text}</p>
      <button type="button" onClick={onClose} className="ml-3 text-sm underline">
        Dismiss
      </button>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd
        className={`font-bold ${mono ? "font-mono" : ""} ${
          highlight ? "text-2xl text-accent" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
