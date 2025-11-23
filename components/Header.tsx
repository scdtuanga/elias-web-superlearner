import React from 'react';

interface HeaderProps {
  onGoHome: () => void;
  hideCreator?: boolean;
  currentView: 'home' | 'dictionary';
  onToggleView: (view: 'home' | 'dictionary') => void;
}

const Header: React.FC<HeaderProps> = ({ onGoHome, hideCreator = false, currentView, onToggleView }) => {
  return (
    <header className="absolute inset-x-0 top-0 z-50">
      <style>
        {`
          @keyframes rainbow {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          .animate-rainbow {
            background: linear-gradient(270deg, #22d3ee, #818cf8, #c084fc, #e879f9, #22d3ee);
            background-size: 400% 400%;
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
            animation: rainbow 8s ease infinite;
          }
        `}
      </style>
      <nav className="flex items-center justify-between p-6 lg:px-8 relative min-h-[5rem]" aria-label="Global">
        
        {/* Left Side: Logo */}
        <div className="flex z-20">
          <button onClick={() => { onGoHome(); onToggleView('home'); }} className="-m-1.5 p-1.5 flex items-center gap-2 group hover:opacity-80 transition-opacity">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-cyan-400 group-hover:scale-110 transition-transform duration-300">
              <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 0 1 .359.852L12.982 9.75h7.268a.75.75 0 0 1 .548 1.262l-10.5 11.25a.75.75 0 0 1-1.272-.71l2.15-7.5H4.5a.75.75 0 0 1-.548-1.262l10.5-11.25a.75.75 0 0 1 .913-.143Z" clipRule="evenodd" />
            </svg>
            <span className="text-xl font-bold tracking-tight animate-rainbow hidden sm:block">Superlearner</span>
          </button>
        </div>

        {/* Center: Slice Animation Toggle Button */}
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 w-full max-w-[340px] sm:max-w-md flex justify-center">
            <div className="relative flex items-center bg-slate-900/80 backdrop-blur-md rounded-full p-1.5 border border-slate-700 shadow-lg shadow-black/20">
                {/* The Sliding Background */}
                <div 
                    className={`absolute top-1.5 bottom-1.5 rounded-full bg-gradient-to-r from-purple-600 to-cyan-600 transition-all duration-300 ease-out shadow-md ${
                        currentView === 'home' ? 'left-1.5 w-[calc(50%-6px)]' : 'left-[calc(50%+3px)] w-[calc(50%-6px)]'
                    }`}
                ></div>

                {/* Button 1: Learning English Skills */}
                <button
                    onClick={() => {
                        onToggleView('home');
                        onGoHome(); // Reset selected skill if any
                    }}
                    className={`relative z-10 px-4 py-2 text-xs sm:text-sm font-medium rounded-full transition-colors duration-200 w-40 sm:w-48 text-center truncate ${
                        currentView === 'home' ? 'text-white' : 'text-slate-400 hover:text-white'
                    }`}
                >
                    Learning English Skills
                </button>

                {/* Button 2: English Dictionary */}
                <button
                    onClick={() => onToggleView('dictionary')}
                    className={`relative z-10 px-4 py-2 text-xs sm:text-sm font-medium rounded-full transition-colors duration-200 w-40 sm:w-48 text-center truncate ${
                        currentView === 'dictionary' ? 'text-white' : 'text-slate-400 hover:text-white'
                    }`}
                >
                    English Dictionary
                </button>
            </div>
        </div>

        {/* Right Side: Creator Info */}
        {!hideCreator && (
          <div className="flex items-center gap-4 z-10">
            <span className="text-xl font-bold tracking-tight hidden lg:block animate-rainbow underline decoration-cyan-400 underline-offset-4 decoration-2">Created By Elias</span>
            <img 
              className="h-10 w-auto object-contain sm:h-14" 
              src="https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/CSS3_logo_and_wordmark.svg/851px-CSS3_logo_and_wordmark.svg.png"  
              alt="Creator logo" 
            />
          </div>
        )}
      </nav>
    </header>
  );
};

export default Header;