import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  TextMessageBuilder,
  EmbedMessageBuilder,
  DiscordColors,
} from "../../../src/api/discord/messageFormatters";

// Create mock methods
const mockSetTitle = vi.fn().mockReturnThis();
const mockSetDescription = vi.fn().mockReturnThis();
const mockAddFields = vi.fn().mockReturnThis();
const mockSetTimestamp = vi.fn().mockReturnThis();
const mockSetColor = vi.fn().mockReturnThis();

// Mock discord.js EmbedBuilder
vi.mock("discord.js", () => ({
  EmbedBuilder: vi.fn(() => ({
    setTitle: mockSetTitle,
    setDescription: mockSetDescription,
    addFields: mockAddFields,
    setTimestamp: mockSetTimestamp,
    setColor: mockSetColor,
  })),
}));

describe("MessageFormatters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("TextMessageBuilder", () => {
    it("should build a simple text message", () => {
      // Act
      const message = new TextMessageBuilder()
        .addTitle("Test Title")
        .addDescription("This is a test description")
        .addField("Field 1", "Value 1")
        .build();

      // Assert
      expect(message).toContain("**Test Title**");
      expect(message).toContain("This is a test description");
      expect(message).toContain("**Field 1**: Value 1");
    });

    it("should chain methods correctly", () => {
      // Act
      const builder = new TextMessageBuilder()
        .addTitle("Test Title")
        .addDescription("This is a test description");

      // Continue chaining
      const result = builder.addField("Field 1", "Value 1").build();

      // Assert
      expect(result).toContain("**Test Title**");
      expect(result).toContain("This is a test description");
      expect(result).toContain("**Field 1**: Value 1");
    });

    it("should add multiple fields correctly", () => {
      // Act
      const message = new TextMessageBuilder()
        .addFields([
          { name: "Field 1", value: "Value 1" },
          { name: "Field 2", value: "Value 2" },
        ])
        .build();

      // Assert
      expect(message).toContain("**Field 1**: Value 1");
      expect(message).toContain("**Field 2**: Value 2");
    });

    it("should add timestamp correctly", () => {
      // Arrange
      const dateSpy = vi.spyOn(Date.prototype, "toISOString");
      dateSpy.mockReturnValue("2023-01-01T00:00:00.000Z");

      // Act
      const message = new TextMessageBuilder().addTimestamp().build();

      // Assert
      expect(message).toContain("*2023-01-01T00:00:00.000Z*");

      // Cleanup
      dateSpy.mockRestore();
    });

    it("should ignore color setting for text messages", () => {
      // Act
      const message = new TextMessageBuilder()
        .setColor(DiscordColors.RED)
        .addTitle("Test Title")
        .build();

      // Assert
      expect(message).toContain("**Test Title**");
      // No assertion needed for color as it's ignored
    });
  });

  describe("EmbedMessageBuilder", () => {
    it("should build an embed message using discord.js EmbedBuilder", () => {
      // Act
      const embedBuilder = new EmbedMessageBuilder()
        .addTitle("Test Title")
        .addDescription("This is a test description")
        .addField("Field 1", "Value 1")
        .setColor(DiscordColors.RED)
        .addTimestamp()
        .build();

      // We can't use toBeInstanceOf because of how the mocking works
      // Instead, just check that it's an object returned from our builder
      expect(typeof embedBuilder).toBe("object");

      // Verify all methods were called with correct parameters
      expect(mockSetTitle).toHaveBeenCalledWith("Test Title");
      expect(mockSetDescription).toHaveBeenCalledWith(
        "This is a test description",
      );
      expect(mockAddFields).toHaveBeenCalledWith({
        name: "Field 1",
        value: "Value 1",
        inline: undefined,
      });
      expect(mockSetColor).toHaveBeenCalledWith(DiscordColors.RED);
      expect(mockSetTimestamp).toHaveBeenCalled();
    });

    it("should add multiple fields correctly", () => {
      // Act
      const embedBuilder = new EmbedMessageBuilder()
        .addFields([
          { name: "Field 1", value: "Value 1" },
          { name: "Field 2", value: "Value 2", inline: true },
        ])
        .build();

      // Check that addFields was called with each field individually
      expect(mockAddFields).toHaveBeenCalledWith([
        { name: "Field 1", value: "Value 1", inline: undefined },
        { name: "Field 2", value: "Value 2", inline: true },
      ]);
    });

    it("should chain methods correctly", () => {
      // Act
      const builder = new EmbedMessageBuilder().addTitle("Test Title");

      // Continue chaining
      builder.addDescription("This is a test description");

      // Assert
      expect(mockSetTitle).toHaveBeenCalledWith("Test Title");
      expect(mockSetDescription).toHaveBeenCalledWith(
        "This is a test description",
      );
    });
  });

  describe("DiscordColors", () => {
    it("should contain the correct color values", () => {
      // Assert
      expect(DiscordColors.RED).toBe(0xff0000);
      expect(DiscordColors.GREEN).toBe(0x00ff00);
      expect(DiscordColors.BLUE).toBe(0x0000ff);
      expect(DiscordColors.DEFAULT).toBe(0x000000);
    });
  });
});
