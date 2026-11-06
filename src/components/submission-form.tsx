"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { createSubmission } from "@/app/actions";
import { FindingsList } from "@/components/findings-list";
import { Button, buttonClass } from "@/components/ui/button";
import { CHANNEL_LABELS, PRODUCT_LABELS } from "@/lib/formatting";
import { screenCopy } from "@/lib/screening";
import { CHANNELS, PRODUCT_TYPES, type Channel, type Finding, type ProductType } from "@/lib/types";
import { LIMITS, parseSubmissionInput, type FieldErrors } from "@/lib/validation";

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm aria-[invalid=true]:border-high";

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-high">
          {error}
        </p>
      )}
    </div>
  );
}

export function SubmissionForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [productType, setProductType] = useState<ProductType | "">("");
  const [channel, setChannel] = useState<Channel | "">("");
  const [partnerName, setPartnerName] = useState("");
  const [copy, setCopy] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const [preview, setPreview] = useState<{ key: string; findings: Finding[] } | null>(null);

  // The preview is only valid for the exact inputs it was run against.
  const inputKey = JSON.stringify([copy.trim(), productType, channel, channel === "affiliate" ? partnerName.trim() : null]);
  const previewCurrent = preview !== null && preview.key === inputKey;
  const previewStale = preview !== null && !previewCurrent;

  function currentInput() {
    return { title, productType, channel, partnerName: channel === "affiliate" ? partnerName : null, copy };
  }

  function onChannelChange(next: Channel | "") {
    setChannel(next);
    if (next !== "affiliate") setPartnerName(""); // hide and clear the partner field
  }

  function checkCopy() {
    setFormError(null);
    const parsed = parseSubmissionInput(currentInput());
    if (!parsed.ok) {
      setErrors(parsed.errors);
      setPreview(null);
      return;
    }
    setErrors({});
    const d = parsed.data;
    setPreview({
      key: JSON.stringify([d.copy, d.productType, d.channel, d.partnerName]),
      findings: screenCopy({ productType: d.productType, channel: d.channel, partnerName: d.partnerName, copy: d.copy }),
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting.current) return; // no double inserts from repeated clicks
    setFormError(null);
    const parsed = parseSubmissionInput(currentInput());
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    setErrors({});
    submitting.current = true;
    setPending(true);
    try {
      const result = await createSubmission(parsed.data);
      if (result.ok) {
        router.push(`/submissions/${result.data.id}`); // stay disabled while navigating
        return;
      }
      setErrors(result.fieldErrors ? (result.fieldErrors as FieldErrors) : {});
      setFormError(result.message);
    } catch {
      setFormError("We couldn't reach the server. Nothing was confirmed saved. Check your connection and try again.");
    }
    submitting.current = false;
    setPending(false);
  }

  const err = (k: string) => errors[k];

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-high">
          {formError}
        </div>
      )}

      <Field id="title" label="Campaign title" error={err("title")}>
        <input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-invalid={!!err("title")}
          aria-describedby={err("title") ? "title-error" : undefined}
          className={fieldClass}
          autoComplete="off"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="productType" label="Product" error={err("productType")}>
          <select
            id="productType"
            value={productType}
            onChange={(e) => setProductType(e.target.value as ProductType | "")}
            aria-invalid={!!err("productType")}
            aria-describedby={err("productType") ? "productType-error" : undefined}
            className={fieldClass}
          >
            <option value="">Select a product</option>
            {PRODUCT_TYPES.map((p) => (
              <option key={p} value={p}>
                {PRODUCT_LABELS[p]}
              </option>
            ))}
          </select>
        </Field>
        <Field id="channel" label="Channel" error={err("channel")}>
          <select
            id="channel"
            value={channel}
            onChange={(e) => onChannelChange(e.target.value as Channel | "")}
            aria-invalid={!!err("channel")}
            aria-describedby={err("channel") ? "channel-error" : undefined}
            className={fieldClass}
          >
            <option value="">Select a channel</option>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {CHANNEL_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {channel === "affiliate" && (
        <Field id="partnerName" label="Affiliate partner name" error={err("partnerName")}>
          <input
            id="partnerName"
            value={partnerName}
            onChange={(e) => setPartnerName(e.target.value)}
            aria-invalid={!!err("partnerName")}
            aria-describedby={err("partnerName") ? "partnerName-error" : undefined}
            className={fieldClass}
            autoComplete="off"
          />
        </Field>
      )}

      <Field
        id="copy"
        label="Advertising copy"
        error={err("copy")}
        hint={`${copy.trim().length.toLocaleString()} / ${LIMITS.copy.max.toLocaleString()} characters. Text only. Do not paste real customer data.`}
      >
        <textarea
          id="copy"
          value={copy}
          onChange={(e) => setCopy(e.target.value)}
          rows={9}
          aria-invalid={!!err("copy")}
          aria-describedby={err("copy") ? "copy-error" : undefined}
          className={fieldClass}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={checkCopy} disabled={pending}>
          Check Copy
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Submitting…" : "Submit for Review"}
        </Button>
        <Link
          href="/"
          aria-disabled={pending}
          className={buttonClass("secondary", pending ? "pointer-events-none opacity-50" : "")}
        >
          Cancel
        </Link>
      </div>

      {previewStale && (
        <p role="status" className="text-sm text-medium">
          Copy changed since last check. Run Check Copy again to refresh the advisory scan.
        </p>
      )}

      {previewCurrent && (
        <section aria-label="Advisory findings" className="space-y-3 border-t border-border pt-5">
          <h2 className="text-base font-semibold">Advisory check results</h2>
          <FindingsList findings={preview.findings} />
        </section>
      )}
    </form>
  );
}
