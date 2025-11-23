import React, { useState } from 'react';
import { GoogleGenAI, Type } from '@google/genai';

const Dictionary: React.FC = () => {
  const [word, setWord] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      if (!process.env.API_KEY) {
        throw new Error("API Key missing");
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Provide a detailed dictionary definition for the word "${word}". 
        Act as the Cambridge Dictionary. 
        Include the word, phonetic transcription (IPA), and a list of meanings. 
        For each meaning, include the part of speech, a clear definition, and at least one example sentence if possible.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              word: { type: Type.STRING },
              phonetic: { type: Type.STRING },
              meanings: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    partOfSpeech: { type: Type.STRING },
                    definitions: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          definition: { type: Type.STRING },
                          example: { type: Type.STRING },
                        },
                        required: ["definition"]
                      },
                    },
                  },
                  required: ["partOfSpeech", "definitions"]
                },
              },
            },
            required: ["word", "meanings"]
          }
        }
      });

      const text = response.text;
      if (!text) throw new Error("No data returned");
      const data = JSON.parse(text);
      setResult(data);
    } catch (err) {
      console.error(err);
      setError("We couldn't retrieve the definition at this time. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-24 px-6 sm:px-8 flex flex-col items-center animate-fade-in">
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
      `}</style>
      <div className="max-w-3xl w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl mb-4">
            English Dictionary
          </h2>
          <p className="text-slate-400">
            Search for clear definitions, phonetics, and examples.
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="relative group z-10">
          <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-cyan-600 rounded-full blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
          <div className="relative flex items-center bg-slate-900 rounded-full border border-slate-700 p-1 pr-2">
            <input
              type="text"
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder="Type a word..."
              className="flex-grow bg-transparent border-none focus:ring-0 focus:outline-none text-white placeholder-slate-500 px-6 py-3 text-lg rounded-l-full"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-slate-800 text-cyan-400 p-3 hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              {loading ? (
                 <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                 </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
              )}
            </button>
          </div>
        </form>

        {/* Results Area */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 min-h-[200px] flex flex-col justify-center">
            
            {error && (
                <div className="text-center text-red-400 bg-red-400/10 p-4 rounded-lg">
                    <p>{error}</p>
                </div>
            )}

            {!result && !loading && !error && (
                <div className="text-center text-slate-500">
                    Enter a word above to search definitions.
                </div>
            )}

            {result && (
                <div className="space-y-6 animate-fade-in text-left">
                    <div className="flex items-baseline justify-between border-b border-slate-700 pb-4">
                        <h3 className="text-4xl font-bold text-white capitalize">{result.word}</h3>
                        {result.phonetic && <span className="text-cyan-400 font-mono text-lg">{result.phonetic}</span>}
                    </div>

                    {result.meanings.map((meaning: any, index: number) => (
                        <div key={index} className="space-y-3">
                            <h4 className="text-lg font-semibold text-purple-400 italic">{meaning.partOfSpeech}</h4>
                            <ul className="space-y-4">
                                {meaning.definitions.map((def: any, idx: number) => (
                                    <li key={idx} className="text-slate-300">
                                        <div className="flex gap-2">
                                            <span className="text-cyan-500 font-bold">•</span>
                                            <span className="font-medium text-lg">{def.definition}</span>
                                        </div>
                                        {def.example && (
                                            <div className="mt-1 ml-5 pl-3 border-l-2 border-slate-600 text-slate-400 italic">
                                                "{def.example}"
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Dictionary;