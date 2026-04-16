import React from 'react';

const shouldExposeErrorDetail = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  return ['localhost', '127.0.0.1'].includes(window.location.hostname);
};

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      message: '',
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || 'Unexpected startup error.',
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Air Bowl startup error', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-fallback">
          <div className="app-fallback__panel">
            <p className="app-fallback__eyebrow">Air Bowl</p>
            <h1 className="app-fallback__title">The app hit a loading problem.</h1>
            <p className="app-fallback__copy">
              Reload once and allow camera access if the browser asks. If this keeps happening,
              the page is still loading but one startup component is failing.
            </p>
            {shouldExposeErrorDetail() ? (
              <p className="app-fallback__detail">{this.state.message}</p>
            ) : null}
            <button type="button" className="app-fallback__button" onClick={this.handleReload}>
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;
