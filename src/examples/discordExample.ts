import {
  discordService,
  DiscordColors,
  MessageBuilder,
} from "../api/discord/index.js";

/**
 * Example of using the Discord integration
 */
async function sendDiscordMessages() {
  try {
    // Simple text message
    const textMessage = discordService
      .createTextMessage()
      .addTitle("Protocol Update")
      .addDescription("Latest information about your protocols")
      .addFields([
        { name: "Wallets Tracked", value: "5" },
        { name: "Protocols", value: "12" },
        { name: "Total Value", value: "$1,234.56" },
      ])
      .addTimestamp();

    // Rich embed message with formatting
    const embedMessage = discordService
      .createEmbedMessage()
      .addTitle("🔍 Protocol Alert")
      .addDescription(
        "A significant change has been detected in one of your tracked protocols",
      )
      .addField("Protocol", "UniswapV3", true)
      .addField("Change", "+15.4%", true)
      .addField("Current Value", "$584.25", true)
      .addField(
        "Details",
        "The protocol has experienced a significant increase in the last 24 hours.",
      )
      .setColor(DiscordColors.GREEN)
      .addTimestamp();

    // Send both messages
    console.log("Sending text message to Discord...");
    await discordService.sendMessage(textMessage);

    console.log("Sending embed message to Discord...");
    await discordService.sendMessage(embedMessage);

    console.log("Messages sent successfully!");
  } catch (error) {
    console.error("Error sending Discord messages:", error);
  } finally {
    // Always disconnect when done
    await discordService.shutdown();
  }
}

// Usage
// sendDiscordMessages().catch(console.error);

export { sendDiscordMessages };
