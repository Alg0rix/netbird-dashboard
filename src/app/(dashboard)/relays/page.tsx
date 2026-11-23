"use client";

import Breadcrumbs from "@components/Breadcrumbs";
import Button from "@components/Button";
import Paragraph from "@components/Paragraph";
import { RadioTower } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import PageContainer from "@/layouts/PageContainer";
import RelayControl from "@/modules/relay-control/RelayControl";
import RelayPolicyEditor from "@/modules/relay-policies/RelayPolicyEditor";

const ADVANCED_PARAMS = ["advanced", "policy", "profile", "peer", "scope", "remote"];

function RelaysContent() {
  const params = useSearchParams();
  const advanced = ADVANCED_PARAMS.some((key) => params.has(key));
  return (
    <PageContainer>
      <div className="p-default py-6">
        <Breadcrumbs>
          <Breadcrumbs.Item
            href="/relays"
            label="Relays"
            icon={<RadioTower size={13} />}
          />
          {advanced && <Breadcrumbs.Item label="Advanced rules" active />}
        </Breadcrumbs>
        <h1>{advanced ? "Advanced rules" : "Relays"}</h1>
        <Paragraph>
          {advanced
            ? "Home profiles, pair rules and relay groups for fine-grained control."
            : "Choose which relay each device uses and see how fast it is."}
        </Paragraph>
        {!advanced && (
          <Link href="/relays?advanced=1" className="inline-block mt-4">
            <Button variant="secondary" size="xs">
              Advanced rules
            </Button>
          </Link>
        )}
      </div>
      {advanced ? <RelayPolicyEditor /> : <RelayControl />}
    </PageContainer>
  );
}

export default function RelaysPage() {
  return (
    <Suspense fallback={<p role="status">Loading…</p>}>
      <RelaysContent />
    </Suspense>
  );
}
