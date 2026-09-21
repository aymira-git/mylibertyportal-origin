/* global process */
import { defineConfig } from "vitest/config";

// The school runs on WITA (UTC+8). Pinning the test process to the same
// timezone keeps results identical on every machine (yours, the other
// agent's, GitHub Actions). Tests that need to prove "works on any device
// timezone" switch process.env.TZ themselves and restore it afterwards.
process.env.TZ = "Asia/Makassar";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.js"],
    restoreMocks: true,
  },
});
