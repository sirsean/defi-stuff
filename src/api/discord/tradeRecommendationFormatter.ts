import { discordService, DiscordColors } from "./discordService.js";
import type {
  TradeRecommendation,
  PositionState,
} from "../../types/tradeRecommendation.js";

/**
 * Discord formatter for trade recommendations
 * Creates rich embed messages with color coding and visual indicators
 */
export class TradeRecommendationDiscordFormatter {
  /**
   * Get action emoji based on trade action
   */
  private getActionEmoji(action: string): string {
    const map: Record<string, string> = {
      long: "📈",
      short: "📉",
      hold: "⏸️",
      close: "❌",
    };
    return map[action] || "•";
  }

  /**
   * Get embed color based on trade action
   */
  private getActionColor(action: string): number {
    const map: Record<string, number> = {
      long: DiscordColors.GREEN,
      short: DiscordColors.RED,
      hold: DiscordColors.GREY,
      close: DiscordColors.ORANGE,
    };
    return map[action] || DiscordColors.DEFAULT;
  }

  /**
   * Get confidence level text
   */
  private getConfidenceLevel(confidence: number): string {
    if (confidence >= 0.8) return "Very High";
    if (confidence >= 0.7) return "High";
    if (confidence >= 0.5) return "Moderate";
    if (confidence >= 0.3) return "Low";
    return "Very Low";
  }

  /**
   * Create confidence visualization (progress bar)
   */
  private createConfidenceBar(confidence: number): string {
    const filled = Math.round(confidence * 10);
    const bar = "█".repeat(filled) + "░".repeat(10 - filled);

    const level = this.getConfidenceLevel(confidence);
    const percent = Math.round(confidence * 100);

    return `${percent}% ${bar} (${level})`;
  }

  /**
   * Format price with commas and 2 decimal places
   */
  private formatPrice(price: number): string {
    return `$${price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  private getPositionEmoji(state: PositionState): string {
    const map: Record<PositionState, string> = {
      long: "📈",
      short: "📉",
      flat: "⚪",
    };
    return map[state];
  }

  /**
   * Format trade recommendation as Discord embed message
   */
  formatRecommendation(
    recommendation: TradeRecommendation,
    currentPrice: number,
    portfolioValue: number,
    currentState?: PositionState,
  ) {
    const actionEmoji = this.getActionEmoji(recommendation.action);
    const color = this.getActionColor(recommendation.action);

    // Construct title based on flow or simple action
    let title = "";
    if (currentState) {
      const currentEmoji = this.getPositionEmoji(currentState);
      title = `${recommendation.market}: ${currentEmoji} ${currentState.toUpperCase()} → ${actionEmoji} ${recommendation.action.toUpperCase()}`;
    } else {
      title = `${recommendation.market}: ${actionEmoji} ${recommendation.action.toUpperCase()}`;
    }

    const message = discordService
      .createEmbedMessage()
      .addTitle(title)
      .setColor(color);

    // Current price
    message.addField("💰 Current Price", this.formatPrice(currentPrice), true);

    // Confidence with visual bar
    message.addField(
      "⭐ Confidence",
      this.createConfidenceBar(recommendation.confidence),
      false,
    );

    // Suggested size (if applicable)
    if (recommendation.size_usd !== null) {
      const leverage = recommendation.size_usd / portfolioValue;
      message.addField(
        "💵 Suggested Size",
        `${this.formatPrice(recommendation.size_usd)} : ${leverage.toFixed(1)}x leverage`,
        true,
      );
    }

    // Add timestamp
    message.addTimestamp();

    return message;
  }

  /**
   * Format and send multiple recommendations
   * Sends one message per recommendation with delay to avoid rate limiting
   */
  async sendRecommendations(
    recommendations: Array<{
      recommendation: TradeRecommendation;
      currentPrice: number;
    }>,
    portfolioValue: number,
    positionStates?: Map<string, PositionState>,
  ): Promise<void> {
    for (const { recommendation, currentPrice } of recommendations) {
      const currentState = positionStates?.get(recommendation.market);
      const message = this.formatRecommendation(
        recommendation,
        currentPrice,
        portfolioValue,
        currentState,
      );
      await discordService.sendMessage(message);

      // Small delay between messages to avoid rate limiting
      if (recommendations.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }
}

export const tradeRecommendationDiscordFormatter =
  new TradeRecommendationDiscordFormatter();
