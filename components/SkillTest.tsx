import React, { useState, useMemo, useEffect, useRef } from 'react';
import { GoogleGenAI, Type, Modality } from '@google/genai';
import type { LearningSkill } from '../types';

interface SkillTestProps {
  skill: LearningSkill;
  onBack: () => void;
}

// Define specific types for our quizzes for better type safety
interface StandardQuiz {
  question: string;
  answer: string;
}

interface ReadingQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
}

interface WritingTask {
  prompt: string;
  key_points: string[];
  model_answer: string;
}

interface WritingFeedback {
  score: number;
  grammar_corrections: string;
  content_feedback: string;
}

interface ListeningTestFormat {
    transcript: string;
    questions: ReadingQuestion[];
}

interface SpeakingStory {
    story: string;
}

type QuizQuestion = StandardQuiz | ReadingQuestion;

// Helper: Levenshtein Distance for fuzzy matching
const getLevenshteinDistance = (a: string, b: string) => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    
    const matrix = [];
    
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    Math.min(
                        matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1  // deletion
                    )
                );
            }
        }
    }
    
    return matrix[b.length][a.length];
};

const SkillTest: React.FC<SkillTestProps> = ({ skill, onBack }) => {
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[] | null>(null);
  const [readingPassage, setReadingPassage] = useState<string | null>(null);
  const [listeningData, setListeningData] = useState<ListeningTestFormat | null>(null);
  const [writingTestData, setWritingTestData] = useState<WritingTask | null>(null);
  const [speakingData, setSpeakingData] = useState<SpeakingStory | null>(null);
  
  // Audio specific state (Listening)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);
  
  // Audio Cache
  const audioCache = useRef<Map<string, AudioBuffer>>(new Map());
  const audioLoadingPromises = useRef<Map<string, Promise<AudioBuffer>>>(new Map());
  
  // Writing specific state
  const [userWriting, setUserWriting] = useState("");
  const [writingFeedback, setWritingFeedback] = useState<WritingFeedback | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Speaking specific state
  const [isRecording, setIsRecording] = useState(false);
  const [spokenText, setSpokenText] = useState('');
  const [pronunciationScore, setPronunciationScore] = useState<number | null>(null);
  const recognitionRef = useRef<any>(null);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [testState, setTestState] = useState<'idle' | 'loading' | 'in-progress' | 'completed'>('idle');
  const [error, setError] = useState<string | null>(null);
  
  // State for the current question
  const [showAnswer, setShowAnswer] = useState(false);
  const [questionAnswered, setQuestionAnswered] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});

  // State for the whole test
  const [score, setScore] = useState({ correct: 0, total: 0 });

  // State for microphone permissions
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'requesting'>('prompt');
  
  const isReadingTest = useMemo(() => skill.title === 'Reading', [skill.title]);
  const isListeningTest = useMemo(() => skill.title === 'Listening', [skill.title]);
  const isWritingTest = useMemo(() => skill.title === 'Writing', [skill.title]);
  const isSpeakingTest = useMemo(() => skill.title === 'Speaking', [skill.title]);
  
  // Speaking test needs microphone
  const needsMicrophone = useMemo(() => isSpeakingTest, [isSpeakingTest]);
  const currentQuestion = quizQuestions ? quizQuestions[currentQuestionIndex] : null;


  useEffect(() => {
    if (needsMicrophone) {
      const checkPermissions = async () => {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          setPermissionState(permissionStatus.state);
          permissionStatus.onchange = () => {
            setPermissionState(permissionStatus.state);
          };
        } catch (e) {
          console.error("Could not query microphone permissions:", e);
          setPermissionState('prompt');
        }
      };
      checkPermissions();
    } else {
      setPermissionState('granted');
    }
  }, [needsMicrophone]);

  // Cleanup audio/recognition on unmount
  useEffect(() => {
      return () => {
          stopAudio();
          if (recognitionRef.current) {
              try {
                  recognitionRef.current.stop();
              } catch(e) {/* ignore */}
          }
          if (audioContextRef.current) {
            audioContextRef.current.close();
          }
          audioCache.current.clear();
          audioLoadingPromises.current.clear();
      };
  }, []);

  const requestMicrophonePermission = async () => {
    setPermissionState('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); // Release mic immediately
      setPermissionState('granted');
    } catch (err) {
      console.error('Microphone permission denied.', err);
      setPermissionState('denied');
    }
  };

  // Helper to decode base64
  const base64ToArrayBuffer = (base64: string) => {
      const binaryString = window.atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
  };

  const stopAudio = () => {
      if (audioSourceRef.current) {
          try {
              audioSourceRef.current.stop();
          } catch (e) {
              // ignore
          }
          audioSourceRef.current = null;
      }
      setIsPlayingAudio(false);
      setActiveAudioId(null);
  };

  const loadAudio = async (text: string): Promise<AudioBuffer> => {
    // Check cache first
    if (audioCache.current.has(text)) {
        return audioCache.current.get(text)!;
    }
    
    // Check if already loading
    if (audioLoadingPromises.current.has(text)) {
        return audioLoadingPromises.current.get(text)!;
    }

    const loadPromise = async () => {
        if (!process.env.API_KEY) throw new Error("API Key missing");
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: { parts: [{ text }] },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' }, // Realistic female voice
                    },
                },
            },
        });

        const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!audioData) throw new Error("No audio generated");

        // Ensure AudioContext exists
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const ctx = audioContextRef.current;

        const buffer = base64ToArrayBuffer(audioData);
        
        // Manual PCM Decoding for Gemini 2.5 Flash TTS (16-bit, 24kHz, Mono)
        const length = Math.floor(buffer.byteLength / 2);
        const pcmData = new Int16Array(buffer, 0, length);
        
        // Create AudioBuffer with specific sample rate (24000Hz)
        const audioBuffer = ctx.createBuffer(1, pcmData.length, 24000);
        const channelData = audioBuffer.getChannelData(0);

        // Convert Int16 to Float32 [-1.0, 1.0]
        for (let i = 0; i < pcmData.length; i++) {
            channelData[i] = pcmData[i] / 32768.0;
        }
        return audioBuffer;
    };

    const promise = loadPromise();
    audioLoadingPromises.current.set(text, promise);
    
    try {
        const buffer = await promise;
        audioCache.current.set(text, buffer);
        return buffer;
    } catch (e) {
        audioLoadingPromises.current.delete(text);
        throw e;
    }
  };

  const playGeminiTTS = async (text: string, id: string = 'main') => {
    if (!text) return;

    // If clicking the same button that is currently playing, toggle off
    if (isPlayingAudio && activeAudioId === id) {
        stopAudio();
        return;
    }
    
    // Stop any currently playing audio
    stopAudio();

    setIsLoadingAudio(true);
    setActiveAudioId(id);

    try {
        const audioBuffer = await loadAudio(text);

        // Init AudioContext if needed (should be created in loadAudio but ensure here)
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }

        const ctx = audioContextRef.current;
        if (ctx.state === 'suspended') {
            await ctx.resume();
        }

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.onended = () => {
            setIsPlayingAudio(false);
            setActiveAudioId(null);
            audioSourceRef.current = null;
        };
        
        source.start(0);
        audioSourceRef.current = source;
        setIsPlayingAudio(true);

    } catch (err) {
        console.error("TTS Error:", err);
        setError("Failed to play audio. Please try again.");
        setIsPlayingAudio(false);
        setActiveAudioId(null);
    } finally {
        setIsLoadingAudio(false);
    }
  };

  const startNewTest = async () => {
    setTestState('loading');
    setError(null);
    setQuizQuestions(null);
    setReadingPassage(null);
    setListeningData(null);
    setWritingTestData(null);
    setSpeakingData(null);
    
    stopAudio();

    // Clear audio cache when starting a new test
    audioCache.current.clear();
    audioLoadingPromises.current.clear();

    // Reset writing state
    setUserWriting("");
    setWritingFeedback(null);
    setIsAnalyzing(false);

    // Reset speaking state
    setSpokenText("");
    setPronunciationScore(null);
    setIsRecording(false);
    if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
    }
    
    setCurrentQuestionIndex(0);
    setScore({ correct: 0, total: 0 });
    setUserAnswers({});
    
    try {
      if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set. Please configure it.");
      }
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      let prompt: string;
      let responseSchema: any;

      if (isWritingTest) {
        prompt = `Generate a B1 level English writing test. Provide a scenario or prompt for the user to respond to in about 100 words (e.g., writing an email, a note, or a short story). Also provide a list of 3-4 key points or instructions the user must include in their response. Finally, provide a model answer that fulfills the prompt and includes all key points.`;
        responseSchema = {
          type: Type.OBJECT,
          properties: {
            prompt: { type: Type.STRING, description: "The scenario/prompt for the user's writing task." },
            key_points: { 
                type: Type.ARRAY,
                minItems: 3,
                maxItems: 4,
                items: { type: Type.STRING },
                description: "A list of 3-4 key points the user must include in their response."
            },
            model_answer: { type: Type.STRING, description: "A model answer of around 100 words." }
          },
          required: ["prompt", "key_points", "model_answer"],
        };
      } else if (isReadingTest) {
        prompt = `Generate a B1 level English reading comprehension test inspired by https://test-english.com/reading/b1/. Provide one single, cohesive passage of about 250-350 words on a general topic (e.g., travel, jobs, culture). Then, create an array of at least 6 multiple-choice questions based on that single passage. For each question, provide four possible options and the correct answer.`;
        responseSchema = {
          type: Type.OBJECT,
          properties: {
            passage: { type: Type.STRING, description: "A single, cohesive reading passage of 250-350 words." },
            questions: {
              type: Type.ARRAY,
              minItems: 6,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING, description: "A multiple-choice question based on the passage." },
                  options: { 
                    type: Type.ARRAY, 
                    items: { type: Type.STRING },
                    description: "An array of 4 possible answers."
                  },
                  correctAnswer: { type: Type.STRING, description: "The correct option from the 'options' array." }
                },
                required: ["question", "options", "correctAnswer"],
              }
            }
          },
          required: ["passage", "questions"],
        };
      } else if (isListeningTest) {
        prompt = `Generate a B2 level English listening test similar to those found on test-english.com. 
        1. Create a transcript of a conversation or short talk (approx 200-250 words) on a general topic (e.g., travel, work, education, daily life). 
        2. Create 6 multiple-choice questions based on this transcript that test understanding of details and main ideas.
        3. For each question, provide 4 options and the correct answer.`;
        
        responseSchema = {
            type: Type.OBJECT,
            properties: {
                transcript: { type: Type.STRING, description: "The transcript of the audio track." },
                questions: {
                    type: Type.ARRAY,
                    minItems: 6,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            question: { type: Type.STRING },
                            options: { type: Type.ARRAY, items: { type: Type.STRING } },
                            correctAnswer: { type: Type.STRING }
                        },
                        required: ["question", "options", "correctAnswer"]
                    }
                }
            },
            required: ["transcript", "questions"]
        };
      } else if (isSpeakingTest) {
         prompt = `Generate a short, engaging story or passage (approx. 80-100 words) suitable for B1 level English pronunciation practice. The story should be interesting to read aloud.`;
         responseSchema = {
             type: Type.OBJECT,
             properties: {
                 story: { type: Type.STRING, description: "The short story text." }
             },
             required: ["story"]
         };
      } else {
        // Fallback for others
        prompt = `Create a quiz with at least 6 simple and short test questions for the learning skill of "${skill.title}". Each question should test a user's understanding or application of this skill. The skill is about: "${skill.description}". For each item, provide the question and a brief answer.`;
        responseSchema = {
          type: Type.ARRAY,
          minItems: 6,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING, description: "The test question." },
              answer: { type: Type.STRING, description: "The answer to the question." },
            },
            required: ["question", "answer"],
          }
        };
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema
        }
      });
      
      const jsonText = response.text.trim();
      const parsedData = JSON.parse(jsonText);

      if (isWritingTest) {
        setWritingTestData(parsedData);
      } else if (isReadingTest) {
        setReadingPassage(parsedData.passage);
        setQuizQuestions(parsedData.questions);
      } else if (isListeningTest) {
        setListeningData(parsedData);
        setQuizQuestions(parsedData.questions);
        loadAudio(parsedData.transcript).catch(e => console.error("Audio prefetch failed:", e));
      } else if (isSpeakingTest) {
        setSpeakingData(parsedData);
      } else {
        setQuizQuestions(parsedData);
      }
      
      setTestState('in-progress');

    } catch (e) {
      console.error(e);
      setError('Failed to generate a test. The model might be busy. Please try again in a moment.');
      setTestState('idle');
    }
  };

  const handleAnalyzeWriting = async () => {
    if (!writingTestData || !userWriting.trim()) return;
    
    setIsAnalyzing(true);
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `You are an expert English teacher using LanguageTool standards. 
        Task: Grade the student's writing based on the prompt and key points.
        
        Prompt: "${writingTestData.prompt}"
        Required Key Points: ${writingTestData.key_points.join(", ")}
        Student Answer: "${userWriting}"
        
        Provide a strict grading analysis. Return a JSON object with:
        1. score: A number from 0 to 100.
        2. grammar_corrections: A concise paragraph detailing specific grammar, spelling, and punctuation errors found and how to fix them.
        3. content_feedback: Feedback on whether they addressed the prompt and key points.`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        score: { type: Type.NUMBER, description: "Score from 0 to 100" },
                        grammar_corrections: { type: Type.STRING, description: "Details of grammar errors and fixes" },
                        content_feedback: { type: Type.STRING, description: "Feedback on content and key points" }
                    },
                    required: ["score", "grammar_corrections", "content_feedback"]
                }
            }
        });

        const result = JSON.parse(response.text.trim()) as WritingFeedback;
        setWritingFeedback(result);
        
        // Auto-grade: Pass if score >= 60
        setScore({ correct: result.score >= 60 ? 1 : 0, total: 1 });
        setQuestionAnswered(true); // Mark as done so they can finish

    } catch (e) {
        console.error(e);
        setError("Failed to analyze writing. Please try submitting again.");
    } finally {
        setIsAnalyzing(false);
    }
  };
  
  const handleNextQuestion = () => {
    // Reset question-specific state first
    setShowAnswer(false);
    setQuestionAnswered(false);
    setSelectedOption(null);
    
    // Only stop audio if NOT listening test, or if listening test is finishing
    if (!isListeningTest) {
      stopAudio();
    }

    if (isWritingTest || isSpeakingTest) {
        setTestState('completed');
        return;
    }

    if (quizQuestions && currentQuestionIndex < quizQuestions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
    } else {
        stopAudio(); // Ensure audio stops when test completes
        setTestState('completed');
    }
  };

  const handleSelfGrade = (isCorrect: boolean) => {
    if (questionAnswered) return;
    setScore(prev => ({ 
      correct: prev.correct + (isCorrect ? 1 : 0), 
      total: prev.total + 1 
    }));
    setQuestionAnswered(true);
  };
  
  const handleOptionSelect = (option: string) => {
    if (!currentQuestion) return;
    if (selectedOption) return; // Prevent changing answer

    setSelectedOption(option);
    setUserAnswers(prev => ({...prev, [currentQuestionIndex]: option}));

    // Determine correctness
    let isCorrect = false;
    if (isReadingTest || isListeningTest) {
         isCorrect = option === (currentQuestion as ReadingQuestion).correctAnswer;
    } else {
        isCorrect = option === (currentQuestion as ReadingQuestion).correctAnswer;
    }

    if (isListeningTest || isReadingTest) {
        if (isCorrect) {
            setScore(prev => ({ correct: prev.correct + 1, total: prev.total + 1 }));
        } else {
            setScore(prev => ({ ...prev, total: prev.total + 1 }));
        }
        // Auto-advance
        setTimeout(() => {
            handleNextQuestion();
        }, 1000);

    } else {
        if (isCorrect) {
            setScore(prev => ({ correct: prev.correct + 1, total: prev.total + 1 }));
            setTimeout(() => {
                handleNextQuestion();
            }, 1000);
        } else {
            setScore(prev => ({ ...prev, total: prev.total + 1 }));
        }
    }
  };

  const resetTest = () => {
    stopAudio();
    if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
    }
    
    // Clear audio cache
    audioCache.current.clear();
    audioLoadingPromises.current.clear();

    setTestState('idle');
    setQuizQuestions(null);
    setReadingPassage(null);
    setListeningData(null);
    setWritingTestData(null);
    setSpeakingData(null);
    setUserWriting("");
    setWritingFeedback(null);
    setIsAnalyzing(false);
    setSpokenText("");
    setPronunciationScore(null);
    setIsRecording(false);
    setCurrentQuestionIndex(0);
    setScore({ correct: 0, total: 0 });
    setUserAnswers({});
  };

  // Speaking Functionality
  const toggleRecording = () => {
    if (isRecording) {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        setIsRecording(false);
    } else {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Speech Recognition API is not supported in this browser. Please use Google Chrome.");
            return;
        }

        // Reset previous session
        setSpokenText("");
        setPronunciationScore(null);

        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event: any) => {
            let finalTranscript = '';
            for (let i = 0; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript + ' ';
                } else {
                    // We can also use interim for real-time feedback if needed
                    finalTranscript += event.results[i][0].transcript;
                }
            }
            // Simple accumulation approach for this demo
             const allText = Array.from(event.results)
                .map((r: any) => r[0].transcript)
                .join(' ');
            setSpokenText(allText);
        };

        recognition.onerror = (event: any) => {
            console.error("Speech recognition error", event.error);
            setIsRecording(false);
        };
        
        recognition.onend = () => {
             setIsRecording(false);
             calculateSpeakingScore();
        };

        try {
            recognition.start();
            recognitionRef.current = recognition;
            setIsRecording(true);
        } catch(e) {
            console.error(e);
        }
    }
  };

  const calculateSpeakingScore = () => {
      // This runs usually when recording stops or updates
      if (!speakingData) return;
      
      const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s]|_/g, "").replace(/\s+/g, " ").trim();
      const targetWords = normalize(speakingData.story).split(" ");
      const spokenWords = normalize(spokenText || "").split(" ");
      
      if (spokenWords.length === 0 || (spokenWords.length === 1 && spokenWords[0] === "")) {
          setPronunciationScore(0);
          return;
      }

      // Robust Matching Logic (Greedy with fuzzy lookahead)
      let matches = 0;
      let spokenIdx = 0;
      const SEARCH_WINDOW = 6; // Look ahead 6 words to handle skipped words/stuttering
      
      for (const targetWord of targetWords) {
          let foundMatch = false;

          // Search in a window of the spoken text
          // This handles cases where the user might skip a word or say extra filler words
          for (let i = spokenIdx; i < Math.min(spokenIdx + SEARCH_WINDOW, spokenWords.length); i++) {
              const spokenWord = spokenWords[i];
              
              // 1. Exact Match
              if (spokenWord === targetWord) {
                  matches++;
                  spokenIdx = i + 1; // Advance pointer past this match
                  foundMatch = true;
                  break; 
              }
              
              // 2. Fuzzy Match (using Levenshtein distance)
              // Allow small typos (e.g., 'color' vs 'colour', or speech-to-text inaccuracies)
              // Threshold: 1 edit for short words, 2 for longer words
              const allowedEdits = targetWord.length > 5 ? 2 : 1;
              const dist = getLevenshteinDistance(targetWord, spokenWord);
              
              if (dist <= allowedEdits) {
                   matches++;
                   spokenIdx = i + 1;
                   foundMatch = true;
                   break;
              }
          }
      }

      const calculatedScore = Math.round((matches / targetWords.length) * 100);
      setPronunciationScore(Math.min(100, calculatedScore));
      
      // Update global score for test completion
      setScore({correct: calculatedScore >= 70 ? 1 : 0, total: 1});
  };

  // Helper to determine word highlighting color based on spoken text
  // Reuses a similar fuzzy logic to calculateSpeakingScore for visual consistency
  const getWordHighlightClass = (word: string, index: number, allTargetWords: string[]) => {
       if (!spokenText) return "text-slate-300";
       
       const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s]|_/g, "");
       const targetWord = normalize(word);
       const spokenWords = spokenText.toLowerCase().replace(/[^\w\s]|_/g, " ").trim().split(/\s+/);
       
       // Note: This checks strictly if the word exists "roughly in order" relative to previous words
       // to allow highlighting. It's a simplified check for render performance.
       // A more accurate way would be to run the full alignment algorithm again, but that's expensive in a map loop.
       
       // Simplified fuzzy check for UI:
       const SEARCH_WINDOW = 50; // Larger window for UI to be generous with finding the word
       // We scan the whole spoken array (simplified) or a large chunk to see if this word appears
       // This is a "lenient" highlight - if you said it, we highlight it green, even if out of perfect order
       
       const exists = spokenWords.some(sw => {
           if (sw === targetWord) return true;
           const allowedEdits = targetWord.length > 5 ? 2 : 1;
           return getLevenshteinDistance(targetWord, sw) <= allowedEdits;
       });

       return exists ? "text-green-400 font-medium" : "text-slate-500 transition-colors duration-500";
  }


  const getOptionClass = (option: string, forReview: boolean = false, questionIndex?: number) => {
    // If rendering for Review (End of test)
    if (forReview && quizQuestions && questionIndex !== undefined) {
        const question = quizQuestions[questionIndex] as ReadingQuestion;
        if (!question) return "bg-slate-800/50 opacity-50";

        const userAnswer = userAnswers[questionIndex];
        const isCorrectAnswer = option === question.correctAnswer;
        const isUserSelected = option === userAnswer;

        if (isCorrectAnswer) return "bg-green-500/30 border-green-400";
        if (isUserSelected && !isCorrectAnswer) return "bg-red-500/30 border-red-400";
        return "bg-slate-800/50 opacity-50";
    }

    if (!selectedOption) {
        return "bg-slate-700/50 hover:bg-cyan-500/20";
    }
    const isSelected = option === selectedOption;

    if (isListeningTest || isReadingTest) {
        if (isSelected) return "bg-cyan-500/50 border-cyan-400 text-white";
        return "bg-slate-700/50 opacity-50";
    }

    if (!currentQuestion) return "bg-slate-700/50 opacity-50";
    const isCorrect = option === (currentQuestion as ReadingQuestion).correctAnswer;
    if (isCorrect) return "bg-green-500/30 border-green-400";
    if (isSelected && !isCorrect) return "bg-red-500/30 border-red-400";
    return "bg-slate-700/50 cursor-not-allowed opacity-60";
  };

  const isCurrentQuestionAnswered = () => {
    if (isReadingTest || isListeningTest) return !!selectedOption;
    if (isWritingTest) return !!writingFeedback;
    if (isSpeakingTest) return pronunciationScore !== null;
    return questionAnswered;
  };
  

  const renderPermissionFlow = () => {
    switch(permissionState) {
        case 'denied':
            return (
                <div className="text-center flex flex-col items-center justify-center h-full">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-red-400 mb-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-5h2v2h-2v-2zm0-8h2v6h-2V7z"></path>
                    </svg>
                    <h3 className="text-xl font-semibold text-white mb-2">Microphone Access Denied</h3>
                    <p className="text-slate-400">
                        This test requires microphone access. Please enable it in your browser settings and refresh the page to continue.
                    </p>
                </div>
            )
        case 'requesting':
            return (
                <div className="text-center flex flex-col items-center justify-center h-full">
                    <p className="text-slate-400">Waiting for microphone permission...</p>
                    <p className="text-sm text-slate-500 mt-2">Please check your browser's permission prompt.</p>
                </div>
            )
        case 'prompt':
        default:
            return (
                <div className="text-center flex flex-col items-center justify-center h-full">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-cyan-400 mb-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7z"></path>
                    </svg>
                    <h3 className="text-xl font-semibold text-white mb-2">Microphone Access Required</h3>
                    <p className="text-slate-400 mb-6">
                        The {skill.title} test requires your microphone to proceed.
                    </p>
                    <button
                        onClick={requestMicrophonePermission}
                        className="rounded-full bg-gradient-to-r from-purple-600 to-cyan-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-purple-500 hover:to-cyan-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 transition-all"
                    >
                        Enable Microphone
                    </button>
                </div>
            );
    }
  }

  const renderContent = () => {
    if (testState === 'loading') {
      return (
        <div className="text-center flex flex-col items-center justify-center h-full">
          <svg className="animate-spin h-8 w-8 text-cyan-400 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-slate-400">Generating your test...</p>
        </div>
      );
    }

    if (testState === 'idle' || error) {
      if (needsMicrophone && permissionState !== 'granted') {
        return renderPermissionFlow();
      }
      return (
        <div className="text-center flex flex-col items-center justify-center h-full">
            {error && <p className="text-red-400 mb-4">{error}</p>}
            <p className="text-slate-500 mb-6">Ready to test your {skill.title} skills?</p>
            <button
                onClick={startNewTest}
                className="rounded-full bg-gradient-to-r from-purple-600 to-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:from-purple-500 hover:to-cyan-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 transition-all hover:-translate-y-0.5"
            >
                Start Test
            </button>
        </div>
      );
    }
    
    if (testState === 'completed') {
        return (
            <div className="text-center animate-fade-in flex flex-col items-center h-full overflow-y-auto custom-scrollbar">
                <div className="mb-8 text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 text-green-400 mx-auto mb-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                    </svg>
                    <h2 className="text-2xl font-bold text-white mb-2">Test Complete!</h2>
                    <p className="text-lg text-slate-400 mb-4">You've completed the {skill.title} test.</p>
                    
                    <div>
                        <p className="text-base text-slate-400">Final Score</p>
                        <p className="text-5xl font-bold text-cyan-400 mt-1">{score.correct} / {score.total}</p>
                        <p className="text-xl font-semibold text-cyan-400 mt-1">
                            {score.total > 0 ? ((score.correct / score.total) * 100).toFixed(0) : 0}%
                        </p>
                    </div>
                </div>

                {(isReadingTest || isListeningTest) && quizQuestions && (
                    <div className="w-full text-left space-y-8 max-w-2xl mx-auto pb-8">
                         <h3 className="text-xl font-semibold text-white border-b border-slate-700 pb-2">Answer Review</h3>
                         {quizQuestions.map((q, idx) => {
                             if (!q) return null;
                             const question = q as ReadingQuestion;
                             return (
                                 <div key={idx} className="bg-slate-800/30 p-6 rounded-lg border border-slate-700">
                                     <p className="text-cyan-400 font-semibold mb-3">Question {idx + 1}</p>
                                     <p className="text-slate-200 text-lg mb-4">{question.question}</p>
                                     <div className="space-y-2">
                                         {question.options.map((opt, optIdx) => (
                                             <div 
                                                key={optIdx} 
                                                className={`p-3 rounded-md border ${getOptionClass(opt, true, idx)} flex justify-between items-center`}
                                             >
                                                 <span className="text-slate-300">{opt}</span>
                                                 {opt === question.correctAnswer && (
                                                     <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                                         <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                     </svg>
                                                 )}
                                                 {opt === userAnswers[idx] && opt !== question.correctAnswer && (
                                                     <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                                         <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                                     </svg>
                                                 )}
                                             </div>
                                         ))}
                                     </div>
                                 </div>
                             )
                         })}
                    </div>
                )}

                <button
                    onClick={startNewTest}
                    className="mt-6 rounded-full bg-gradient-to-r from-purple-600 to-cyan-600 px-8 py-3 text-sm font-semibold text-white shadow-lg hover:from-purple-500 hover:to-cyan-500 transition-all transform hover:-translate-y-0.5"
                >
                    Start New Test
                </button>
            </div>
        )
    }

    if (testState === 'in-progress') {
        const isLastQuestion = isWritingTest || isSpeakingTest || (quizQuestions && currentQuestionIndex === quizQuestions.length - 1);
        return (
            <div 
              className="flex flex-col h-full select-none"
              onCopy={(e) => e.preventDefault()}
              onCut={(e) => e.preventDefault()}
              onPaste={(e) => e.preventDefault()}
              onContextMenu={(e) => e.preventDefault()}
            >
                 <div className="text-center mb-6">
                    <p className="text-sm font-semibold text-cyan-400">
                      {isWritingTest ? 'Writing Task' : isSpeakingTest ? 'Speaking Practice' : `Question ${currentQuestionIndex + 1} of ${quizQuestions?.length}`}
                    </p>
                </div>
                <div className="flex-grow text-left space-y-6 w-full animate-fade-in">
                {isSpeakingTest && speakingData ? (
                   <div className="flex flex-col h-full">
                       <div className="bg-slate-900/50 rounded-lg p-6 mb-6 border border-slate-700 shadow-inner">
                           <h2 className="text-lg font-semibold text-cyan-400 mb-4 flex items-center gap-2">
                               <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                               Read the following story aloud:
                           </h2>
                           <p className="text-xl leading-loose tracking-wide font-serif">
                               {speakingData.story.split(" ").map((word, i, arr) => (
                                   <span key={i} className={`mr-2 inline-block ${getWordHighlightClass(word, i, arr)}`}>
                                       {word}
                                   </span>
                               ))}
                           </p>
                       </div>

                       <div className="flex flex-col items-center justify-center gap-6 mt-auto pb-4">
                           {/* Score Display */}
                            {pronunciationScore !== null && (
                                <div className="text-center animate-bounce-in">
                                    <p className="text-sm text-slate-400 uppercase tracking-widest">Fluency Score</p>
                                    <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 mt-2">
                                        {pronunciationScore}%
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1 font-medium">
                                        {pronunciationScore >= 90 ? "Excellent! Native-like flow." : 
                                         pronunciationScore >= 75 ? "Very good! Clear and understandable." :
                                         pronunciationScore >= 50 ? "Good effort. Keep practicing!" : "Try again. Focus on clarity."}
                                    </p>
                                </div>
                            )}
                            
                            {/* Controls */}
                           <div className="flex items-center gap-4">
                               <button
                                   onClick={toggleRecording}
                                   className={`relative rounded-full p-6 transition-all duration-300 ${
                                       isRecording 
                                       ? 'bg-red-500/20 text-red-500 ring-4 ring-red-500/30 scale-110' 
                                       : 'bg-slate-800 text-white hover:bg-slate-700 hover:scale-105'
                                   }`}
                               >
                                   {isRecording ? (
                                       <div className="flex flex-col items-center">
                                           <div className="w-8 h-8 rounded-sm bg-current animate-pulse" />
                                       </div>
                                   ) : (
                                       <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m12 7.5v-1.5a6 6 0 0 0-6-6v-1.5a6 6 0 0 0-6-6a6 6 0 0 0 6 6v1.5a6 6 0 0 0 6 6z" />
                                        </svg>
                                   )}
                               </button>
                               {isRecording && (
                                   <p className="text-red-400 font-semibold animate-pulse absolute -bottom-8">Recording...</p>
                               )}
                           </div>
                           
                           {spokenText && (
                               <div className="w-full mt-4 p-4 bg-black/20 rounded text-xs text-slate-500 font-mono h-24 overflow-y-auto border border-slate-800">
                                   <span className="opacity-50 select-none">Transcript: </span>
                                   {spokenText}
                               </div>
                           )}
                       </div>
                   </div>
                ) : isWritingTest && writingTestData ? (
                    <>
                      <div>
                          <h2 className="font-semibold text-cyan-400">Your Task:</h2>
                          <p className="mt-2 text-base text-slate-300 whitespace-pre-line">{writingTestData.prompt}</p>
                          <h3 className="font-semibold text-cyan-400 mt-4">Make sure to include these points:</h3>
                          <ul className="mt-2 text-base text-slate-300 list-disc list-inside space-y-1">
                              {writingTestData.key_points.map((point, i) => <li key={i}>{point}</li>)}
                          </ul>
                      </div>
                      <textarea
                          className="mt-4 w-full h-40 p-3 bg-slate-900 rounded-md border border-slate-700 text-slate-300 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition disabled:opacity-50 disabled:cursor-not-allowed select-text"
                          placeholder="Write your response here..."
                          value={userWriting}
                          onChange={(e) => setUserWriting(e.target.value)}
                          readOnly={!!writingFeedback || isAnalyzing}
                          onPaste={(e) => e.preventDefault()}
                          onCopy={(e) => e.preventDefault()}
                          onCut={(e) => e.preventDefault()}
                          onContextMenu={(e) => e.preventDefault()}
                          autoComplete="off"
                          spellCheck="false"
                      />
                      
                      {!writingFeedback ? (
                         <div className="flex justify-end">
                           <button 
                             onClick={handleAnalyzeWriting}
                             disabled={isAnalyzing || userWriting.length < 10}
                             className="rounded-full bg-gradient-to-r from-purple-600 to-cyan-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-purple-500 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                           >
                             {isAnalyzing ? (
                               <>
                                 <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                     <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                     <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                 </svg>
                                 Checking...
                               </>
                             ) : (
                               <>
                                 Submit & Check Grammar
                               </>
                             )}
                           </button>
                         </div>
                      ) : (
                         <div className="animate-fade-in space-y-6">
                            {/* Report Card */}
                            <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-6">
                                <div className="flex items-center justify-between border-b border-slate-700 pb-4 mb-4">
                                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-cyan-400">
                                            <path fillRule="evenodd" d="M9.315 7.584C12.195 3.883 16.695 1.5 21.75 1.5a.75.75 0 0 1 .75.75c0 5.056-2.383 9.555-6.084 12.436h.018l-.008.003c-.314.124-.7.153-1.024-.085L9.315 7.584ZM1.604 14.996c.124-.314.153-.7-.085-1.024L3.2 12.287c3.883 2.88 8.383 5.26 13.44 5.26a.75.75 0 0 1 .75.75c0 5.055-2.383 9.554-6.084 12.435l-.008.003c-.314.124-.7.153-1.024-.085l-8.67-8.654Zm15.12-3.333a.75.75 0 0 1 .786-.172l10.5 4.5a.75.75 0 0 1 0 1.383l-10.5 4.5a.75.75 0 0 1-1.024-1.024l4.5-10.5a.75.75 0 0 1 .172-.786l-4.434 4.1Zm-4.547 6.756a.75.75 0 0 1 1.06-1.06l8.06 8.059a.75.75 0 0 1-1.06 1.061l-8.06-8.06Z" clipRule="evenodd" />
                                        </svg>
                                        LanguageTool AI Report
                                    </h3>
                                    <div className={`px-3 py-1 rounded-full border ${writingFeedback.score >= 60 ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-red-500/20 border-red-500 text-red-400'}`}>
                                        Score: {writingFeedback.score}/100
                                    </div>
                                </div>
                                
                                <div className="grid gap-6">
                                    <div>
                                        <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-2">Grammar & Corrections</h4>
                                        <p className="text-slate-300 text-sm whitespace-pre-line bg-slate-800/50 p-3 rounded border border-slate-700/50">
                                            {writingFeedback.grammar_corrections}
                                        </p>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-2">Content Feedback</h4>
                                        <p className="text-slate-300 text-sm whitespace-pre-line bg-slate-800/50 p-3 rounded border border-slate-700/50">
                                            {writingFeedback.content_feedback}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 border-t border-slate-700 pt-6">
                                <h3 className="font-semibold text-cyan-400">Model Answer (For Comparison):</h3>
                                <p className="mt-2 text-base text-slate-300 whitespace-pre-line">{writingTestData.model_answer}</p>
                            </div>
                         </div>
                      )}
                    </>
                ) : (isReadingTest || isListeningTest) ? (
                    <>
                        {isReadingTest && readingPassage && (
                             <div className="max-h-60 overflow-y-auto pr-4 mb-6 border-b border-slate-700 pb-6 custom-scrollbar">
                                <h2 className="font-semibold text-cyan-400 mb-2">Reading Passage:</h2>
                                <p className="text-base text-slate-300 whitespace-pre-line leading-relaxed">{readingPassage}</p>
                            </div>
                        )}
                        {isListeningTest && listeningData && (
                             <div className="mb-8 border-b border-slate-700 pb-6 flex flex-col items-center justify-center bg-slate-800/30 rounded-lg p-6">
                                <div className="mb-4 flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center">
                                        {isPlayingAudio && activeAudioId === 'main' ? (
                                            <div className="flex gap-1 h-4 items-end">
                                                <div className="w-1 bg-cyan-400 animate-[bounce_1s_infinite]"></div>
                                                <div className="w-1 bg-cyan-400 animate-[bounce_1.2s_infinite]"></div>
                                                <div className="w-1 bg-cyan-400 animate-[bounce_0.8s_infinite]"></div>
                                            </div>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-slate-400">
                                                <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 2.485.86 4.879 2.312 6.824.323 1.197 1.436 2.06 2.59 2.06h2.04l4.5 4.5c.944.945 2.56.276 2.56-1.06V4.06ZM18.75 12a5.97 5.97 0 0 0-1.756-4.243 6.023 6.023 0 0 0-2.636-1.492 1.125 1.125 0 0 0-1.358 1.356c.12.53.522.937 1.007 1.085a3.752 3.752 0 0 1 0 6.588 1.125 1.125 0 0 0-1.007 1.086c.134.564.636.995 1.358 1.355a6.02 6.02 0 0 0 2.636-1.49 5.968 5.968 0 0 0 1.756-4.245Z" />
                                            </svg>
                                        )}
                                    </div>
                                    <div className="text-slate-300 font-medium">Audio Track 01</div>
                                </div>
                                <button 
                                    onClick={() => playGeminiTTS(listeningData.transcript, 'main')}
                                    disabled={isLoadingAudio && activeAudioId !== 'main'}
                                    className="flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-cyan-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:from-purple-500 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    {isLoadingAudio && activeAudioId === 'main' ? (
                                         <>
                                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Loading Audio...
                                         </>
                                    ) : isPlayingAudio && activeAudioId === 'main' ? (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                                <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 0 1 .75-.75H9a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H7.5a.75.75 0 0 1-.75-.75V5.25Zm7.5 0A.75.75 0 0 1 15 4.5h1.5a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H15a.75.75 0 0 1-.75-.75V5.25Z" clipRule="evenodd" />
                                            </svg>
                                            Stop Audio
                                        </>
                                    ) : (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                                <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
                                            </svg>
                                            Play Audio
                                        </>
                                    )}
                                </button>
                                <p className="text-xs text-slate-500 mt-2">Listen to the conversation and answer the questions.</p>
                            </div>
                        )}
                        {currentQuestion && (
                            <>
                                <div>
                                    <h2 className="font-semibold text-cyan-400">Question:</h2>
                                    <p className="mt-2 text-lg text-slate-300">{(currentQuestion as ReadingQuestion).question}</p>
                                </div>
                                <div className="space-y-3">
                                    {(currentQuestion as ReadingQuestion).options.map((option, index) => (
                                        <button
                                            key={index}
                                            onClick={() => handleOptionSelect(option)}
                                            disabled={!!selectedOption}
                                            className={`w-full text-left p-3 rounded-md border border-transparent transition-all duration-300 ${getOptionClass(option)}`}
                                        >
                                            {option}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </>
                ) : currentQuestion ? (
                    <>
                    <div>
                        <h2 className="font-semibold text-cyan-400">Question:</h2>
                        <p className="mt-2 text-lg text-slate-300">{(currentQuestion as StandardQuiz).question}</p>
                    </div>

                    <div>
                        {!showAnswer ? (
                            <button onClick={() => setShowAnswer(true)} className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors">
                                Show Answer
                            </button>
                        ) : (
                            <div className="animate-fade-in">
                                <h2 className="font-semibold text-cyan-400">Answer:</h2>
                                <p className="mt-2 text-lg text-slate-300">{(currentQuestion as StandardQuiz).answer}</p>
                                {!questionAnswered && (
                                <div className="mt-6 flex justify-start gap-4">
                                    <button onClick={() => handleSelfGrade(true)} className="rounded-md bg-green-500/20 px-3 py-1.5 text-sm font-semibold text-green-400 hover:bg-green-500/30 transition-colors">I got it right!</button>
                                    <button onClick={() => handleSelfGrade(false)} className="rounded-md bg-red-500/20 px-3 py-1.5 text-sm font-semibold text-red-400 hover:bg-red-500/30 transition-colors">I got it wrong</button>
                                </div>
                                )}
                            </div>
                        )}
                    </div>
                    </>
                ) : null}
                </div>
                 {isCurrentQuestionAnswered() && (
                    <div className="mt-auto pt-6 text-center">
                        <button
                            onClick={handleNextQuestion}
                            className="rounded-full bg-gradient-to-r from-purple-600 to-cyan-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-purple-500 hover:to-cyan-500 transition-all hover:-translate-y-0.5"
                        >
                            {isLastQuestion ? 'Finish Test' : 'Next'}
                        </button>
                    </div>
                 )}
            </div>
        )
    }
  }


  return (
    <div className="relative isolate px-6 pt-14 lg:px-8 animate-fade-in">
       <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(30, 41, 59, 0.5);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(34, 211, 238, 0.3);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(34, 211, 238, 0.5);
        }
      `}</style>
      
      <div className="absolute top-14 right-6 lg:right-8 bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-sm shadow-lg w-64 backdrop-blur-md z-10">
        <h3 className="font-bold text-white mb-2 text-center">Dashboard</h3>
        <div className="grid grid-cols-2 gap-4">
            <div className="text-center bg-slate-900/50 p-2 rounded-md">
                <p className="text-xs text-slate-400">Raw Score</p>
                <p className="text-2xl font-semibold text-cyan-400">
                    {(isListeningTest || isReadingTest) && testState !== 'completed' ? '?' : `${score.correct}/${score.total}`}
                </p>
            </div>
            <div className="text-center bg-slate-900/50 p-2 rounded-md">
                <p className="text-xs text-slate-400">Percentage</p>
                <p className="text-2xl font-semibold text-cyan-400">
                    {(isListeningTest || isReadingTest) && testState !== 'completed' ? '?' : (score.total > 0 ? ((score.correct / score.total) * 100).toFixed(0) : 0) + '%'}
                </p>
            </div>
        </div>
        {(testState === 'in-progress' || testState === 'completed') && (
            <button onClick={resetTest} className="mt-4 w-full text-xs text-slate-500 hover:text-cyan-400 transition-colors">
              Reset Test
            </button>
        )}
      </div>

      <div className="mx-auto max-w-3xl py-12 sm:py-24 lg:py-32">
        <div className="text-left">
          <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-cyan-400 transition-colors mb-8 font-semibold">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            Back to Skills
          </button>

          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 flex items-center justify-center h-16 w-16 rounded-lg bg-slate-800 border border-slate-700 text-cyan-400">
                {React.cloneElement(skill.icon, { className: 'w-9 h-9' })}
            </div>
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{skill.title} Test</h1>
                <p className="mt-1 text-lg leading-8 text-slate-400">Test your knowledge for this skill.</p>
            </div>
          </div>
          
          <div className="mt-10 p-8 rounded-lg bg-slate-800/50 border border-slate-700 min-h-[30rem] flex flex-col shadow-lg shadow-purple-900/10">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkillTest;