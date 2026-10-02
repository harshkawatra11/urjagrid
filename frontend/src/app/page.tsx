import { redirect } from "next/navigation";

/** Landing route. Lane D owns the dashboard pages; this just sends visitors to the command centre. */
export default function RootPage() {
  redirect("/command");
}
