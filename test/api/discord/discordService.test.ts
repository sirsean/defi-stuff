import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TextChannel, EmbedBuilder } from "discord.js";
import { discordClient } from "../../../src/api/discord/discordClient";
import { DiscordService } from "../../../src/api/discord/discordService";
import {
  TextMessageBuilder,
  EmbedMessageBuilder,
} from "../../../src/api/discord/messageFormatters";

// Mock the discordClient
vi.mock("../../../src/api/discord/discordClient", () => ({
  discordClient: {
    getChannel: vi.fn(),
    disconnect: vi.fn().mockResolvedValue(undefined),
  },
}));

// Create a mock EmbedBuilder instance
const mockEmbedInstance = {
  data: { type: "rich" },
  constructor: { name: "EmbedBuilder" },
};
Object.setPrototypeOf(mockEmbedInstance, EmbedBuilder.prototype);

// Mock the message builders
vi.mock("../../../src/api/discord/messageFormatters", () => ({
  TextMessageBuilder: vi.fn().mockImplementation(() => ({
    addTitle: vi.fn().mockReturnThis(),
    addDescription: vi.fn().mockReturnThis(),
    addFields: vi.fn().mockReturnThis(),
    addField: vi.fn().mockReturnThis(),
    addTimestamp: vi.fn().mockReturnThis(),
    setColor: vi.fn().mockReturnThis(),
    build: vi.fn().mockReturnValue("Test text message"),
  })),
  EmbedMessageBuilder: vi.fn().mockImplementation(() => ({
    addTitle: vi.fn().mockReturnThis(),
    addDescription: vi.fn().mockReturnThis(),
    addFields: vi.fn().mockReturnThis(),
    addField: vi.fn().mockReturnThis(),
    addTimestamp: vi.fn().mockReturnThis(),
    setColor: vi.fn().mockReturnThis(),
    build: vi.fn().mockReturnValue(mockEmbedInstance), // Return a proper EmbedBuilder instance
  })),
  DiscordColors: {
    RED: 0xff0000,
    GREEN: 0x00ff00,
  },
}));

describe("DiscordService", () => {
  let discordService: DiscordService;
  let mockChannel: { send: vi.Mock };

  beforeEach(() => {
    // Create a mock channel with a send method
    mockChannel = { send: vi.fn().mockResolvedValue(undefined) };
    (discordClient.getChannel as jest.Mock).mockResolvedValue(mockChannel);

    discordService = new DiscordService();

    // Spy on console methods
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("initialize", () => {
    it("should retrieve the channel on initialization", async () => {
      // Act
      await discordService.initialize();

      // Assert
      expect(discordClient.getChannel).toHaveBeenCalled();
    });

    it("should not initialize twice", async () => {
      // Arrange: First initialize
      await discordService.initialize();
      (discordClient.getChannel as jest.Mock).mockClear();

      // Act: Try to initialize again
      await discordService.initialize();

      // Assert
      expect(discordClient.getChannel).not.toHaveBeenCalled();
    });

    it("should throw an error if channel retrieval fails", async () => {
      // Arrange
      (discordClient.getChannel as jest.Mock).mockRejectedValueOnce(
        new Error("Failed to get channel"),
      );

      // Act & Assert
      await expect(discordService.initialize()).rejects.toThrow(
        "Failed to get channel",
      );
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("createTextMessage", () => {
    it("should return a new TextMessageBuilder instance", () => {
      // Act
      const builder = discordService.createTextMessage();

      // Assert
      expect(TextMessageBuilder).toHaveBeenCalled();
      expect(builder).toBeDefined();
    });
  });

  describe("createEmbedMessage", () => {
    it("should return a new EmbedMessageBuilder instance", () => {
      // Act
      const builder = discordService.createEmbedMessage();

      // Assert
      expect(EmbedMessageBuilder).toHaveBeenCalled();
      expect(builder).toBeDefined();
    });
  });

  describe("sendMessage", () => {
    beforeEach(async () => {
      // Initialize before tests that need the channel
      await discordService.initialize();
    });

    it("should initialize if not already initialized", async () => {
      // Arrange: Create a new service that hasn't been initialized
      const newService = new DiscordService();
      (discordClient.getChannel as jest.Mock).mockClear();

      // Act
      await newService.sendMessage("Test message");

      // Assert
      expect(discordClient.getChannel).toHaveBeenCalled();
    });

    it("should send a string message", async () => {
      // Act
      await discordService.sendMessage("Test message");

      // Assert
      expect(mockChannel.send).toHaveBeenCalledWith("Test message");
    });

    it("should send a message from TextMessageBuilder", async () => {
      // Arrange
      const textBuilder = discordService.createTextMessage();
      (textBuilder.build as jest.Mock).mockReturnValue("Built test message");

      // Act
      await discordService.sendMessage(textBuilder);

      // Assert
      expect(textBuilder.build).toHaveBeenCalled();
      expect(mockChannel.send).toHaveBeenCalledWith("Built test message");
    });

    it("should send a message from EmbedMessageBuilder", async () => {
      // Arrange
      const embedBuilder = discordService.createEmbedMessage();

      // Act
      await discordService.sendMessage(embedBuilder);

      // Assert
      expect(embedBuilder.build).toHaveBeenCalled();
      expect(mockChannel.send).toHaveBeenCalledWith({
        embeds: [mockEmbedInstance],
      });
    });

    it("should throw an error if send fails", async () => {
      // Arrange
      mockChannel.send.mockRejectedValueOnce(new Error("Failed to send"));

      // Act & Assert
      await expect(discordService.sendMessage("Test message")).rejects.toThrow(
        "Failed to send",
      );
      expect(console.error).toHaveBeenCalled();
    });

    it("should throw an error if channel is not available", async () => {
      // Arrange: Create a new service and make getChannel return null
      const newService = new DiscordService();
      (discordClient.getChannel as jest.Mock).mockResolvedValueOnce(null);

      // Act & Assert
      await expect(newService.sendMessage("Test message")).rejects.toThrow(
        "Discord channel not available",
      );
    });
  });

  describe("shutdown", () => {
    it("should disconnect the Discord client", async () => {
      // Act
      await discordService.shutdown();

      // Assert
      expect(discordClient.disconnect).toHaveBeenCalled();
    });

    it("should reset the initialization state", async () => {
      // Arrange: First initialize
      await discordService.initialize();
      (discordClient.getChannel as jest.Mock).mockClear();

      // Act
      await discordService.shutdown();
      await discordService.initialize(); // Should re-initialize

      // Assert
      expect(discordClient.getChannel).toHaveBeenCalled();
    });
  });
});
