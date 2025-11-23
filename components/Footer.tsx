import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-900/50 border-t border-slate-800/50 backdrop-blur-xl z-10 relative">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative">
            
            {/* Copyright - Left aligned */}
            <div className="order-2 md:order-1 w-full md:w-1/3 flex justify-start">
                 <p className="text-xs leading-5 text-slate-500 text-left">
                    &copy; {new Date().getFullYear()} CKE Network. All rights reserved.
                </p>
            </div>

            {/* Contacts - Center on desktop, Top on mobile */}
            <div className="order-1 md:order-2 flex flex-wrap justify-center gap-6 md:absolute md:left-1/2 md:-translate-x-1/2">
                
                {/* Email with Hover Popup */}
                <div className="relative group flex items-center justify-center">
                    <a href="mailto:karxukafil@outlook.com" className="flex items-center gap-2 text-slate-400 hover:text-cyan-400 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                             <path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z" />
                             <path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z" />
                        </svg>
                        <span className="text-sm hidden sm:inline">Email</span>
                    </a>
                    
                    {/* Popup Content */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 hidden group-hover:block w-max">
                        <div className="bg-slate-800 text-cyan-400 text-base px-4 py-2 rounded-md border border-slate-700 shadow-lg relative">
                            karxukafil@outlook.com
                            {/* Arrow */}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-700"></div>
                        </div>
                    </div>
                </div>

                {/* Discord with Hover Popup */}
                <div className="relative group flex items-center justify-center cursor-default">
                    <div className="flex items-center gap-2 text-slate-400 hover:text-indigo-400 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                             <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.118.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                        </svg>
                        <span className="text-sm hidden sm:inline">Discord</span>
                    </div>

                    {/* Popup Content */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 hidden group-hover:block w-max">
                        <div className="bg-slate-800 text-indigo-400 text-base px-4 py-2 rounded-md border border-slate-700 shadow-lg relative">
                            elias_dalziel
                            {/* Arrow */}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-700"></div>
                        </div>
                    </div>
                </div>

                {/* Facebook */}
                <a href="https://facebook.com/eliasdlz999" target="_blank" rel="noopener noreferrer" className="group flex items-center gap-2 text-slate-400 hover:text-blue-500 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                         <path d="M12 2.04c-5.5 0-10 4.49-10 10.02 0 5 3.66 9.15 8.44 9.9v-7H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.89 3.77-3.89 1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.9h-2.33v7a10 10 0 0 0 8.44-9.9c0-5.53-4.5-10.02-10-10.02Z" />
                    </svg>
                    <span className="text-sm hidden sm:inline">Facebook</span>
                </a>
            </div>

            {/* Empty Right side for spacing balance on desktop */}
             <div className="hidden md:block md:w-1/3"></div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;