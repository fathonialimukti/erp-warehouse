import { configureEcho } from "@laravel/echo-react";
import Pusher from "pusher-js";

// Extend Window interface for Pusher
declare global {
  interface Window {
    Pusher: typeof Pusher;
  }
}

// Make Pusher available globally for Laravel Echo
window.Pusher = Pusher;

// Configure Echo for Laravel Reverb
configureEcho({
  broadcaster: "reverb",
  key: import.meta.env.VITE_REVERB_APP_KEY || "",
  wsHost: import.meta.env.VITE_REVERB_HOST || window.location.hostname,
  wsPort: import.meta.env.VITE_REVERB_PORT
    ? parseInt(import.meta.env.VITE_REVERB_PORT)
    : 8080,
  wssPort: import.meta.env.VITE_REVERB_PORT
    ? parseInt(import.meta.env.VITE_REVERB_PORT)
    : 8080,
  forceTLS: import.meta.env.VITE_REVERB_SCHEME === "https",
  enabledTransports: ["ws", "wss"],
  authEndpoint: `${import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:8000"}/broadcasting/auth`,
  auth: {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("auth_token") || ""}`,
      Accept: "application/json",
    },
  },
});
