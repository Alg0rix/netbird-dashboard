"use client";

import useFetchApi from "@utils/api";
import { RelayPolicyConfiguration } from "@/interfaces/RelayPolicy";

export function useRelayPolicyConfiguration(enabled = true) {
  const result = useFetchApi<RelayPolicyConfiguration>(
    "/relay-policies/configuration",
    true,
    true,
    enabled,
    { shouldRetryOnError: false },
  );
  return {
    ...result,
    supported: result.data?.supported === true && result.error?.code !== 404,
  };
}
