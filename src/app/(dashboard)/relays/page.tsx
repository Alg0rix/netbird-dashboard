"use client";

import Paragraph from "@components/Paragraph";
import { Suspense } from "react";
import PageContainer from "@/layouts/PageContainer";
import RelayPolicyEditor from "@/modules/relay-policies/RelayPolicyEditor";

export default function RelaysPage() {
  return (
    <PageContainer>
      <div className="p-default py-6">
        <h1>Relays</h1>
        <Paragraph>
          Manage approved relay groups, home assignments and symmetric pair
          paths.
        </Paragraph>
      </div>
      <Suspense fallback={<p role="status">Loading relay policies…</p>}>
        <RelayPolicyEditor />
      </Suspense>
    </PageContainer>
  );
}
