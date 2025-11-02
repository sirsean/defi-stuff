#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const WORKING_DIR = process.cwd();
const JOB_LABEL = "com.defi-stuff.confidence-calibration";
const OUTPUT_LOG = path.join(
  WORKING_DIR,
  "logs",
  "confidence-calibration-output.log",
);
const ERROR_LOG = path.join(
  WORKING_DIR,
  "logs",
  "confidence-calibration-error.log",
);

console.log("═══════════════════════════════════════════════════════════");
console.log("  Confidence Calibration Scheduler Verification");
console.log("═══════════════════════════════════════════════════════════\n");

// Check if job is loaded
console.log("📋 Job Status:");
console.log("───────────────────────────────────────────────────────────");
try {
  const result = execSync(`launchctl list ${JOB_LABEL}`).toString();
  console.log("✅ Job is loaded");
  console.log(result);
} catch (error) {
  console.log("❌ Job is NOT loaded");
  console.log("Run 'npm run scheduler:calibration:setup' to set up the job.");
  process.exit(1);
}

// Display recent output
console.log("\n📝 Recent Output (last 20 lines):");
console.log("───────────────────────────────────────────────────────────");
if (fs.existsSync(OUTPUT_LOG)) {
  try {
    const output = execSync(`tail -n 20 ${OUTPUT_LOG}`).toString();
    console.log(output || "(no output yet)");
  } catch (error) {
    console.log("(unable to read output log)");
  }
} else {
  console.log("(output log does not exist yet - job has not run)");
}

// Display recent errors
console.log("\n⚠️  Recent Errors (last 10 lines):");
console.log("───────────────────────────────────────────────────────────");
if (fs.existsSync(ERROR_LOG)) {
  try {
    const errors = execSync(`tail -n 10 ${ERROR_LOG}`).toString().trim();
    if (errors) {
      console.log(errors);
    } else {
      console.log("(no errors)");
    }
  } catch (error) {
    console.log("(unable to read error log)");
  }
} else {
  console.log("(error log does not exist yet - job has not run)");
}

// Display configuration
console.log("\n⚙️  Configuration:");
console.log("───────────────────────────────────────────────────────────");
console.log("Schedule:  Every Sunday at 6:00 AM CT (11:00 AM UTC)");
console.log("Command:   node dist/index.js confidence:calibrate -m BTC");
console.log(`Output:    ${OUTPUT_LOG}`);
console.log(`Errors:    ${ERROR_LOG}`);

// Next steps
console.log("\n📌 Next Steps:");
console.log("───────────────────────────────────────────────────────────");
console.log("• Test job manually:  npm run scheduler:calibration:test");
console.log(
  "• View full output:   tail -f logs/confidence-calibration-output.log",
);
console.log(
  "• View full errors:   tail -f logs/confidence-calibration-error.log",
);
console.log(
  "• Unload job:         launchctl unload -w ~/Library/LaunchAgents/com.defi-stuff.confidence-calibration.plist",
);

console.log("\n═══════════════════════════════════════════════════════════\n");
