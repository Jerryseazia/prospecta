import {
  defineConfig
} from "../../../../../chunk-IAPM2DTR.mjs";
import "../../../../../chunk-HCD45DYG.mjs";
import {
  init_esm
} from "../../../../../chunk-3R76H35D.mjs";

// trigger.config.ts
init_esm();
var trigger_config_default = defineConfig({
  // Get your project ref from: https://cloud.trigger.dev → Project Settings → Project Ref
  project: "proj_uipokcfkynuhiqwxuqnp",
  dirs: ["./trigger"],
  // 5 minutes max per task run
  maxDuration: 300,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      factor: 2,
      minTimeoutInMs: 5e3,
      maxTimeoutInMs: 3e4
    }
  },
  build: {}
});
var resolveEnvVars = void 0;
export {
  trigger_config_default as default,
  resolveEnvVars
};
//# sourceMappingURL=trigger.config.mjs.map
