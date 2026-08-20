/** @jest-environment node */

const mockMaybeSingle = jest.fn();
const mockUpdateEq = jest.fn();
const mockUpdate = jest.fn(() => ({ eq: mockUpdateEq }));
const mockFrom = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

import { ensureAppProfile } from "@/lib/sync";
import type { User } from "@supabase/supabase-js";

describe("ensureAppProfile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: mockMaybeSingle,
        }),
      }),
      update: mockUpdate,
    }));
    mockUpdateEq.mockResolvedValue({ error: null });
  });

  it("fills empty profile fields from auth metadata and does not overwrite set values", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        email: null,
        avatar_url: "https://existing.example/a.png",
        display_name: null,
      },
    });

    await ensureAppProfile({
      id: "user-1",
      email: "daniel@example.com",
      user_metadata: {
        full_name: "Daniel Lim",
        avatar_url: "https://new.example/a.png",
      },
    } as unknown as User);

    expect(mockUpdate).toHaveBeenCalledWith({
      email: "daniel@example.com",
      display_name: "Daniel Lim",
    });
    expect(mockUpdateEq).toHaveBeenCalledWith("id", "user-1");
  });

  it("no-ops when the profile already has identity fields", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        email: "daniel@example.com",
        avatar_url: "https://existing.example/a.png",
        display_name: "Mochi",
      },
    });

    await ensureAppProfile({
      id: "user-1",
      email: "other@example.com",
      user_metadata: { full_name: "Other", avatar_url: "https://new.example/a.png" },
    } as unknown as User);

    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
