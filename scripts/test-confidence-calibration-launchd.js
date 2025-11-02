#!/usr/bin/env node

import { execSync } from "child_process";
import path from "path";
import fs from "fs";

const JOB_LABEL = "com.defi-stuff.confidence-calibration";
const PLIST_NAME = "com.defi-stuff.confidence-calibration.plist";
const LAUNCH_AGENTS_DIR = path.join(
  process.env.HOME,
  "Library",
  "LaunchAgents",
);
const PLIST_PATH = path.join(LAUNCH_AGENTS_DIR, PLIST_NAME);
const WORKING_DIR = process.cwd();
const DIST_INDEX = path.join(WORKING_DIR, "dist", "index.js");

console.log("═══════════════════════════════════════════════════════════");
console.log("  Testing Confidence Calibration Job");
console.log("═══════════════════════════════════════════════════════════\n");

// Check if dist/index.js exists
if (!fs.existsSync(DIST_INDEX)) {
  console.error("❌ ERROR: dist/index.js not found");
  console.log("Run 'npm run build' to compile TypeScript first");
  process.exit(1);
}

// Check if plist file exists
if (!fs.existsSync(PLIST_PATH)) {
  console.error(`❌ ERROR: Plist file not found at ${PLIST_PATH}`);
  console.log(
    'Run "npm run scheduler:calibration:setup" to create the plist file',
  );
  process.exit(1);
}

// Check if job is loaded in launchd
try {
  execSync(`launchctl list | grep ${JOB_LABEL}`).toString();
  console.log("✅ Job is loaded in launchd");
} catch (error) {
  console.error("❌ Job is not loaded in launchd");
  console.log('Run "npm run scheduler:calibration:setup" to load the job');
  process.exit(1);
}

// Manually run the job
console.log("\n📤 Triggering confidence calibration job...");
try {
  execSync(`launchctl start ${JOB_LABEL}`);
  console.log("✅ Job started successfully\n");
} catch (error) {
  console.error("❌ Failed to start job:", error.message);
  process.exit(1);
}

console.log("The job is now running in the background.");
console.log("You can check the logs in these files:\n");
console.log("📄 Output: logs/confidence-calibration-output.log");
console.log("📄 Errors: logs/confidence-calibration-error.log");

console.log("\n💡 To monitor progress in real-time:");
console.log("   tail -f logs/confidence-calibration-output.log");

console.log("\n═══════════════════════════════════════════════════════════\n");
