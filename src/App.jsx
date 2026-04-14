import GameScene from './components/GameScene';
import AppErrorBoundary from './components/AppErrorBoundary';
import './index.css';

function App() {
  return (
    <AppErrorBoundary>
      <GameScene />
    </AppErrorBoundary>
  );
}

export default App;
