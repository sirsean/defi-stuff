import { TextChannel, EmbedBuilder } from 'discord.js';
import { discordClient } from './discordClient.js';
import { EmbedMessageBuilder, MessageBuilder, TextMessageBuilder, DiscordColors } from './messageFormatters.js';

export class DiscordService {
  private isInitialized = false;
  private channel: TextChannel | null = null;

  /**
   * Initialize the Discord service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.channel = await discordClient.getChannel();
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize Discord service:', error);
      throw error;
    }
  }

  /**
   * Create a text message builder
   */
  createTextMessage(): MessageBuilder {
    return new TextMessageBuilder();
  }

  /**
   * Create an embed message builder
   */
  createEmbedMessage(): MessageBuilder {
    return new EmbedMessageBuilder();
  }

  /**
   * Send a message to the Discord channel
   */
  async sendMessage(message: string | MessageBuilder): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.channel) {
      throw new Error('Discord channel not available');
    }

    try {
      if (typeof message === 'string') {
        await this.channel.send(message);
      } else {
        const builtMessage = message.build();

        if (typeof builtMessage === 'string') {
          await this.channel.send(builtMessage);
        } else if (builtMessage instanceof EmbedBuilder) {
          await this.channel.send({ embeds: [builtMessage] });
        } else {
          throw new Error('Unsupported message type');
        }
      }
    } catch (error) {
      console.error('Failed to send Discord message:', error);
      throw error;
    }
  }

  /**
   * Disconnect from Discord
   */
  async shutdown(): Promise<void> {
    await discordClient.disconnect();
    this.isInitialized = false;
    this.channel = null;
  }
}

export const discordService = new DiscordService();

// Export color constants for easy access
export { DiscordColors };