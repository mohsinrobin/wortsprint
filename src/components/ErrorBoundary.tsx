// Catches render errors so one broken page shows a way back instead of a
// blank screen. Saved progress lives in IndexedDB and is not touched.
import { Component, type ReactNode } from 'react';
import { useT } from '../lib/i18n';

interface State {
  failed: boolean;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  componentDidMount() {
    window.addEventListener('hashchange', this.reset);
  }

  componentWillUnmount() {
    window.removeEventListener('hashchange', this.reset);
  }

  /** Any navigation gives the app another try. */
  reset = () => {
    if (this.state.failed) this.setState({ failed: false });
  };

  render() {
    return this.state.failed ? <Fallback /> : this.props.children;
  }
}

function Fallback() {
  const t = useT();
  const home = () => {
    if (window.location.hash && window.location.hash !== '#/') window.location.hash = '/';
    else window.location.reload();
  };
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="card max-w-sm p-6 text-center">
        <h1 className="text-xl font-semibold">{t('crashTitle')}</h1>
        <p className="mt-2 text-[15px] text-pencil">{t('crashBody')}</p>
        <button className="btn-primary mt-5 w-full py-3" onClick={home}>
          {t('crashHome')}
        </button>
      </div>
    </div>
  );
}
