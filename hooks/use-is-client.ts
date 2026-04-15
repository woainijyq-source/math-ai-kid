"use client";

import { useSyncExternalStore } from "react";

function subscribe(): () => void {
  return () => {};
}

export function useIsClient(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
