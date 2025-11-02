#!/usr/bin/env node

import { execSync } from "child_process";
import path from "path";
import fs from "fs";

const PLIST_NAME = "com.defi-stuff.trade-recommendations.plist";
const LAUNCH_AGENTS_DIR = path.join(
  process.env.HOME,
  "Library",
  "LaunchAgents",
);
const PLIST_PATH = path.join(LAUNCH_AGENTS_DIR, PLIST_NAME);

console.log("Verifying launchd configuration...");

// Check if plist file exists
if (!fs.existsSync(PLIST_PATH)) {
  console.error(`ERROR: Plist file not found at ${PLIST_PATH}`);
  console.log(
    'Run "npm run scheduler:setup:trade-recs" to create the plist file',
  );
  process.exit(1);
}

// Check if job is loaded in launchd
try {
  const result = execSync(
    `launchctl list | grep com.defi-stuff.trade-recommendations`,
  ).toString();
  console.log("✅ Job is loaded in launchd:");
  console.log(result);
} catch (error) {
  console.error("❌ Job is not loaded in launchd");
  console.log('Run "npm run scheduler:setup:trade-recs" to load the job');
  process.exit(1);
}

// Display job details
try {
  console.log("Current launchd plist configuration:");
  const plistContent = fs.readFileSync(PLIST_PATH, "utf8");
  console.log("✅ Plist file exists at:", PLIST_PATH);

  // Extract and display key information
  if (plistContent.includes("<key>StartInterval</key>")) {
    console.log("✅ Scheduled with StartInterval");

    const intervalMatch = plistContent.match(
      /<key>StartInterval<\/key>\s*<integer>(\d+)<\/integer>/,
    );

    if (intervalMatch) {
      const seconds = parseInt(intervalMatch[1]);
      const minutes = seconds / 60;
      const hours = minutes / 60;
      console.log(
        `⏰ Run interval: Every ${seconds} seconds (${minutes} minutes / ${hours} hours)`,
      );
    }
  }

  // Check log paths
  const stdOutMatch = plistContent.match(
    /<key>StandardOutPath<\/key>\s*<string>(.*?)<\/string>/,
  );
  const stdErrMatch = plistContent.match(
    /<key>StandardErrorPath<\/key>\s*<string>(.*?)<\/string>/,
  );

  if (stdOutMatch) {
    console.log(`📄 Standard output: ${stdOutMatch[1]}`);
    // Check if log directory exists
    const logDir = path.dirname(stdOutMatch[1]);
    if (!fs.existsSync(logDir)) {
      console.warn(`⚠️  Warning: Log directory doesn't exist at ${logDir}`);
    }
  }

  if (stdErrMatch) {
    console.log(`📄 Error output: ${stdErrMatch[1]}`);
  }

  console.log("\n✅ Configuration verification complete");
} catch (error) {
  console.error("Error while verifying configuration:", error.message);
  process.exit(1);
}
