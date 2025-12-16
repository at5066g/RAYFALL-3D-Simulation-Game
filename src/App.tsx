import React, { useState } from 'react';
import { Game } from './components/Game';
import { Homepage } from './components/Homepage';
import { type DifficultyLevel } from './types';

const App: React.FC = () => {
  const [difficulty, setDifficulty] = useState<DifficultyLevel | null>(null);

  return (
    <div className="w-screen h-screen bg-neutral-900 flex items-center justify-center font-sans text-white overflow-hidden relative">
      {/* Background grid effect */}
      <div className="absolute inset-0 opacity-5 pointer-events-none" 
           style={{ 
             backgroundImage: 'linear-gradient(#444 1px, transparent 1px), linear-gradient(90deg, #444 1px, transparent 1px)',
             backgroundSize: '40px 40px'
           }} 
      />
      
      {!difficulty ? (
        <Homepage onStart={setDifficulty} />
      ) : (
        <Game difficulty={difficulty} onExit={() => setDifficulty(null)} />
      )}
    </div>
  );
};

export default App;