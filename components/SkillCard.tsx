import React from 'react';

interface SkillCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    onClick: () => void;
}

const SkillCard: React.FC<SkillCardProps> = ({ icon, title, description, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="relative group p-6 rounded-lg bg-slate-800/50 border border-slate-700 transition-all duration-300 hover:border-purple-500/50 hover:-translate-y-1 text-left w-full h-full overflow-hidden"
    >
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-purple-500/20 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        <div className="relative z-10 flex flex-col">
            <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-slate-900 border border-slate-700 text-cyan-400 group-hover:text-cyan-300 transition-colors">
                {icon}
            </div>
            <h3 className="mt-5 text-lg font-semibold text-white group-hover:text-cyan-100 transition-colors">{title}</h3>
            <p className="mt-2 text-base text-slate-400 flex-grow">{description}</p>
        </div>
    </button>
  );
};

export default SkillCard;