import { redirect } from "next/navigation";

export default function Home() {
  // For MVP, redirect to Build mode
  redirect("/build");
}
