import { EmbedBuilder, APIEmbedField } from 'discord.js';

export interface MessageBuilder {
  addTitle(title: string): MessageBuilder;
  addDescription(description: string): MessageBuilder;
  addFields(fields: Array<{name: string, value: string, inline?: boolean}>): MessageBuilder;
  addField(name: string, value: string, inline?: boolean): MessageBuilder;
  addTimestamp(): MessageBuilder;
  setColor(color: number): MessageBuilder;
  build(): string | EmbedBuilder;
}

/**
 * Builder for creating simple text messages
 */
export class TextMessageBuilder implements MessageBuilder {
  private parts: string[] = [];

  constructor() {}

  addTitle(title: string): MessageBuilder {
    this.parts.push(`**${title}**\n`);
    return this;
  }

  addDescription(description: string): MessageBuilder {
    this.parts.push(`${description}\n\n`);
    return this;
  }

  addFields(fields: Array<{name: string, value: string, inline?: boolean}>): MessageBuilder {
    fields.forEach(field => this.addField(field.name, field.value, field.inline));
    return this;
  }

  addField(name: string, value: string, inline?: boolean): MessageBuilder {
    this.parts.push(`**${name}**: ${value}\n`);
    return this;
  }

  addTimestamp(): MessageBuilder {
    this.parts.push(`\n*${new Date().toISOString()}*`);
    return this;
  }

  setColor(_color: number): MessageBuilder {
    // Text messages don't support color
    return this;
  }

  build(): string {
    return this.parts.join('');
  }
}

/**
 * Builder for creating rich embed messages
 */
export class EmbedMessageBuilder implements MessageBuilder {
  private embed: EmbedBuilder;

  constructor() {
    this.embed = new EmbedBuilder();
  }

  addTitle(title: string): MessageBuilder {
    this.embed.setTitle(title);
    return this;
  }

  addDescription(description: string): MessageBuilder {
    this.embed.setDescription(description);
    return this;
  }

  addFields(fields: Array<{name: string, value: string, inline?: boolean}>): MessageBuilder {
    this.embed.addFields(fields.map(field => ({
      name: field.name,
      value: field.value,
      inline: field.inline
    })));
    return this;
  }

  addField(name: string, value: string, inline?: boolean): MessageBuilder {
    this.embed.addFields({ name, value, inline });
    return this;
  }

  addTimestamp(): MessageBuilder {
    this.embed.setTimestamp();
    return this;
  }

  setColor(color: number): MessageBuilder {
    this.embed.setColor(color);
    return this;
  }

  build(): EmbedBuilder {
    return this.embed;
  }
}

/**
 * Discord color constants
 */
export const DiscordColors = {
  DEFAULT: 0x000000,
  WHITE: 0xFFFFFF,
  RED: 0xFF0000,
  GREEN: 0x00FF00,
  BLUE: 0x0000FF,
  YELLOW: 0xFFFF00,
  PURPLE: 0x800080,
  GOLD: 0xFFD700,
  ORANGE: 0xFFA500,
  GREY: 0x808080
};