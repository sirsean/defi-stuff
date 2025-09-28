#!/usr/bin/env node

import { execSync } from "child_process";
import path from "path";
import fs from "fs";

const PLIST_NAME = "com.defi-stuff.daily.plist";
const LAUNCH_AGENTS_DIR = path.join(
  process.env.HOME,
  "Library",
  "LaunchAgents",
);
const PLIST_PATH = path.join(LAUNCH_AGENTS_DIR, PLIST_NAME);

console.log("Testing launchd job execution...");

// Check if plist file exists and is loaded
try {
  if (!fs.existsSync(PLIST_PATH)) {
    console.error(`ERROR: Plist file not found at ${PLIST_PATH}`);
    console.log('Run "npm run scheduler:setup" to create the plist file');
    process.exit(1);
  }

  // Check if job is loaded in launchd
  try {
    execSync(`launchctl list | grep com.defi-stuff.daily`).toString();
    console.log("✅ Job is loaded in launchd");
  } catch (error) {
    console.error("❌ Job is not loaded in launchd");
    console.log('Run "npm run scheduler:setup" to load the job');
    process.exit(1);
  }

  // Manually run the job
  console.log("Running the daily job now...");
  execSync("launchctl start com.defi-stuff.daily");
  console.log("✅ Job started successfully");

  console.log("\nThe job is now running in the background.");
  console.log("You can check the logs in these files:");

  // Get log file paths from plist
  const plistContent = fs.readFileSync(PLIST_PATH, "utf8");
  const stdOutMatch = plistContent.match(
    /<key>StandardOutPath<\/key>\s*<string>(.*?)<\/string>/,
  );
  const stdErrMatch = plistContent.match(
    /<key>StandardErrorPath<\/key>\s*<string>(.*?)<\/string>/,
  );

  if (stdOutMatch) {
    console.log(`📄 Standard output: ${stdOutMatch[1]}`);
  }

  if (stdErrMatch) {
    console.log(`📄 Error output: ${stdErrMatch[1]}`);
  }

  console.log("\nTo check if the job completed successfully, you can use:");
  console.log("tail -f logs/daily-output.log");
} catch (error) {
  console.error("Error while testing the launchd job:", error.message);
  process.exit(1);
}
