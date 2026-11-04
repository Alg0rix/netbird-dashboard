import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRelayPolicyConfiguration } from "./useRelayPolicyConfiguration";

const response = vi.hoisted(() => ({
  data: { supported: true },
  error: undefined as { code: number } | undefined,
}));
const fetchApi = vi.hoisted(() => vi.fn());
vi.mock("@utils/api", () => ({
  default: (...args: unknown[]) => {
    fetchApi(...args);
    return response;
  },
}));
beforeEach(() => {
  response.data = { supported: true };
  response.error = undefined;
  fetchApi.mockClear();
});
describe("relay feature detection", () => {
  it("hides support after an authoritative 404 even when SWR retains previous data", () => {
    const { result, rerender } = renderHook(() =>
      useRelayPolicyConfiguration(),
    );
    expect(result.current.supported).toBe(true);
    response.error = { code: 404 };
    rerender();
    expect(result.current.supported).toBe(false);
  });
  it("keeps known support on transient errors and disables fetch when access is denied", () => {
    response.error = { code: 503 };
    const { result } = renderHook(() => useRelayPolicyConfiguration(false));
    expect(result.current.supported).toBe(true);
    expect(fetchApi.mock.calls[0][3]).toBe(false);
  });
});
