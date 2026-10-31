"use client";

import { ErrorScreen } from "@/components/error-screen";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorScreen digest={error.digest} retry={retry} message={`${error.name}: ${error.message}`}/>;
}
