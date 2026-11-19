import React from "react";

type Props = {
  label: string;
  hint?: string;
  group?: boolean;
  children: React.ReactNode;
  className?: string;
};

export default function FormField({ label, hint, children, group = false, className = "" }: Props) {
  if (group) return <fieldset className={`professional-form-field app-form-group ${className}`.trim()}><legend>{label}</legend>{children}</fieldset>;
  return (
    <label className={`professional-form-field ${className}`.trim()}>
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      {children}
    </label>
  );
}
