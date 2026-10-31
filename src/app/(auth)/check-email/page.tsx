"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { EnvelopeSimple } from "@phosphor-icons/react/dist/ssr";

export default function CheckEmailPage() {
  return (
    <Suspense fallback={<Shell />}>
      <Confirmation />
    </Suspense>
  );
}

function Confirmation() {
  const email = useSearchParams().get("email");
  return (
    <Shell>
      {email ? (
        <>
          We sent a link to <span className="text-text">{email}</span>. Open it on this phone
          and you will land straight in setup.
        </>
      ) : (
        <>Open the link we just sent you, on this phone, to finish setting up.</>
      )}
    </Shell>
  );
}

function Shell({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <EnvelopeSimple size={32} weight="duotone" className="text-accent" />
      <div>
        <h1 className="text-[1.75rem] font-light leading-none tracking-tight">Confirm your email</h1>
        <p className="mt-1.5 text-sm text-muted">
          {children ?? "Open the link we just sent you, on this phone, to finish setting up."}
        </p>
      </div>
      <p className="text-sm text-muted">
        Nothing arrived? Check spam, then{" "}
        <Link href="/signup" className="font-medium text-accent underline-offset-4 hover:underline">
          try again
        </Link>
        .
      </p>
    </div>
  );
}
