"use client";

import { useSyncExternalStore } from "react";
import { formatLocal, formatUtc } from "@/lib/formatting";

const subscribe = () => () => {};

/** Renders in the viewer's locale in the browser; deterministic UTC during server render. */
export function LocalTime({ iso }: { iso: string }) {
  const text = useSyncExternalStore(
    subscribe,
    () => formatLocal(iso),
    () => formatUtc(iso),
  );
  return <time dateTime={iso}>{text}</time>;
}
