import React from "react";

type Props = { label: string; hint?: string; children: React.ReactNode; className?: string };

export default function FormField({ label, hint, children, className = "" }: Props) {
  return <label className={`app-form-field ${className}`.trim()}><span>{label}{hint && <small>{hint}</small>}</span>{children}</label>;
}
