#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const WORKING_DIR = process.cwd();
const TEMPLATE_DIR = path.join(WORKING_DIR, "scripts", "templates");
const LAUNCH_AGENTS_DIR = path.join(
  process.env.HOME,
  "Library",
  "LaunchAgents",
);
const PLIST_NAME = "com.defi-stuff.daily.plist";
const LOGS_DIR = path.join(WORKING_DIR, "logs");

// Create logs directory if it doesn't exist
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
  console.log(`Created logs directory at ${LOGS_DIR}`);
}

// Ensure the LaunchAgents directory exists
if (!fs.existsSync(LAUNCH_AGENTS_DIR)) {
  fs.mkdirSync(LAUNCH_AGENTS_DIR, { recursive: true });
  console.log(`Created LaunchAgents directory at ${LAUNCH_AGENTS_DIR}`);
}

// Read plist template
const templatePath = path.join(TEMPLATE_DIR, PLIST_NAME);
let plistContent = fs.readFileSync(templatePath, "utf8");

// Replace placeholders with actual values
plistContent = plistContent.replace(/__WORKING_DIR__/g, WORKING_DIR);
// Use the current Node.js binary for scheduled runs (matches your active environment)
plistContent = plistContent.replace(/__NODE_PATH__/g, process.execPath);
console.log(`Using Node for scheduler: ${process.execPath}`);

// Write the final plist file to LaunchAgents directory
const targetPath = path.join(LAUNCH_AGENTS_DIR, PLIST_NAME);
fs.writeFileSync(targetPath, plistContent);
console.log(`Created launchd plist at ${targetPath}`);

// Load the plist into launchd
try {
  execSync(`launchctl unload ${targetPath}`, { stdio: "pipe" });
} catch (error) {
  // It's okay if this fails - it might not be loaded yet
}

try {
  execSync(`launchctl load -w ${targetPath}`);
  console.log("Successfully loaded job into launchd");
} catch (error) {
  console.error("Failed to load job into launchd:", error.message);
  process.exit(1);
}

// Verify the job is loaded
try {
  const result = execSync(
    `launchctl list | grep com.defi-stuff.daily`,
  ).toString();
  console.log("Job is loaded and scheduled to run at 5:00 AM CT daily");
  console.log(result);
} catch (error) {
  console.error(
    "Job verification failed. The job may not be loaded correctly.",
  );
  process.exit(1);
}

console.log(
  "Setup complete! The daily command will run automatically at 5:00 AM.",
);
console.log(
  `Logs will be written to: ${LOGS_DIR}/daily-output.log and ${LOGS_DIR}/daily-error.log`,
);
