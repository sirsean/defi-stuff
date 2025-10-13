import { discordService, DiscordColors } from "./discordService.js";
import type { TradeRecommendation, PositionState } from "../../types/tradeRecommendation.js";

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

  /**
   * Format timeframe for display
   */
  private formatTimeframe(timeframe: string): string {
    const timeframeMap: Record<string, string> = {
      intraday: "Intraday (today)",
      short: "Short-term (1 day)",
      medium: "Short-term (1 day)",
      long: "Long-term",
    };
    return timeframeMap[timeframe] || timeframe;
  }

  /**
   * Get position state emoji
   */
  private getPositionEmoji(state: PositionState): string {
    const map: Record<PositionState, string> = {
      long: "📈",
      short: "📉",
      flat: "⚪",
    };
    return map[state];
  }

  /**
   * Format position state with arrow to recommendation
   */
  private formatPositionFlow(
    currentState: PositionState,
    recommendedAction: string,
  ): string {
    const currentEmoji = this.getPositionEmoji(currentState);
    const actionEmoji = this.getActionEmoji(recommendedAction);
    return `${currentEmoji} ${currentState.toUpperCase()} → ${actionEmoji} ${recommendedAction.toUpperCase()}`;
  }

  /**
   * Format trade recommendation as Discord embed message
   */
  formatRecommendation(
    recommendation: TradeRecommendation,
    currentPrice: number,
    currentState?: PositionState,
  ) {
    const actionEmoji = this.getActionEmoji(recommendation.action);
    const color = this.getActionColor(recommendation.action);

    const message = discordService
      .createEmbedMessage()
      .addTitle(`${recommendation.market} ${actionEmoji} ${recommendation.action.toUpperCase()}`)
      .setColor(color);

    // Position flow field (if position state is provided)
    if (currentState) {
      message.addField(
        "📊 Position Flow",
        this.formatPositionFlow(currentState, recommendation.action),
        false,
      );
    } else {
      // Fallback to simple action field if no state provided
      message.addField(
        `${actionEmoji} Action`,
        recommendation.action.toUpperCase(),
        true,
      );
    }

    // Current price
    message.addField("💰 Current Price", this.formatPrice(currentPrice), true);

    // Confidence with visual bar
    message.addField(
      "⭐ Confidence",
      this.createConfidenceBar(recommendation.confidence),
      false,
    );

    // Timeframe
    message.addField(
      "⏱️ Timeframe",
      this.formatTimeframe(recommendation.timeframe),
      true,
    );

    // Suggested size (if applicable)
    if (recommendation.size_usd !== null) {
      message.addField(
        "💵 Suggested Size",
        this.formatPrice(recommendation.size_usd),
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
    positionStates?: Map<string, PositionState>,
  ): Promise<void> {
    for (const { recommendation, currentPrice } of recommendations) {
      const currentState = positionStates?.get(recommendation.market);
      const message = this.formatRecommendation(
        recommendation,
        currentPrice,
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
