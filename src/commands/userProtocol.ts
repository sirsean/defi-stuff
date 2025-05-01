import { UserProtocolService } from "../api/debank/userProtocolService.js";
import { TokenInfo, UserPortfolioItem } from "../types/debank.js";

interface UserProtocolCommandOptions {
  address?: string;
  json?: boolean;
}

/**
 * Command to retrieve and display user protocol data
 * @param protocolId The protocol ID to query
 * @param options Command options
 */
export async function userProtocol(
  protocolId: string,
  options: UserProtocolCommandOptions,
): Promise<void> {
  try {
    if (!protocolId) {
      console.error("Protocol ID parameter is required");
      process.exit(1);
    }

    console.log(`Fetching protocol data for protocol ${protocolId}...`);

    const userProtocolService = new UserProtocolService();

    // Override wallet address if provided in options
    if (options.address) {
      userProtocolService.setWalletAddress(options.address);
    }

    const protocolData =
      await userProtocolService.getUserProtocolData(protocolId);

    // If json option is provided, just print the raw JSON
    if (options.json) {
      console.log(JSON.stringify(protocolData, null, 2));
      return;
    }

    // Calculate total values from portfolio items
    const totalAssetValue = protocolData.portfolio_item_list.reduce(
      (sum, item) => sum + item.stats.asset_usd_value,
      0,
    );

    const totalDebtValue = protocolData.portfolio_item_list.reduce(
      (sum, item) => sum + item.stats.debt_usd_value,
      0,
    );

    const netValue = totalAssetValue - totalDebtValue;

    // Display protocol overview
    console.log(`\n===== ${protocolData.name} (${protocolData.id}) =====`);
    console.log(`Chain: ${protocolData.chain}`);
    console.log(`Website: ${protocolData.site_url}`);
    console.log(
      `TVL: $${protocolData.tvl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    );
    console.log(
      `Total Asset Value: $${totalAssetValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    );

    if (totalDebtValue > 0) {
      console.log(
        `Total Debt: $${totalDebtValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      );
      console.log(
        `Net Value: $${netValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      );
    }

    // Display portfolio items
    if (protocolData.portfolio_item_list.length === 0) {
      console.log("\nNo portfolio items found");
    } else {
      console.log(
        `\nPortfolio Items (${protocolData.portfolio_item_list.length}):`,
      );

      protocolData.portfolio_item_list.forEach((item) => {
        displayPortfolioItem(item);
      });
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error fetching user protocol data:", error.message);
      console.error(error);
    } else {
      console.error("Unexpected error:", error);
    }
    process.exit(1);
  }
}

/**
 * Display a portfolio item's details
 * @param item The portfolio item to display
 */
function displayPortfolioItem(item: UserPortfolioItem): void {
  console.log(`\n--- ${item.name} ---`);
  console.log(
    `Value: $${item.stats.asset_usd_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  );

  if (item.stats.debt_usd_value > 0) {
    console.log(
      `Debt: $${item.stats.debt_usd_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    );
    console.log(
      `Net: $${item.stats.net_usd_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    );
  }

  console.log(`Updated: ${new Date(item.update_at * 1000).toLocaleString()}`);

  // Display token details
  if (
    item.detail.supply_token_list &&
    item.detail.supply_token_list.length > 0
  ) {
    console.log("\nSupplied Assets:");
    displayTokenList(item.detail.supply_token_list);
  }

  if (
    item.detail.reward_token_list &&
    item.detail.reward_token_list.length > 0
  ) {
    console.log("\nReward Assets:");
    displayTokenList(item.detail.reward_token_list);
  }

  if (
    item.detail.borrow_token_list &&
    item.detail.borrow_token_list.length > 0
  ) {
    console.log("\nBorrowed Assets:");
    displayTokenList(item.detail.borrow_token_list);
  }
}

/**
 * Display a list of tokens with their values
 * @param tokens The tokens to display
 */
function displayTokenList(tokens: TokenInfo[]): void {
  tokens.forEach((token) => {
    const formattedAmount = token.amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });

    // Calculate USD value from price and amount if usd_value is not available
    const usdValue =
      token.usd_value !== undefined
        ? token.usd_value
        : token.price * token.amount;

    const valueDisplay = `$${usdValue.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

    console.log(`  ${formattedAmount} ${token.symbol} (${valueDisplay})`);
  });
}
