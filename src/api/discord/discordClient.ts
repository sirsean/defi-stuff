import { Client, GatewayIntentBits, TextChannel } from 'discord.js';

export class DiscordClient {
  private client: Client;
  private isConnected: boolean = false;

  constructor() {
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds]
    });

    // Set up event handlers
    this.client.on('ready', () => {
      this.isConnected = true;
      console.log(`Logged in as ${this.client.user?.tag}`);
    });

    this.client.on('error', (error) => {
      console.error('Discord client error:', error);
      this.isConnected = false;
    });
  }

  /**
   * Connect to Discord
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    if (!process.env.DISCORD_APP_TOKEN) {
      throw new Error('DISCORD_APP_TOKEN environment variable is required');
    }
    
    try {
      await this.client.login(process.env.DISCORD_APP_TOKEN);
    } catch (error) {
      console.error('Failed to connect to Discord:', error);
      throw error;
    }
  }

  /**
   * Disconnect from Discord
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    this.client.destroy();
    this.isConnected = false;
  }

  /**
   * Get the Discord channel for sending messages
   */
  async getChannel(): Promise<TextChannel> {
    if (!this.isConnected) {
      await this.connect();
    }

    if (!process.env.DISCORD_CHANNEL_ID) {
      throw new Error('DISCORD_CHANNEL_ID environment variable is required');
    }

    try {
      const channel = await this.client.channels.fetch(process.env.DISCORD_CHANNEL_ID);
      
      if (!channel || !(channel instanceof TextChannel)) {
        throw new Error('Channel not found or not a text channel');
      }

      return channel;
    } catch (error) {
      console.error('Failed to fetch Discord channel:', error);
      throw error;
    }
  }
}

export const discordClient = new DiscordClient();