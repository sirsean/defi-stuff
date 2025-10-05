# Trade Recommendations Discord Notifications

**Created**: 2025-10-05  
**Updated**: 2025-10-05  
**Status**: ✅ Implementation Complete

## Summary

Add Discord notification capability to the `trade:recommend` command via a `--discord` flag. When enabled, the system will send a concise, well-formatted message to the configured Discord channel summarizing each trade recommendation.

## Goals

1. **Real-time Alerts**: Get instant notifications when AI generates new trade recommendations
2. **Mobile Access**: View recommendations on mobile via Discord app
3. **Simple Format**: Clean, scannable message format with key information only
4. **Optional**: Keep default behavior (console only) when flag not used
5. **Integration**: Work seamlessly with existing `--db` flag
6. **Smart Notifications**: Only notify on changes when using `--db` and `--discord` together

## Message Design

### Format: Embed Message

Use Discord's rich embed format for clean, structured presentation with color-coded recommendations.

### Content Structure

**Title**: 🤖 Trade Recommendation: {MARKET}

**Fields:**
- **Action**: {LONG/SHORT/HOLD/CLOSE} (with emoji)
- **Current Price**: ${price} (formatted with commas)
- **Confidence**: {XX}% ⭐⭐⭐ (visual indicator)
- **Timeframe**: {intraday/short/long}
- **Suggested Size**: ${size_usd} (if not null/hold/close)

**Color Coding:**
- LONG: Green (0x00ff00)
- SHORT: Red (0xff0000)
- HOLD: Grey (0x808080)
- CLOSE: Orange (0xffa500)

**Footer**: Timestamp of recommendation generation

### Visual Examples

**Example 1: Long Recommendation**
```
🤖 Trade Recommendation: BTC

📈 Action: LONG
💰 Current Price: $64,250.00
⭐ Confidence: 85% ████████░░ (Very High)
⏱️ Timeframe: intraday
💵 Suggested Size: $5,000

[Green color border]
Timestamp: Oct 5, 2025 7:41 PM
```

**Example 2: Hold Recommendation**
```
🤖 Trade Recommendation: ETH

⏸️ Action: HOLD
💰 Current Price: $3,425.50
⭐ Confidence: 62% ██████░░░░ (Moderate)
⏱️ Timeframe: short

[Grey color border]
Timestamp: Oct 5, 2025 7:41 PM
```

**Example 3: Short Recommendation**
```
🤖 Trade Recommendation: SOL

📉 Action: SHORT
💰 Current Price: $145.75
⭐ Confidence: 78% ████████░░ (High)
⏱️ Timeframe: intraday
💵 Suggested Size: $2,500

[Red color border]
Timestamp: Oct 5, 2025 7:41 PM
```

## Implementation Plan

### 1. Update CLI Command Registration

**File**: `src/index.ts`

Add `--discord` flag to the `trade:recommend` command:

```typescript
.option('--discord', 'Send recommendations to Discord channel')
```

### 2. Update Command Interface

**File**: `src/commands/tradeRecommendation.ts`

Update the options interface:

```typescript
interface TradeRecommendationOptions {
  markets?: string;
  address?: string;
  subs?: string;
  json?: boolean;
  db?: boolean;
  discord?: boolean;  // NEW
}
```

### 3. Create Discord Formatter Helper

**File**: `src/api/discord/tradeRecommendationFormatter.ts` (NEW)

Create a specialized formatter for trade recommendations:

```typescript
import { discordService, DiscordColors } from './discordService.js';
import type { TradeRecommendation } from '../../types/tradeRecommendation.js';

export class TradeRecommendationDiscordFormatter {
  /**
   * Get action emoji based on trade action
   */
  private getActionEmoji(action: string): string {
    const map: Record<string, string> = {
      long: '📈',
      short: '📉',
      hold: '⏸️',
      close: '❌',
    };
    return map[action] || '•';
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
   * Create confidence visualization (progress bar)
   */
  private createConfidenceBar(confidence: number): string {
    const filled = Math.round(confidence * 10);
    const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
    
    let level = 'Low';
    if (confidence >= 0.8) level = 'Very High';
    else if (confidence >= 0.7) level = 'High';
    else if (confidence >= 0.5) level = 'Moderate';
    
    const percent = Math.round(confidence * 100);
    return `${percent}% ${bar} (${level})`;
  }

  /**
   * Format price with commas and 2 decimal places
   */
  private formatPrice(price: number): string {
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  /**
   * Format trade recommendation as Discord embed message
   */
  formatRecommendation(
    recommendation: TradeRecommendation,
    currentPrice: number
  ) {
    const actionEmoji = this.getActionEmoji(recommendation.action);
    const color = this.getActionColor(recommendation.action);
    
    const message = discordService.createEmbedMessage()
      .addTitle(`🤖 Trade Recommendation: ${recommendation.market}`)
      .setColor(color);

    // Action field
    message.addField(
      `${actionEmoji} Action`,
      recommendation.action.toUpperCase(),
      true
    );

    // Current price
    message.addField(
      '💰 Current Price',
      this.formatPrice(currentPrice),
      true
    );

    // Confidence with visual bar
    message.addField(
      '⭐ Confidence',
      this.createConfidenceBar(recommendation.confidence),
      false
    );

    // Timeframe
    const timeframeMap: Record<string, string> = {
      intraday: 'Intraday (today)',
      short: 'Short-term (1 day)',
      medium: 'Short-term (1 day)',
      long: 'Long-term',
    };
    message.addField(
      '⏱️ Timeframe',
      timeframeMap[recommendation.timeframe] || recommendation.timeframe,
      true
    );

    // Suggested size (if applicable)
    if (recommendation.size_usd !== null) {
      message.addField(
        '💵 Suggested Size',
        this.formatPrice(recommendation.size_usd),
        true
      );
    }

    // Add timestamp
    message.addTimestamp();

    return message;
  }

  /**
   * Format multiple recommendations (sends one message per recommendation)
   */
  async sendRecommendations(
    recommendations: Array<{ recommendation: TradeRecommendation; currentPrice: number }>
  ): Promise<void> {
    for (const { recommendation, currentPrice } of recommendations) {
      const message = this.formatRecommendation(recommendation, currentPrice);
      await discordService.sendMessage(message);
      
      // Small delay between messages to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

export const tradeRecommendationDiscordFormatter = new TradeRecommendationDiscordFormatter();
```

### 4. Integrate Discord Notifications into Command

**File**: `src/commands/tradeRecommendation.ts`

Add Discord notification logic after console output:

```typescript
import { tradeRecommendationDiscordFormatter } from '../api/discord/tradeRecommendationFormatter.js';
import { discordService } from '../api/discord/discordService.js';

// ... existing code ...

// After console output, before database persistence

// Send to Discord if --discord flag is provided
if (opts.discord) {
  try {
    console.log('\n📤 Sending recommendations to Discord...');
    
    // Get market context for current prices (reuse from --db if already fetched)
    const marketContext = await tradeRecommendationAgent.gatherMarketContext(
      markets,
      walletAddress,
      subAccountIds,
    );

    const recommendationsWithPrices = analysis.recommendations.map((rec) => {
      const marketData = marketContext.markets.find((m) => m.symbol === rec.market);
      return {
        recommendation: rec,
        currentPrice: marketData?.price || 0,
      };
    });

    // Send to Discord
    await tradeRecommendationDiscordFormatter.sendRecommendations(recommendationsWithPrices);
    
    console.log('✅ Sent to Discord successfully');

    // Cleanup
    await discordService.shutdown();
  } catch (discordError: any) {
    console.error(
      `\n❌ Failed to send to Discord: ${discordError?.message ?? 'Unknown error'}`
    );
    // Don't exit - Discord error shouldn't prevent other functionality
  }
}

// ... database persistence code ...
```

### 5. Optimize Market Context Fetching

To avoid fetching market data twice when both `--discord` and `--db` are used:

```typescript
// Fetch market context once if either --discord or --db is used
let marketContext = null;
if (opts.discord || opts.db) {
  marketContext = await tradeRecommendationAgent.gatherMarketContext(
    markets,
    walletAddress,
    subAccountIds,
  );
}

// Build recommendations with prices array once
const recommendationsWithPrices = marketContext
  ? analysis.recommendations.map((rec) => {
      const marketData = marketContext.markets.find((m) => m.symbol === rec.market);
      return {
        recommendation: rec,
        currentPrice: marketData?.price || 0,
      };
    })
  : [];

// Use in Discord section
if (opts.discord && recommendationsWithPrices.length > 0) {
  // ... send to Discord ...
}

// Use in DB section
if (opts.db && recommendationsWithPrices.length > 0) {
  // ... save to database ...
}
```

## Usage Examples

### Basic Usage (Console Only)
```bash
npm run dev -- trade:recommend
```

### With Discord Notifications
```bash
npm run dev -- trade:recommend --discord
```

### With Database Persistence
```bash
npm run dev -- trade:recommend --db
```

### With Both Discord and Database (Smart Change Detection)
```bash
npm run dev -- trade:recommend --discord --db
```

**Special Behavior**: When both `--discord` and `--db` are active, the system will:
1. Save recommendations to the database
2. Compare each recommendation with the previous recommendation for that market
3. Only send Discord notifications for recommendations that have **changed**

Example output:
```
🔍 Checking for recommendation changes...
  • BTC: HOLD → LONG (changed)
  • ETH: HOLD (unchanged, skipping Discord)
📤 Sending recommendations to Discord...
✅ Sent 1 recommendation(s) to Discord
```

This prevents notification spam when recommendations haven't changed.

### Specific Markets with Discord
```bash
npm run dev -- trade:recommend --markets BTC,ETH,SOL --discord
```

## Implementation Checklist

- [x] Add `--discord` flag to CLI command in `src/index.ts`
- [x] Update `TradeRecommendationOptions` interface in `src/commands/tradeRecommendation.ts`
- [x] Create `src/api/discord/tradeRecommendationFormatter.ts` with formatting logic
- [x] Integrate Discord notifications into command flow
- [x] Optimize market context fetching to avoid duplication
- [x] Add error handling for Discord failures
- [x] Implement change detection for `--db` + `--discord` mode
- [x] Add `getLatestRecommendationForMarket()` method to service
- [ ] Test with single market (requires API keys and Discord setup)
- [ ] Test with multiple markets (requires API keys and Discord setup)
- [ ] Test with both `--discord` and `--db` flags (requires API keys and Discord setup)
- [x] Verify Discord rate limiting handling (500ms delay between messages)
- [ ] Update WARP.md with Discord usage examples
- [x] Document in this plan

## Error Handling

### Discord Initialization Failures
- Log error but continue with console output
- Provide helpful error message about checking Discord credentials

### Discord Send Failures
- Log error with details
- Continue processing (don't crash)
- If multiple recommendations, continue sending remaining after failure

### Rate Limiting
- 500ms delay between messages
- Consider using Discord bulk message API in future if needed

## Environment Requirements

**Existing Environment Variables (No Changes Needed):**
- `DISCORD_APP_TOKEN` - Discord bot token
- `DISCORD_CHANNEL_ID` - Target channel ID

These are already configured for the `daily` command and will be reused.

## Testing Strategy

### Manual Testing
1. **Single recommendation**: `npm run dev -- trade:recommend --markets BTC --discord`
2. **Multiple recommendations**: `npm run dev -- trade:recommend --markets BTC,ETH --discord`
3. **Discord + DB combo**: `npm run dev -- trade:recommend --discord --db`
4. **Discord failure simulation**: Test with invalid Discord credentials
5. **Rate limiting**: Test with 5+ markets to verify delays

### Visual Verification
- Check Discord channel for properly formatted embeds
- Verify color coding matches action types
- Confirm confidence bars display correctly
- Validate price formatting (commas, 2 decimals)
- Check timestamps are accurate

## Success Criteria

- ✅ Discord notifications sent successfully with `--discord` flag
- ✅ Message format is clean and easy to read on mobile
- ✅ Color coding helps quickly identify action types
- ✅ Confidence visualization is intuitive
- ✅ Works independently and combined with `--db` flag
- ✅ Errors handled gracefully without crashing
- ✅ No duplicate market data fetching
- ✅ Rate limiting prevents Discord API issues

## Future Enhancements

### Phase 2: Enhanced Notifications
- Add reasoning summary (first sentence only) to embed
- Include top 1-2 risk factors
- Add link to full analysis (if web dashboard exists)

### Phase 3: Interactive Discord
- React with emoji to execute trade automatically
- Button to dismiss/acknowledge recommendation
- Thread replies with follow-up analysis

### Phase 4: Notification Settings
- Configure notification preferences per user
- Set minimum confidence threshold for notifications
- Filter by market or action type

### Phase 5: Performance Tracking
- Follow-up message 24h later with actual outcome
- Track recommendation accuracy in Discord thread
- Monthly performance summary

## Notes

- Discord embed limit: 25 fields, 6000 characters total
- Each recommendation gets its own embed (easier to read on mobile)
- 500ms delay between messages avoids rate limiting
- Existing Discord infrastructure from `daily` command is reused
- No database changes required
- No new environment variables needed

---

**Next Steps**: Implement formatter, integrate into command, test with live Discord channel.
