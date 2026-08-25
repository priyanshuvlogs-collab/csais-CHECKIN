import { LiveBoard } from "@/components/dispatch/LiveBoard";

export const dynamic = "force-dynamic";

export default function DispatchPage() {
  return (
    <main>
      <h1 className="sr-only">Live duty board</h1>
      <LiveBoard />
    </main>
  );
}
