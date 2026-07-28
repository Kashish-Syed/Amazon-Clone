import React from 'react';
import { logger, serializeError } from '../../lib/logger';

// Catches render-time exceptions anywhere below it.
//
// Without one of these, a single component throwing during render unmounts the
// entire React tree and the user is left staring at a white page - no message,
// no way back, and nothing in the console unless they had DevTools open before
// it happened.
//
// This is a class component because there is still no hook equivalent:
// componentDidCatch and getDerivedStateFromError only exist on classes.
//
// Note that error boundaries do NOT catch: errors inside event handlers, errors
// in async code (a rejected promise from a fetch), or errors thrown during
// server rendering. Those still need their own try/catch - which is why the
// services log their own failures rather than relying on this.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    logger.error('ui.render_error', {
      boundary: this.props.name ?? 'root',
      error: serializeError(error),
      componentStack: info?.componentStack,
    });
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="errorBoundary" role="alert">
        <h2>Something went wrong on this page.</h2>
        <p>
          The rest of the site still works. Try again, or head back to the
          homepage.
        </p>

        <div className="errorBoundary_actions">
          <button type="button" className="button-effect" onClick={this.handleReset}>
            Try again
          </button>
          <a className="errorBoundary_link" href="/">
            Go to homepage
          </a>
        </div>

        {/* Shown in development only. In production this would leak internals
            to the user and tell an attacker more than they need to know - the
            details are in the logs instead. */}
        {process.env.NODE_ENV !== 'production' && (
          <pre className="errorBoundary_details">{this.state.error.stack}</pre>
        )}
      </div>
    );
  }
}

export default ErrorBoundary;
