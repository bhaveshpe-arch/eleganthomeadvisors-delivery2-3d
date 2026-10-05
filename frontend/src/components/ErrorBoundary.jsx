import React from "react";

/** Catches rendering errors so visitors see a calm message instead of a blank page or a stack trace. */
export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { failed: false };
    }
    static getDerivedStateFromError() {
        return { failed: true };
    }
    componentDidCatch(error, info) {
        // Details go to the browser console for admins/developers; visitors only see the friendly message.
        console.error("UI error:", error, info?.componentStack);
    }
    render() {
        if (!this.state.failed) return this.props.children;
        return (
            <div role="alert" className="min-h-[50vh] grid place-items-center px-6 py-24 text-center">
                <div>
                    <div className="font-serif-display text-3xl text-[var(--navy)]">Something went wrong on our side</div>
                    <p className="text-slate-600 mt-2">Please refresh the page. If it keeps happening, call us and we will help you directly.</p>
                    <button className="btn-primary mt-6" onClick={() => window.location.reload()}>Refresh page</button>
                </div>
            </div>
        );
    }
}
