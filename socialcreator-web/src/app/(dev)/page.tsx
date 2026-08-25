import { notFound, redirect } from "next/navigation";

export default function DevPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }
  redirect("/dev/pages");
}
