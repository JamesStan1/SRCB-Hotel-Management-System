"use client";

import { useEffect } from "react";

export default function DevUnhandledLogger() {
  useEffect(() => {
    const handler = (ev) => {
      try {
        // Log structured details to help trace where an Event was thrown
        console.groupCollapsed("Unhandled Rejection Captured (dev logger)");
        console.log("reason type:", typeof ev.reason, ev.reason);
        // If reason is an Event, log its type and target
        if (ev.reason instanceof Event) {
          console.log("Event type:", ev.reason.type);
          console.log("Event target:", ev.reason.target);
        }
        // If reason is an Error-like object, attempt to log stack
        if (ev.reason && ev.reason.stack) console.log("stack:", ev.reason.stack);
        // If it's a Response or other object, try to inspect
        try {
          console.log("full reason:", JSON.parse(JSON.stringify(ev.reason)));
        } catch (e) {
          console.log("reason (raw):", ev.reason);
        }
        console.groupEnd();
      } catch (e) {
        // avoid throwing inside handler
        console.error("DevUnhandledLogger error:", e);
      }
    };

    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

  return null;
}
