import { FullConfig } from "@playwright/test";

async function globalTeardown(config: FullConfig) {
  // Teardown code goes here
}

export default globalTeardown;
