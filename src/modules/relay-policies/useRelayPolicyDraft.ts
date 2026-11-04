"use client";

import { ErrorResponse, useApiCall } from "@utils/api";
import { useRef, useState } from "react";
import {
  RelayPolicyConfiguration,
  RelayPolicyPreview,
} from "@/interfaces/RelayPolicy";
import { configurationErrors, rebaseDraft } from "./helpers";

export function useRelayPolicyDraft(
  initial: RelayPolicyConfiguration | (() => RelayPolicyConfiguration),
  onSaved: (configuration: RelayPolicyConfiguration) => void,
  editable = true,
) {
  const [draft, setDraft] = useState(() =>
    structuredClone(typeof initial === "function" ? initial() : initial),
  );
  const current = useRef(draft);
  const approved = useRef<RelayPolicyConfiguration | undefined>(undefined);
  const pending = useRef(false);
  const [preview, setPreview] = useState<RelayPolicyPreview>();
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [message, setMessage] = useState("");
  const configurationApi = useApiCall<RelayPolicyConfiguration>(
    "/relay-policies/configuration",
    true,
  );
  const previewApi = useApiCall<RelayPolicyPreview>(
    "/relay-policies/preview",
    true,
  );
  const errors = configurationErrors(draft);

  function update(next: RelayPolicyConfiguration) {
    if (!editable) return;
    current.current = next;
    approved.current = undefined;
    setDraft(next);
    setPreview(undefined);
    setMessage("");
  }
  function failed(error: unknown) {
    const apiError = error as ErrorResponse;
    if (apiError.code === 409) {
      setConflict(true);
      setPreview(undefined);
      setMessage(
        "The configuration or catalog changed. Your draft is retained. Reload, or explicitly repreview your full draft against the latest revision before saving.",
      );
    } else {
      setMessage(
        apiError.message ||
          "The request failed. Your draft is retained; retry when Management is available.",
      );
    }
  }
  async function inspect(snapshot = current.current) {
    const validation = configurationErrors(snapshot);
    if (validation.length) {
      setMessage(validation.join(" "));
      return;
    }
    const result = await previewApi.post(snapshot);
    if (snapshot === current.current) {
      approved.current = snapshot;
      setPreview(result);
      setConflict(false);
      setMessage("");
    }
  }
  async function run(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      await action();
    } catch (error) {
      failed(error);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const requestPreview = () => run(() => inspect());
  const save = () =>
    run(async () => {
      if (
        !editable ||
        !preview ||
        approved.current !== current.current ||
        conflict ||
        errors.length ||
        preview.truncated
      )
        return;
      const snapshot = approved.current;
      const result = await configurationApi.put(snapshot);
      update(result);
      onSaved(result);
      setMessage(
        "Relay configuration saved. Endpoint application may still be pending; inspect peer relay status.",
      );
    });
  const reload = () =>
    run(async () => {
      const latest = await configurationApi.get();
      update(latest);
      onSaved(latest);
      setConflict(false);
      setMessage("Latest configuration loaded; previous draft discarded.");
    });
  const repreview = () =>
    run(async () => {
      const latest = await configurationApi.get();
      const rebased = rebaseDraft(current.current, latest);
      update(rebased);
      await inspect(rebased);
    });
  return {
    draft,
    update,
    preview,
    busy,
    conflict,
    message,
    errors,
    requestPreview,
    save,
    reload,
    repreview,
  };
}
