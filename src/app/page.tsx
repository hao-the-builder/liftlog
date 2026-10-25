import { redirect } from "next/navigation";

/** The app opens on Today. Signed-out visitors are sent to /login by the proxy. */
export default function RootPage() {
  redirect("/today");
}
