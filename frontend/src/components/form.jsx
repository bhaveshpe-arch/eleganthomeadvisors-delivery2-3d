import React, { useId } from "react";

/** Labelled form controls with consistent styling, error text and ARIA wiring. */
const Wrap = ({ label, error, hint, required, id, children }) => (
    <div>
        <label htmlFor={id} className="text-xs font-medium text-slate-700">
            {label}{required && <span className="text-red-500" aria-hidden="true"> *</span>}
        </label>
        <div className="mt-1">{children}</div>
        {hint && !error && <div id={`${id}-hint`} className="text-[11px] text-slate-500 mt-1">{hint}</div>}
        {error && <div id={`${id}-err`} role="alert" className="text-xs text-red-600 mt-1">{error}</div>}
    </div>
);

const aria = (id, error, hint) => ({
    id,
    "aria-invalid": error ? "true" : undefined,
    "aria-describedby": error ? `${id}-err` : hint ? `${id}-hint` : undefined,
});

export function TextField({ label, error, hint, required, ...props }) {
    const id = useId();
    return (
        <Wrap label={label} error={error} hint={hint} required={required} id={id}>
            <input className="field-input" required={required} {...aria(id, error, hint)} {...props} />
        </Wrap>
    );
}

export function SelectField({ label, error, hint, required, children, ...props }) {
    const id = useId();
    return (
        <Wrap label={label} error={error} hint={hint} required={required} id={id}>
            <select className="field-input bg-white" required={required} {...aria(id, error, hint)} {...props}>{children}</select>
        </Wrap>
    );
}

export function TextAreaField({ label, error, hint, required, ...props }) {
    const id = useId();
    return (
        <Wrap label={label} error={error} hint={hint} required={required} id={id}>
            <textarea className="field-input resize-none" required={required} {...aria(id, error, hint)} {...props} />
        </Wrap>
    );
}
