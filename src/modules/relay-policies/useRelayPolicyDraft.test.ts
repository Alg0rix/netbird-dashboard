import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  RelayPolicyConfiguration,
  RelayPolicyPreview,
} from "@/interfaces/RelayPolicy";
import { useRelayPolicyDraft } from "./useRelayPolicyDraft";

const api = vi.hoisted(() => ({ post: vi.fn(), put: vi.fn(), get: vi.fn() }));
vi.mock("@utils/api", () => ({ useApiCall: () => api }));
const configuration = (): RelayPolicyConfiguration => ({
  supported: true,
  revision: 4,
  catalog_generation: 2,
  groups: [],
  home_profiles: [],
  pair_policies: [],
});
const preview: RelayPolicyPreview = {
  revision: 4,
  catalog_generation: 2,
  home: [],
  pairs: [],
  truncated: false,
};
beforeEach(() => {
  vi.resetAllMocks();
  api.post.mockResolvedValue(preview);
  api.put.mockResolvedValue({ ...configuration(), revision: 5 });
});

describe("relay preview and confirmation", () => {
  it("invalidates preview on edit and cannot save an unpreviewed draft", async () => {
    const { result } = renderHook(() =>
      useRelayPolicyDraft(configuration(), vi.fn()),
    );
    await act(() => result.current.requestPreview());
    act(() =>
      result.current.update({
        ...result.current.draft,
        groups: [{ id: "g", name: "Regional", revision: 0, relay_ids: [] }],
      }),
    );
    await act(() => result.current.save());
    expect(api.put).not.toHaveBeenCalled();
    expect(result.current.preview).toBeUndefined();
  });
  it("retains stale drafts, then explicitly refreshes fences and previews again", async () => {
    const { result } = renderHook(() =>
      useRelayPolicyDraft(configuration(), vi.fn()),
    );
    await act(() => result.current.requestPreview());
    api.put.mockRejectedValueOnce({ code: 409, message: "stale" });
    await act(() => result.current.save());
    expect(result.current.conflict).toBe(true);
    expect(result.current.draft.revision).toBe(4);
    api.get.mockResolvedValue({
      ...configuration(),
      revision: 9,
      catalog_generation: 3,
    });
    await act(() => result.current.repreview());
    expect(api.post).toHaveBeenLastCalledWith({
      ...configuration(),
      revision: 9,
      catalog_generation: 3,
    });
    expect(result.current.conflict).toBe(false);
    expect(api.put).toHaveBeenCalledTimes(1);
  });
  it("ignores a delayed preview for an older draft and deduplicates pending submissions", async () => {
    let finish!: (value: RelayPolicyPreview) => void;
    api.post.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = renderHook(() =>
      useRelayPolicyDraft(configuration(), vi.fn()),
    );
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.requestPreview();
      void result.current.requestPreview();
    });
    expect(api.post).toHaveBeenCalledTimes(1);
    act(() =>
      result.current.update({
        ...configuration(),
        groups: [{ id: "g", name: "Changed", revision: 0, relay_ids: [] }],
      }),
    );
    await act(async () => {
      finish(preview);
      await pending;
    });
    expect(result.current.preview).toBeUndefined();
  });
  it("never mutates a draft or submits when update permission is denied", async () => {
    const { result } = renderHook(() =>
      useRelayPolicyDraft(configuration(), vi.fn(), false),
    );
    act(() => result.current.update({ ...configuration(), revision: 100 }));
    expect(result.current.draft.revision).toBe(4);
    await act(() => result.current.save());
    expect(api.put).not.toHaveBeenCalled();
  });
  it("blocks truncated previews from confirmation", async () => {
    api.post.mockResolvedValue({ ...preview, truncated: true });
    const { result } = renderHook(() =>
      useRelayPolicyDraft(configuration(), vi.fn()),
    );
    await act(() => result.current.requestPreview());
    await waitFor(() => expect(result.current.preview?.truncated).toBe(true));
    await act(() => result.current.save());
    expect(api.put).not.toHaveBeenCalled();
  });
});
