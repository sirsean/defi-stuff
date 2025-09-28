import {
  discordService,
  DiscordColors,
  MessageBuilder,
} from "./api/discord/index.js";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

/**
 * Test function to verify Discord integration
 */
async function testDiscordIntegration() {
  console.log("Starting Discord integration test...");

  try {
    // Simple test message
    const testMessage = discordService
      .createTextMessage()
      .addTitle("🧪 Discord Integration Test")
      .addDescription(
        "This is a test message to verify that the Discord integration is working properly.",
      )
      .addField("Test Time", new Date().toISOString());

    console.log("Sending test message to Discord...");
    await discordService.sendMessage(testMessage);

    console.log("Message sent successfully! ✅");
  } catch (error) {
    console.error("Error sending Discord message:", error);
    process.exit(1);
  } finally {
    // Always disconnect when done
    await discordService.shutdown();
  }
}

// Run the test
testDiscordIntegration().catch(console.error);
