import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: true,
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png", "pwa-512x512-maskable.png"],
      manifest: {
        name: "MY LIBERTY International English School",
        short_name: "MY LIBERTY",
        description:
          "MY LIBERTY International English School Academic & Operations Portal — attendance, classes, student progress, and operations",
        theme_color: "#1a3a8f",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-512x512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        shortcuts: [
          {
            name: "Classroom Photo",
            short_name: "Class Photo",
            description: "Snap classroom moment and share to WhatsApp",
            url: "/?action=class-photo",
            icons: [{ src: "pwa-192x192.png", sizes: "192x192" }],
          },
          {
            name: "Attendance Kiosk",
            short_name: "Attendance",
            description: "Open QR badge scanner for student check-in",
            url: "/?action=attendance",
            icons: [{ src: "pwa-192x192.png", sizes: "192x192" }],
          },
          {
            name: "Register Student",
            short_name: "Register",
            description: "Open online student registration form",
            url: "/register",
            icons: [{ src: "pwa-192x192.png", sizes: "192x192" }],
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,jpg,webp,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/],
        // Do NOT cache database calls or external APIs to avoid data/payment discrepancies
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: "module",
        suppressWarnings: true,
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // Without this, Rollup lumps all of Firebase into one ~620kB chunk
        // that every role has to download before anything renders, which is
        // what kept triggering the >500kB warning. Splitting by library lets
        // the browser cache each piece separately and skip the ones a given
        // screen never touches — the QR scanner is only needed on the kiosk,
        // the QR generator only on badges.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("/firebase/firestore") || id.includes("@firebase/firestore"))
            return "vendor-firestore";
          if (id.includes("/firebase/auth") || id.includes("@firebase/auth"))
            return "vendor-firebase-auth";
          if (id.includes("@firebase") || id.includes("/firebase/")) return "vendor-firebase-core";
          if (id.includes("html5-qrcode")) return "vendor-qr-scanner";
          if (id.includes("/qrcode/")) return "vendor-qr-generator";
          if (id.includes("react-dom") || id.includes("/react/")) return "vendor-react";
        },
      },
    },
  },
});
