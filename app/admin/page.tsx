import { redirect } from "next/navigation";

/** Convenience alias: /admin always leads to the dispatch panel. */
export default function AdminIndex() {
  redirect("/dispatch");
}
