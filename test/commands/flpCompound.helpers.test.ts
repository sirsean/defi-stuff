import { describe, it, expect } from "vitest";
import {
  hexToAddressFromTopic,
  parseUsdcTransfersToRecipient,
} from "../../src/commands/helpers/flpCompound.helpers.js";

describe("flpCompound helpers", () => {
  it("hexToAddressFromTopic extracts last 20 bytes as address", () => {
    const topic =
      "0x000000000000000000000000A0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    const addr = hexToAddressFromTopic(topic);
    expect(addr.toLowerCase()).toBe(
      "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    );
  });

  it("parseUsdcTransfersToRecipient sums matching Transfer logs to recipient", () => {
    const transferTopic = "0xtransfer";
    const usdc = "0xuuu";
    const me = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
    const logs = [
      // wrong token
      {
        address: "0xnotusdc",
        topics: [
          transferTopic,
          "0x",
          "0x" + "0".repeat(24) + "DEADbeefDEADbeefDEADbeefDEADbeefDEADbeef",
        ],
        data: "0x10",
      },
      // correct token, wrong topic
      {
        address: usdc,
        topics: [
          "0xothertopic",
          "0x",
          "0x" + "0".repeat(24) + "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
        ],
        data: "0x10",
      },
      // correct token, correct topic, to me
      {
        address: usdc,
        topics: [
          transferTopic,
          "0x",
          "0x" + "0".repeat(24) + "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
        ],
        data: "0x2a",
      },
      // correct token, correct topic, to someone else
      {
        address: usdc,
        topics: [
          transferTopic,
          "0x",
          "0x" + "0".repeat(24) + "ffffffffffffffffffffffffffffffffffffffff",
        ],
        data: "0x05",
      },
    ];
    const total = parseUsdcTransfersToRecipient(
      logs as any,
      transferTopic,
      usdc,
      me,
    );
    expect(total).toBe(0x2an);
  });
});
