import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  // Get your project ref from: https://cloud.trigger.dev → Project Settings → Project Ref
  project: "proj_uipokcfkynuhiqwxuqnp",
  dirs: ["./trigger"],
  maxDuration: 300, // 5 minutes max per task run
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      factor: 2,
      minTimeoutInMs: 5_000,
      maxTimeoutInMs: 30_000,
    },
  },
});
