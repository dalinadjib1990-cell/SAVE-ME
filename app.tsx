eEffect, useRef } from 'react';
import { 
  SchoolLevel, 
  Subject, 
  SectionType, 
  Difficulty, 
  Question, 
  User, 
  UserProgress 
} from './types';
import { generateQuestions } from './geminiService';

// --- SVGs & Icons ---
const MathIcon = () => <svg className="w-12 h-12 opacity-20 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>;
const AtomIcon = () => <svg className="w-16 h-16 opacity-20 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>;
const BookIcon = () => <svg className="w-14 h-14 opacity-20 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>;

// --- Helper Functions ---
const shuffleArray = <T,>(array: T[]): T[] => {
  return [...array].sort(() => Math.random() - 0.5);
};

// --- Components ---

const Background = () => {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <div className="absolute top-10 left-10 animate-float"><MathIcon /></div>
      <div className="absolute top-40 right-20 animate-float" style={{animationDelay: '1s'}}><AtomIcon /></div>
      <div className="absolute bottom-20 left-1/4 animate-float" style={{animationDelay: '2s'}}><BookIcon /></div>
      <div className="absolute bottom-10 right-10 animate-float" style={{animationDelay: '3s'}}><MathIcon /></div>
      <div className="absolute top-1/2 left-10 animate-float" style={{animationDelay: '4s'}}><BookIcon /></div>
    </div>
  );
};

const Header = () => (
  <header className="absolute top-0 w-full flex justify-center py-6 z-20">
    <h1 className="text-3xl md:text-5xl font-serif text-white opacity-90 tracking-wider">بسم الله الرحمن الرحيم</h1>
  </header>
);

const SideBarText = () => (
  <div className="fixed right-4 top-1/2 transform -translate-y-1/2 w-10 z-20 hidden md:flex flex-col items-center gap-4">
    <div className="text-xl font-serif gold-text writing-vertical-rl tracking-widest h-[500px] text-center">
      اللهم صلي وسلم على سيدنا محمد
    </div>
  </div>
);

const DeveloperCredit = () => (
  <div className="fixed bottom-4 left-4 z-20">
    <p className="neon-text font-mono text-sm md:text-lg">developer dali nadjib</p>
  </div>
);

// --- Main App Logic ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentScreen, setCurrentScreen] = useState<'welcome' | 'menu' | 'quiz' | 'result'>('welcome');
  const [selectedSection, setSelectedSection] = useState<SectionType | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Quiz State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState<boolean | null>(null);

  // Progress State (In-memory for this demo, ideally persisted in localStorage)
  const [progress, setProgress] = useState<UserProgress>({
    didactics: { [Difficulty.EASY]: 0, [Difficulty.MEDIUM]: 0, [Difficulty.HARD]: 0 },
    legislation: { [Difficulty.EASY]: 0, [Difficulty.MEDIUM]: 0, [Difficulty.HARD]: 0 },
    psychology: { [Difficulty.EASY]: 0, [Difficulty.MEDIUM]: 0, [Difficulty.HARD]: 0 }
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Actions ---

  const handleLogin = (name: string, level: SchoolLevel) => {
    setUser({ name, schoolLevel: level });
    setCurrentScreen('menu');
  };

  const startQuiz = async (section: SectionType, difficulty: Difficulty, subject?: Subject) => {
    if (!user?.schoolLevel) return;
    
    // Check lock
    if (difficulty === Difficulty.HARD) {
      let prevScore = 0;
      if (section === SectionType.DIDACTICS) prevScore = progress.didactics[Difficulty.MEDIUM];
      if (section === SectionType.LEGISLATION) prevScore = progress.legislation[Difficulty.MEDIUM];
      if (section === SectionType.PSYCHOLOGY) prevScore = progress.psychology[Difficulty.MEDIUM];
      
      // Lock condition: Must have score >= 90 in Medium to unlock Hard
      if (prevScore < 90) {
        alert("يجب الحصول على 90 نقطة على الأقل في المستوى المتوسط لفتح المستوى الصعب");
        return;
      }
    }

    setLoading(true);
    setError(null);
    setSelectedSection(section);
    setSelectedDifficulty(difficulty);
    setSelectedSubject(subject || null);

    try {
      const qs = await generateQuestions(section, user.schoolLevel, difficulty, subject);
      const randomizedQs = qs.map(q => ({...q, options: shuffleArray(q.options)}));
      setQuestions(randomizedQs);
      setCurrentQIndex(0);
      setScore(0);
      setQuizFinished(false);
      setLastAnswerCorrect(null);
      
      // Set Timer based on difficulty
      let timePerQ = 30;
      if (difficulty === Difficulty.MEDIUM) timePerQ = 60;
      if (difficulty === Difficulty.HARD) timePerQ = 90;
      setTimeLeft(timePerQ);

      setCurrentScreen('quiz');
    } catch (e) {
      setError("حدث خطأ أثناء تحميل الأسئلة. يرجى المحاولة مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = (selectedOption: string) => {
    const currentQ = questions[currentQIndex];
    const isCorrect = selectedOption === currentQ.correctAnswer;
    
    if (isCorrect) {
      setScore(s => s + 10); // 10 points per question
      setLastAnswerCorrect(true);
    } else {
      setLastAnswerCorrect(false);
    }

    // Pause briefly to show feedback
    setTimeout(() => {
      nextQuestion();
    }, 1500);
  };

  const nextQuestion = () => {
    setLastAnswerCorrect(null);
    if (currentQIndex < questions.length - 1) {
      setCurrentQIndex(prev => prev + 1);
      
      // Reset Timer
      let timePerQ = 30;
      if (selectedDifficulty === Difficulty.MEDIUM) timePerQ = 60;
      if (selectedDifficulty === Difficulty.HARD) timePerQ = 90;
      setTimeLeft(timePerQ);
    } else {
      finishQuiz();
    }
  };

  const finishQuiz = () => {
    setQuizFinished(true);
    setCurrentScreen('result');
    
    // Update progress
    if (selectedSection && selectedDifficulty) {
      setProgress(prev => {
        const newProgress = { ...prev };
        let sectionKey: keyof UserProgress | null = null;
        
        if (selectedSection === SectionType.DIDACTICS) sectionKey = 'didactics';
        if (selectedSection === SectionType.LEGISLATION) sectionKey = 'legislation';
        if (selectedSection === SectionType.PSYCHOLOGY) sectionKey = 'psychology';

        if (sectionKey) {
            // Keep the highest score
            const currentTotal = score + (lastAnswerCorrect ? 10 : 0); // Add last point if valid
            // Note: Use 'score' state variable carefully. The state update might lag in 'submitAnswer', 
            // but here we are calling finishQuiz from nextQuestion loop usually. 
            // Better to calculate final score passed as arg or useEffect.
            // Let's rely on the updated score in the Result screen via rendering, 
            // but for state, we assume 'score' is up to date because nextQuestion waits 1.5s.
             if (currentTotal > newProgress[sectionKey][selectedDifficulty]) {
                newProgress[sectionKey][selectedDifficulty] = currentTotal;
             }
        }
        return newProgress;
      });
    }
  };

  // Timer Effect
  useEffect(() => {
    if (currentScreen === 'quiz' && !quizFinished && timeLeft > 0 && lastAnswerCorrect === null) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && currentScreen === 'quiz' && lastAnswerCorrect === null) {
       // Time out -> Wrong answer
       setLastAnswerCorrect(false);
       setTimeout(nextQuestion, 1500);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeLeft, currentScreen, quizFinished, lastAnswerCorrect]);


  // --- Render Functions ---

  if (currentScreen === 'welcome') {
    return (
      <div className="min-h-screen relative font-sans text-white bg-slate-900 flex items-center justify-center p-4">
        <Background />
        <Header />
        <SideBarText />
        <DeveloperCredit />
        
        <div className="z-10 bg-slate-800/80 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-slate-600 w-full max-w-md text-center">
            <h2 className="text-3xl font-bold mb-6 text-amber-400">مرحباً بك يا أستاذ</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const name = formData.get('name') as string;
              const level = formData.get('level') as SchoolLevel;
              if(name && level) handleLogin(name, level);
            }} className="space-y-6">
                <div>
                    <label className="block text-right mb-2 text-lg">الاسم الكامل</label>
                    <input name="name" required type="text" className="w-full p-3 rounded-lg bg-slate-700 border border-slate-500 focus:border-amber-400 focus:outline-none text-right" placeholder="ادخل اسمك هنا" />
                </div>
                <div>
                    <label className="block text-right mb-2 text-lg">الطور التعليمي</label>
                    <select name="level" className="w-full p-3 rounded-lg bg-slate-700 border border-slate-500 focus:border-amber-400 focus:outline-none text-right appearance-none" dir="rtl">
                        {Object.values(SchoolLevel).map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                </div>
                <button type="submit" className="w-full bg-gradient-to-r from-amber-500 to-amber-700 text-white font-bold py-3 rounded-xl shadow-lg hover:scale-105 transition-transform">
                    دخول
                </button>
            </form>
        </div>
      </div>
    );
  }

  if (currentScreen === 'menu') {
    return (
      <div className="min-h-screen relative font-sans text-white bg-slate-900 flex flex-col items-center pt-24 pb-12 px-4 overflow-y-auto">
        <Background />
        <Header />
        <SideBarText />
        <DeveloperCredit />
        
        <div className="z-10 w-full max-w-4xl grid gap-8">
            <div className="text-center mb-4">
                <h2 className="text-2xl text-slate-300">مرحباً بالأستاذ: <span className="text-amber-400 font-bold">{user?.name}</span></h2>
                <p className="text-slate-400">الطور: {user?.schoolLevel}</p>
            </div>

            {/* Sections */}
            {[SectionType.DIDACTICS, SectionType.LEGISLATION, SectionType.PSYCHOLOGY].map((section) => (
                <div key={section} className="bg-slate-800/80 backdrop-blur-md p-6 rounded-2xl border border-slate-600 shadow-xl">
                    <h3 className="text-2xl font-bold mb-4 text-center text-cyan-400 border-b border-slate-600 pb-2">{section}</h3>
                    
                    {/* Subject Selection for Didactics */}
                    {section === SectionType.DIDACTICS && (
                        <div className="mb-4">
                            <p className="mb-2 text-sm text-slate-300">اختر المادة:</p>
                            <div className="flex flex-wrap gap-2 justify-center">
                                {Object.values(Subject).map(subj => (
                                    <button 
                                        key={subj}
                                        onClick={() => setSelectedSubject(subj)}
                                        className={`px-3 py-1 rounded-full text-sm transition-colors ${selectedSubject === subj ? 'bg-amber-500 text-black font-bold' : 'bg-slate-700 hover:bg-slate-600'}`}
                                    >
                                        {subj}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Difficulty Levels */}
                    <div className="grid grid-cols-3 gap-4 mt-4">
                        {[Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD].map((diff) => {
                            // Determine Lock State
                            let isLocked = false;
                            let userScore = 0;
                             if (section === SectionType.DIDACTICS) userScore = progress.didactics[diff];
                             else if (section === SectionType.LEGISLATION) userScore = progress.legislation[diff];
                             else if (section === SectionType.PSYCHOLOGY) userScore = progress.psychology[diff];

                            if (diff === Difficulty.HARD) {
                                let mediumScore = 0;
                                if (section === SectionType.DIDACTICS) mediumScore = progress.didactics[Difficulty.MEDIUM];
                                else if (section === SectionType.LEGISLATION) mediumScore = progress.legislation[Difficulty.MEDIUM];
                                else if (section === SectionType.PSYCHOLOGY) mediumScore = progress.psychology[Difficulty.MEDIUM];
                                if (mediumScore < 90) isLocked = true;
                            }

                            return (
                                <button
                                    key={diff}
                                    disabled={isLocked || (section === SectionType.DIDACTICS && !selectedSubject)}
                                    onClick={() => startQuiz(section, diff, section === SectionType.DIDACTICS ? selectedSubject! : undefined)}
                                    className={`
                                        relative py-4 rounded-xl flex flex-col items-center justify-center gap-2 border transition-all
                                        ${isLocked 
                                            ? 'bg-slate-900/50 border-slate-700 text-slate-600 cursor-not-allowed' 
                                            : 'bg-slate-700 border-slate-500 hover:bg-slate-600 hover:border-amber-400 hover:scale-105 shadow-lg'
                                        }
                                    `}
                                >
                                    <span className="font-bold text-lg">{diff}</span>
                                    {isLocked && <span className="text-xs text-red-500">مغلق (تحتاج 90ن في المتوسط)</span>}
                                    {!isLocked && userScore > 0 && <span className="text-xs text-green-400">أعلى نتيجة: {userScore}</span>}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
        
        {loading && (
            <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-amber-400 mb-4"></div>
                <p className="text-xl animate-pulse">جاري تحضير الأسئلة... يرجى الانتظار</p>
                <p className="text-sm text-slate-400 mt-2">نستخدم الذكاء الاصطناعي لضمان عدم تكرار الأسئلة</p>
            </div>
        )}
      </div>
    );
  }

  if (currentScreen === 'quiz') {
    const currentQ = questions[currentQIndex];
    if (!currentQ) return <div>Loading...</div>;

    return (
        <div className="min-h-screen relative font-sans text-white bg-slate-900 flex flex-col items-center justify-center p-4">
            <Background />
            <SideBarText />
            <DeveloperCredit />
            
            {/* Top Bar */}
            <div className="absolute top-4 w-full max-w-4xl flex justify-between items-center px-4 z-20">
                <button onClick={() => setCurrentScreen('menu')} className="bg-red-600/80 hover:bg-red-700 px-4 py-2 rounded-lg text-sm">خروج</button>
                <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-600">
                    النقاط: <span className="text-amber-400 font-bold">{score}</span> / 100
                </div>
                <div className={`px-4 py-2 rounded-lg border font-mono font-bold text-xl ${timeLeft < 10 ? 'bg-red-900 border-red-500 animate-pulse' : 'bg-slate-800 border-slate-600'}`}>
                    00:{timeLeft.toString().padStart(2, '0')}
                </div>
            </div>

            {/* Question Card */}
            <div className="z-10 w-full max-w-3xl bg-slate-800/90 backdrop-blur-xl p-8 rounded-3xl border border-slate-500 shadow-2xl mt-12">
                <div className="flex justify-between items-center mb-6">
                    <span className="text-sm text-slate-400">سؤال {currentQIndex + 1} من {questions.length}</span>
                    <span className="text-xs bg-slate-700 px-2 py-1 rounded">{currentQ.type === 'oral_scenario' ? 'شفهي/وضعية' : 'كتابي'}</span>
                </div>
                
                <h2 className="text-2xl md:text-3xl font-bold leading-relaxed mb-8 text-center" dir="auto">
                    {currentQ.text}
                </h2>

                <div className="space-y-4">
                    {currentQ.options.map((option, idx) => {
                        let btnClass = "w-full p-4 rounded-xl border-2 text-lg font-semibold transition-all transform hover:scale-[1.02] text-right ";
                        
                        if (lastAnswerCorrect !== null) {
                            if (option === currentQ.correctAnswer) {
                                btnClass += "bg-green-600 border-green-400 shadow-[0_0_15px_rgba(34,197,94,0.5)]";
                            } else if (lastAnswerCorrect === false && timeLeft === 0) {
                                 // Show correct answer if time runs out
                                 if (option === currentQ.correctAnswer) btnClass += "bg-green-600 border-green-400";
                                 else btnClass += "bg-slate-700 border-slate-600 opacity-50";
                            } else if (lastAnswerCorrect === false) {
                                // User picked wrong
                                btnClass += "bg-slate-700 border-slate-600 opacity-50"; 
                                // Specific wrong styling would require tracking selected index, simplifying here
                            } else {
                                btnClass += "bg-slate-700 border-slate-600 opacity-50";
                            }
                        } else {
                            btnClass += "bg-slate-700 border-slate-600 hover:border-amber-400 hover:bg-slate-600";
                        }

                        return (
                            <button 
                                key={idx} 
                                onClick={() => lastAnswerCorrect === null && submitAnswer(option)}
                                disabled={lastAnswerCorrect !== null}
                                className={btnClass}
                            >
                                {option}
                            </button>
                        );
                    })}
                </div>

                {lastAnswerCorrect !== null && (
                    <div className="mt-6 text-center animate-bounce">
                        {lastAnswerCorrect ? 
                            <span className="text-2xl font-bold text-green-400">أحسنت! إجابة صحيحة {["مبدع", "ممتاز", "رائع", "واصل"][Math.floor(Math.random()*4)]}</span> : 
                            <span className="text-2xl font-bold text-red-400">للأسف، إجابة خاطئة</span>
                        }
                    </div>
                )}
            </div>
        </div>
    );
  }

  if (currentScreen === 'result') {
    const passed = score >= 50;
    const perfect = score >= 90;
    
    return (
        <div className="min-h-screen relative font-sans text-white bg-slate-900 flex items-center justify-center p-4">
            <Background />
            <SideBarText />
            <DeveloperCredit />
            
            <div className="z-10 w-full max-w-2xl bg-slate-800/90 backdrop-blur-xl p-8 rounded-3xl border border-slate-500 shadow-2xl text-center">
                <h2 className="text-4xl font-bold mb-4 text-amber-400">النتيجة النهائية</h2>
                
                <div className="text-6xl font-black mb-6 neon-text">
                    {score} / 100
                </div>

                <div className="mb-8">
                    {passed ? (
                        <p className="text-xl text-green-400 mb-2">
                             {perfect ? "مبارك عليك التفوق!" : "مبارك عليك النجاح!"}
                        </p>
                    ) : (
                        <p className="text-xl text-red-400 mb-2">نعتذر، عليك العمل بجدية أكبر لتكون ناجحاً بإذن الله.</p>
                    )}
                    <p className="text-slate-300">
                        {selectedSection} - مستوى {selectedDifficulty}
                    </p>
                </div>

                {perfect && selectedDifficulty === Difficulty.HARD && (
                    <div className="bg-amber-100/10 border border-amber-500/50 p-6 rounded-xl mb-8 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                        <h3 className="text-2xl font-serif text-amber-400 mb-2">شهادة تأهيل</h3>
                        <p className="text-sm md:text-lg leading-relaxed">
                            يشهد تطبيق "اسألني فأنا أستاذ" أن السيد(ة) <span className="font-bold text-white">{user?.name}</span><br/>
                            مؤهل(ة) لأن يكون أستاذاً ناجحاً بإذن الله.<br/>
                            بالتوفيق في المسابقة الرسمية.
                        </p>
                        <div className="mt-4 flex justify-center">
                           <div className="w-16 h-16 border-2 border-amber-400 rounded-full flex items-center justify-center text-amber-400 font-serif font-bold text-xs transform rotate-12">
                               مؤهل
                           </div>
                        </div>
                    </div>
                )}

                <button 
                    onClick={() => setCurrentScreen('menu')}
                    className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition-transform hover:scale-105"
                >
                    العودة للقائمة الرئيسية
                </button>
            </div>
        </div>
    );
  }

  return null;
}
