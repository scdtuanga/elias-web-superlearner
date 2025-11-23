import React, { useState } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import SkillCard from './components/SkillCard';
import Footer from './components/Footer';
import SkillTest from './components/SkillTest';
import Snowfall from './components/Snowfall';
import Dictionary from './components/Dictionary';
import { LEARNING_SKILLS } from './constants';
import type { LearningSkill } from './types';

const App: React.FC = () => {
  const [selectedSkill, setSelectedSkill] = useState<LearningSkill | null>(null);
  const [currentView, setCurrentView] = useState<'home' | 'dictionary'>('home');

  const handleSkillSelect = (skill: LearningSkill) => {
    setSelectedSkill(skill);
  };

  const handleBackToSkills = () => {
    setSelectedSkill(null);
  };

  const scrollToSkills = () => {
    const skillsSection = document.getElementById('skills');
    if (skillsSection) {
      skillsSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="bg-black text-slate-200 min-h-screen font-sans antialiased selection:bg-cyan-500 selection:text-white">
      {/* Galaxy/Aurora Background Layer */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        {/* Deep space base */}
        <div className="absolute inset-0 bg-black"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900/20 via-black to-black"></div>
        
        {/* Aurora / Nebula clouds */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-40">
            {/* Purple Aurora */}
            <div className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] rounded-full bg-purple-600 blur-[100px] mix-blend-screen animate-pulse duration-[8000ms]"></div>
            {/* Aqua/Cyan Aurora */}
            <div className="absolute top-[10%] -right-[10%] w-[50%] h-[50%] rounded-full bg-cyan-500 blur-[100px] mix-blend-screen animate-pulse duration-[12000ms]"></div>
            {/* Greenish Aurora hint at bottom */}
            <div className="absolute -bottom-[10%] left-[20%] w-[70%] h-[50%] rounded-full bg-emerald-500/30 blur-[120px] mix-blend-screen animate-pulse duration-[15000ms]"></div>
             {/* Middle Indigo */}
            <div className="absolute top-[40%] left-[30%] w-[40%] h-[40%] rounded-full bg-indigo-600/40 blur-[100px] mix-blend-screen animate-pulse duration-[10000ms]"></div>
        </div>
      </div>

      <div className="relative isolate overflow-hidden min-h-screen z-10 flex flex-col">
        <Snowfall />
        
        <Header 
          onGoHome={() => {
            handleBackToSkills();
            setCurrentView('home');
          }} 
          hideCreator={!!selectedSkill && currentView === 'home'} 
          currentView={currentView}
          onToggleView={setCurrentView}
        />
        
        <main className="relative z-10 flex-grow">
          {currentView === 'dictionary' ? (
            <Dictionary />
          ) : selectedSkill ? (
            <SkillTest skill={selectedSkill} onBack={handleBackToSkills} />
          ) : (
            <>
              <Hero onExplore={scrollToSkills} />
              
              <div id="skills" className="py-24 sm:py-32">
                <div className="mx-auto max-w-7xl px-6 lg:px-8">
                  <div className="mx-auto max-w-2xl lg:text-center">
                    <h2 className="text-base font-bold leading-7 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">Learn Smarter</h2>
                    <p className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                      Learning English Skills
                    </p>
                    <p className="mt-6 text-lg leading-8 text-slate-400">
                      Master these four core communication skills to enhance your ability to learn and share knowledge effectively.
                    </p>
                  </div>
                  <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
                      {LEARNING_SKILLS.map((skill) => (
                        <SkillCard
                          key={skill.title}
                          icon={skill.icon}
                          title={skill.title}
                          description={skill.description}
                          onClick={() => handleSkillSelect(skill)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Features Section */}
              <div className="pb-24 sm:pb-32">
                <div className="mx-auto max-w-7xl px-6 lg:px-8">
                  <div className="mx-auto max-w-2xl lg:max-w-none">
                    <div className="rounded-2xl bg-slate-800/50 border border-slate-700 p-8 sm:p-10 backdrop-blur-sm shadow-2xl shadow-purple-900/20">
                      <h3 className="text-2xl font-bold tracking-tight text-white mb-8">🎁 Features:</h3>
                      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 text-base text-slate-300">
                        <div className="flex gap-3 items-start">
                          <span className="text-2xl" role="img" aria-label="security">🚫</span>
                          <span>Candidate can't copy or paste the answer or the test topic</span>
                        </div>
                        <div className="flex gap-3 items-start">
                          <span className="text-2xl" role="img" aria-label="books">📚</span>
                          <span>Test source from test-english.com</span>
                        </div>
                        <div className="flex gap-3 items-start">
                          <span className="text-2xl" role="img" aria-label="robot">🤖</span>
                          <span>AI checking grammar from LanguageTool AI</span>
                        </div>
                         <div className="flex gap-3 items-start">
                          <span className="text-2xl" role="img" aria-label="dictionary">📖</span>
                          <span>Dictionary from Cambridge Dictionary</span>
                        </div>
                         <div className="flex gap-3 items-start">
                          <span className="text-2xl" role="img" aria-label="code">💻</span>
                          <span className="break-all">Website Source Template: <a href="https://github.com/vinodjangid07/Pexelicons" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 hover:underline">https://github.com/vinodjangid07/Pexelicons</a></span>
                        </div>
                        <div className="flex gap-3 items-start">
                          <span className="text-2xl" role="img" aria-label="calendar">📅</span>
                          <span>Latest Update: 23 Nov 2025</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default App;