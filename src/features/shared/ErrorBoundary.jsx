import { Component } from "react";

/**
 * Catches JS errors thrown while rendering anything inside it (a whole
 * dashboard, a modal, a form) and shows a friendly, recoverable screen
 * instead of leaving the user staring at a blank white page.
 *
 * This only catches errors during render/lifecycle — it can't catch
 * errors inside event handlers (those are already caught individually by
 * the try/catch blocks throughout the app) or inside async code. That's
 * expected: this is a last-resort net for the unexpected crash, not a
 * replacement for handling known error cases where they happen.
 *
 * Usage: <ErrorBoundary label="Admin dashboard"><AdminDashboard /></ErrorBoundary>
 * `label` is just for the message shown to the user and the console log —
 * it's what lets you tell which part of the app crashed from a screenshot.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Same pattern as the rest of the app's catch blocks — logged to the
    // console rather than sent anywhere, since there's no error-reporting
    // backend set up yet.
    console.error(`[ErrorBoundary${this.props.label ? `: ${this.props.label}` : ""}]`, error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-100 max-w-md mx-auto mt-8 text-center space-y-3">
          <p className="text-3xl">⚠️</p>
          <h3 className="font-bold text-slate-800">
            {this.props.label ? `${this.props.label} hit a problem` : "Something went wrong"}
          </h3>
          <p className="text-slate-500 text-sm">
            This part of the app ran into an unexpected error. Your other data is safe —
            try reloading. If it keeps happening, let an admin know what you were doing
            right before this appeared.
          </p>
          <div className="flex gap-2 justify-center pt-2">
            <button
              onClick={this.handleReset}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-sm transition"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="bg-[#1a3a8f] hover:bg-[#122b6e] text-white font-bold px-4 py-2 rounded-xl text-sm transition"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
