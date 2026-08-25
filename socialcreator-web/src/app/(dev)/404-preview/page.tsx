import { notFound } from "next/navigation";

export default function NotFoundPreviewPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  notFound();
}
