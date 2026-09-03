/** @jest-environment node */

const mockRpc = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

import { fetchRemotePremium } from "@/lib/remotePremium";

describe("fetchRemotePremium", () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it("returns true only when the is_premium RPC reports true", async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });
    await expect(
      fetchRemotePremium("2c1a0b8e-4f3d-4a91-9c2e-7b6a5d4c3b2a")
    ).resolves.toBe(true);
    expect(mockRpc).toHaveBeenCalledWith("is_premium", {
      check_user_id: "2c1a0b8e-4f3d-4a91-9c2e-7b6a5d4c3b2a",
    });
  });

  it("fails closed on a network or RPC error", async () => {
    mockRpc.mockResolvedValue({ data: true, error: { message: "timeout" } });
    await expect(
      fetchRemotePremium("2c1a0b8e-4f3d-4a91-9c2e-7b6a5d4c3b2a")
    ).resolves.toBe(false);
  });

  it("fails closed when the RPC throws", async () => {
    mockRpc.mockRejectedValue(new Error("network"));
    await expect(
      fetchRemotePremium("2c1a0b8e-4f3d-4a91-9c2e-7b6a5d4c3b2a")
    ).resolves.toBe(false);
  });
});
