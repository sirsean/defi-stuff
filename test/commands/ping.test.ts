import { describe, it, expect } from "vitest";
import { ping } from "../../src/commands/ping.js";
import { setupConsoleMocks, ConsoleMock } from "../utils/consoleMock.js";

describe("ping command", () => {
  // Set up console mocks for each test
  setupConsoleMocks();

  it("should indicate that the application is running", () => {
    // Execute the ping command
    ping();

    // Verify that the function logs the expected messages
    expect(ConsoleMock.log).toHaveBeenCalledTimes(2);
    expect(ConsoleMock.log).toHaveBeenNthCalledWith(
      1,
      "🔥 defi-stuff is running!",
    );
    expect(ConsoleMock.log).toHaveBeenNthCalledWith(
      2,
      "✅ Environment is properly configured",
    );

    // Verify that no errors were logged
    expect(ConsoleMock.error).not.toHaveBeenCalled();

    // Verify that process.exit was not called
    expect(ConsoleMock.exit).not.toHaveBeenCalled();
  });
});
