/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken, User } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  onSnapshot, 
  updateDoc, 
  serverTimestamp,
  getDoc,
  getDocFromServer
} from 'firebase/firestore';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { 
  Type, 
  Smartphone, 
  Monitor, 
  Copy, 
  Check, 
  Camera, 
  Trash2, 
  Wifi,
  Loader2,
  PenTool,
  ZoomIn,
  ZoomOut,
  Maximize,
  AlertCircle,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  RefreshCw,
  Download,
  ShieldCheck,
  Zap,
  Bold,
  Italic,
  Strikethrough,
  QrCode,
  RotateCcw,
  RotateCw,
  History,
  Volume2,
  Palette,
  Play,
  Pause,
  UserCheck,
  Timer as TimerIcon,
  ChevronDown,
  Plus,
  Minus,
  Sparkles,
  Hourglass,
  Sun,
  Moon,
  Target
} from 'lucide-react';
import { RoomData } from './types';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyA5b0v8wZKc9NF7PfO1dtVSQUNemgRXNSc",
  authDomain: "gen-lang-client-0254206427.firebaseapp.com",
  projectId: "gen-lang-client-0254206427",
  storageBucket: "gen-lang-client-0254206427.firebasestorage.app",
  messagingSenderId: "747642061102",
  appId: "1:747642061102:web:9f129b6c976de0484dfabf"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app, "ai-studio-0b90cac5-c854-4d4b-86ee-b32db8fb4f94");
const appId = 'sync-board-v5';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const safeStorageMemory: Record<string, string> = {};
const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn("Storage getItem failed under container restriction, using fallback memory", e);
      return safeStorageMemory[key] || null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn("Storage setItem failed under container restriction, using fallback memory", e);
      safeStorageMemory[key] = value;
    }
  }
};

// --- Utility Functions ---
const generateRoomCode = (): string => Math.floor(1000 + Math.random() * 9000).toString();

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to read file as data URL'));
        return;
      }
      const img = new Image();
      img.src = result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1000; 
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get 2D canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<string>('landing'); 
  const [authError, setAuthError] = useState<boolean>(false);
  const [localTheme, setLocalTheme] = useState<'light' | 'dark'>(() => (safeStorage.getItem('theme') as 'light' | 'dark') || 'light');

  const toggleTheme = () => {
    const nextTheme = localTheme === 'light' ? 'dark' : 'light';
    setLocalTheme(nextTheme);
    safeStorage.setItem('theme', nextTheme);
  };

  useEffect(() => {
    let localUserSet = false;
    const initAuth = async () => {
      try {
        const customToken = (window as any).__initial_auth_token;
        if (customToken) {
          await signInWithCustomToken(auth, customToken);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.warn("Firebase Auth failed (likely Anonymous authentication is disabled in the console):", error);
        const fallbackUid = safeStorage.getItem('syncboard_uid') || (() => {
          const newUid = 'anon_' + Math.random().toString(36).substring(2, 11);
          safeStorage.setItem('syncboard_uid', newUid);
          return newUid;
        })();
        localUserSet = true;
        setUser({ uid: fallbackUid, isAnonymous: true } as any);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
      } else {
        if (!localUserSet) {
          setUser(null);
        }
      }
    });

    const savedMode = safeStorage.getItem('syncboard_mode');
    const params = new URLSearchParams(window.location.search);
    if (params.get('room')) {
      setMode('client');
    } else if (savedMode) {
      setMode(savedMode);
    }

    return () => unsubscribe();
  }, []);

  const handleSetMode = (m: string) => {
    setMode(m);
    safeStorage.setItem('syncboard_mode', m);
  };

  if (authError) {
    return (
      <div className="min-h-screen bg-rose-50 flex flex-col items-center justify-center p-6 text-center font-sans">
        <AlertCircle className="w-14 h-14 text-rose-500 mb-4 animate-bounce" />
        <h2 className="text-2xl font-extrabold text-rose-900 tracking-tight">连接失败 / Sambungan Gagal</h2>
        <p className="text-rose-600 mt-2 max-w-md font-medium text-sm">
          无法与云数据库建立实时握手连接，请检查您的网络连接并重新刷新页面。<br/>
          <span className="text-xs text-rose-400 mt-1 block">Ralat rangkaian dikesan. Sila muat semula.</span>
        </p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-6 px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-lg transition-transform active:scale-95 text-sm cursor-pointer"
        >
          重新尝试刷新 / Muat Semula
        </button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans">
        <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100 flex flex-col items-center text-center space-y-4 max-w-sm">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">建立安全连接...</h3>
            <p className="text-xs text-slate-400 mt-1">Sambungan disulitkan sedang dilaraskan</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans selection:bg-blue-100 selection:text-blue-900 antialiased ${localTheme === 'dark' ? 'dark text-slate-100 bg-slate-950' : 'text-slate-800 bg-slate-50'}`}>
      {mode === 'landing' && <LandingView onSelectMode={handleSetMode} theme={localTheme} onToggleTheme={toggleTheme} />}
      {mode === 'host' && <HostView user={user} onBack={() => handleSetMode('landing')} globalTheme={localTheme} setGlobalTheme={setLocalTheme} />}
      {mode === 'client' && <ClientView user={user} onBack={() => handleSetMode('landing')} globalTheme={localTheme} setGlobalTheme={setLocalTheme} />}
    </div>
  );
}

// --- Landing View ---
interface LandingViewProps {
  onSelectMode: (mode: string) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const LandingView: React.FC<LandingViewProps> = ({ onSelectMode, theme, onToggleTheme }) => (
  <div className={`flex flex-col items-center justify-center min-h-screen p-6 space-y-12 relative overflow-hidden transition-colors duration-300 ${
    theme === 'dark' ? 'bg-[#0f172a] text-slate-100' : 'bg-slate-50 text-slate-800'
  }`}>
    {/* Background Decorative Blobs */}
    <div className={`absolute top-0 left-0 w-80 h-80 rounded-full blur-3xl -z-10 -translate-x-10 -translate-y-10 ${
      theme === 'dark' ? 'bg-blue-900/20' : 'bg-blue-100/40'
    }`} />
    <div className={`absolute bottom-0 right-0 w-80 h-80 rounded-full blur-3xl -z-10 translate-x-10 translate-y-10 ${
      theme === 'dark' ? 'bg-emerald-900/15' : 'bg-emerald-100/30'
    }`} />

    {/* Floating Theme Switcher */}
    <div className="absolute top-6 right-6 z-20">
      <button 
        onClick={onToggleTheme}
        className={`p-3 rounded-xl border flex items-center justify-center transition-all shadow-sm cursor-pointer ${
          theme === 'dark' 
            ? 'bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800' 
            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
        }`}
        title={theme === 'dark' ? '切换亮色 / Light Mode' : '切换暗色 / Dark Mode'}
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </div>

    <div className="text-center space-y-4 max-w-xl animate-fade-in">
      <div className="inline-flex p-4 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-100/80 mb-2 transition-transform hover:rotate-12 duration-300">
        <RefreshCw className="w-10 h-10" />
      </div>
      <h1 className={`text-5xl font-black tracking-tight leading-none ${
        theme === 'dark' ? 'text-white' : 'text-slate-900'
      }`}>
        Sync<span className="text-blue-600 font-extrabold">Board</span>
      </h1>
      <p className="text-slate-400 text-base font-bold tracking-wide">
        即时多设备协作空间 / Instant Multi-Device Workspace
      </p>
      <div className={`inline-flex items-center gap-1.5 px-3 py-1 border shadow-sm rounded-full text-[10px] font-mono tracking-widest ${
        theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white/80 border-slate-200 text-slate-500'
      }`}>
        <span>会话状态 / STATUS: STABLE-V5</span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-3xl">
      <button
        onClick={() => onSelectMode('host')}
        className={`group flex flex-col items-center p-10 border rounded-[2.5rem] shadow-xl hover:shadow-2xl hover:border-blue-500 hover:-translate-y-1 transition-all duration-300 active:scale-95 text-left cursor-pointer ${
          theme === 'dark' ? 'bg-[#131a2c] border-slate-800 text-slate-100' : 'bg-white border-slate-200/60 text-slate-855'
        }`}
      >
        <div className="p-5 bg-blue-50 text-blue-600 rounded-full mb-6 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 shadow-sm shadow-blue-100">
          <Monitor className="w-12 h-12" />
        </div>
        <h2 className={`text-2xl font-black tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-955'}`}>大屏接收端</h2>
        <h3 className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wide">Penerima Skrin / Host Display</h3>
        <p className="text-slate-400 mt-3 text-xs text-center leading-relaxed">
          建立投影展示大屏幕，实时接收、渲染控制端的画板批注、文本及照片，支持课程历史页归档下载。
        </p>
        <div className={`mt-4 px-3 py-1 rounded-lg text-[10px] font-bold transition-colors ${
          theme === 'dark' ? 'bg-slate-800 text-slate-400 group-hover:text-blue-400' : 'bg-slate-50 text-slate-400 group-hover:text-blue-605'
        }`}>
          大屏投射模式 / HOST DISPLAY MODE
        </div>
      </button>

      <button
        onClick={() => onSelectMode('client')}
        className={`group flex flex-col items-center p-10 border rounded-[2.5rem] shadow-xl hover:shadow-2xl hover:border-emerald-500 hover:-translate-y-1 transition-all duration-300 active:scale-95 text-left cursor-pointer ${
          theme === 'dark' ? 'bg-[#131a2c] border-slate-800 text-slate-100' : 'bg-white border-slate-200/60 text-slate-855'
        }`}
      >
        <div className="p-5 bg-emerald-50 text-emerald-600 rounded-full mb-6 group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300 shadow-sm shadow-emerald-100">
          <Smartphone className="w-12 h-12" />
        </div>
        <h2 className={`text-2xl font-black tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-955'}`}>手机控制器</h2>
        <h3 className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wide">Pengawal Telefon / Controller Client</h3>
        <p className="text-slate-400 mt-3 text-xs text-center leading-relaxed">
          手持移动管理器，支持实时文本秒级传输、智能双向白板手画、拍照快捷上传以及多功能随机抽签计时。
        </p>
        <div className={`mt-4 px-3 py-1 rounded-lg text-[10px] font-bold transition-colors ${
          theme === 'dark' ? 'bg-slate-800 text-slate-400 group-hover:text-emerald-400' : 'bg-slate-50 text-slate-400 group-hover:text-emerald-605'
        }`}>
          手机控制模式 / CLIENT CONTROL MODE
        </div>
      </button>
    </div>
  </div>
);

// --- Host View ---
interface HostViewProps {
  user: User;
  onBack: () => void;
  globalTheme: 'light' | 'dark';
  setGlobalTheme: (t: 'light' | 'dark') => void;
}

const HostView: React.FC<HostViewProps> = ({ user, onBack, globalTheme, setGlobalTheme }) => {
  const [roomCode, setRoomCode] = useState<string>('');
  const [data, setData] = useState<RoomData | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const lastSpeakTrigger = useRef<number | undefined>(undefined);

  // Countdown clock state
  const [localTimerSeconds, setLocalTimerSeconds] = useState<number>(0);
  // Picker roll animation states
  const [localRolledName, setLocalRolledName] = useState<string>('');
  const [isLocalRolling, setIsLocalRolling] = useState<boolean>(false);
  const lastRollTrigger = useRef<number | undefined>(undefined);

  // New features states & refs
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [laserTrail, setLaserTrail] = useState<{ x: number; y: number; id: number; age: number }[]>([]);
  const prevDataRef = useRef<{
    content: string;
    imageData: string | null;
    type: string;
    pickedResult: string;
    pickerRollTrigger: number;
    timerRunning: boolean;
    timerTimeLeft: number;
    historyLength: number;
  }>({
    content: '',
    imageData: null,
    type: 'text',
    pickedResult: '',
    pickerRollTrigger: 0,
    timerRunning: false,
    timerTimeLeft: 0,
    historyLength: 0
  });

  // Dynamic Web Audio API Sound Synthesizer
  const playSynthesisSound = (type: 'pop' | 'bell' | 'sparkle' | 'success') => {
    if (!soundEnabled) return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      if (type === 'pop') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else if (type === 'bell') {
        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(987.77, ctx.currentTime); // B5
        osc.frequency.exponentialRampToValueAtTime(493.88, ctx.currentTime + 0.6);
        
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(1975.53, ctx.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(987.77, ctx.currentTime + 0.6);
        
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.6);
        
        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start();
        osc2.start();
        osc.stop(ctx.currentTime + 0.6);
        osc2.stop(ctx.currentTime + 0.6);
      } else if (type === 'sparkle') {
        // High rapid cascade
        const now = ctx.currentTime;
        [523.25, 659.25, 783.99, 1046.50, 1318.51].forEach((freq, index) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.frequency.setValueAtTime(freq, now + index * 0.05);
          gain.gain.setValueAtTime(0.08, now + index * 0.05);
          gain.gain.exponentialRampToValueAtTime(0.005, now + index * 0.05 + 0.15);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + index * 0.05);
          osc.stop(now + index * 0.05 + 0.15);
        });
      } else if (type === 'success') {
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc1.frequency.setValueAtTime(523.25, now); // C5
        osc1.frequency.setValueAtTime(659.25, now + 0.12); // E5
        
        osc2.frequency.setValueAtTime(783.99, now); // G5
        osc2.frequency.setValueAtTime(1046.50, now + 0.12); // C6
        
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.45);
        osc2.stop(now + 0.45);
      }
    } catch (e) {
      console.warn("Audio synthesis error:", e);
    }
  };

  // Laser Pointer Gesture Decay Loop
  useEffect(() => {
    if (data?.laserActive && data?.laserX !== undefined && data?.laserY !== undefined) {
      setLaserTrail(prev => {
        const newTrail = [...prev, { x: data.laserX!, y: data.laserY!, id: Math.random(), age: 1 }];
        if (newTrail.length > 35) {
          newTrail.shift();
        }
        return newTrail;
      });
    } else {
      setLaserTrail([]);
    }
  }, [data?.laserX, data?.laserY, data?.laserActive]);

  useEffect(() => {
    if (laserTrail.length === 0) return;
    const interval = setInterval(() => {
      setLaserTrail(prev => {
        const decayed = prev.map(p => ({ ...p, age: p.age - 0.12 })).filter(p => p.age > 0);
        return decayed;
      });
    }, 45);
    return () => clearInterval(interval);
  }, [laserTrail.length]);

  // Audio Feedback Watcher from snapshot stream changes
  useEffect(() => {
    if (!data) return;
    const prev = prevDataRef.current;

    // 1. check if content or image pushed
    if (data.type === 'text' && data.content && data.content !== prev.content) {
      playSynthesisSound('pop');
    } else if (data.type === 'image' && data.imageData && data.imageData !== prev.imageData) {
      playSynthesisSound('bell');
    }

    // 2. check if timer running status changed or started
    if (data.type === 'timer') {
      if (data.timerRunning && data.timerRunning !== prev.timerRunning) {
        playSynthesisSound('pop');
      }
    }

    // 3. check if picker rolled / finish roll / roll trigger
    if (data.type === 'namePicker') {
      if (data.pickerRollTrigger && data.pickerRollTrigger !== prev.pickerRollTrigger) {
        playSynthesisSound('pop');
      }
      if (data.pickedResult && data.pickedResult !== prev.pickedResult) {
        playSynthesisSound('sparkle');
      }
    }

    // 4. check if slides/history increased
    if (data.historyList && data.historyList.length > (prev.historyLength || 0)) {
      playSynthesisSound('success');
    }

    // Update the comparator ref
    prevDataRef.current = {
      content: data.content || '',
      imageData: data.imageData || null,
      type: data.type || 'text',
      pickedResult: data.pickedResult || '',
      pickerRollTrigger: data.pickerRollTrigger || 0,
      timerRunning: data.timerRunning || false,
      timerTimeLeft: data.timerTimeLeft ?? 0,
      historyLength: data.historyList?.length || 0
    };
  }, [data]);

  // Batch Export Slides/Board History as high-fidelity PDF report
  const handleExportPDF = async () => {
    if (!data?.historyList || data.historyList.length === 0) return;
    
    try {
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [1280, 720]
      });
      
      const list = data.historyList;
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (i > 0) {
          pdf.addPage([1280, 720], 'landscape');
        }
        
        // Soft blue-grey aesthetic slide background
        pdf.setFillColor(248, 250, 252); 
        pdf.rect(0, 0, 1280, 720, 'F');
        
        // Slide thin outline border decoration
        pdf.setDrawColor(226, 232, 240);
        pdf.setLineWidth(4);
        pdf.rect(20, 20, 1240, 680, 'D');

        // Header logo & page tracking
        pdf.setTextColor(37, 99, 235); // Blue
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(26);
        pdf.text("SyncBoard", 60, 65);

        pdf.setTextColor(71, 85, 105); // slate grey
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(16);
        pdf.text(`Interactive Class Page | slide ${i + 1} of ${list.length}`, 200, 65);

        pdf.setTextColor(148, 163, 184); // timestamp
        pdf.setFontSize(11);
        const savedDate = new Date(item.savedAt).toLocaleString();
        pdf.text(`Saved timestamp: ${savedDate}`, 60, 92);
        
        // Divide header from content
        pdf.setDrawColor(241, 245, 249);
        pdf.setLineWidth(1.5);
        pdf.line(60, 105, 1220, 105);

        // Slide Content rendering
        if (item.type === 'image' && item.imageData) {
          try {
            // Draw board image slide
            pdf.addImage(item.imageData, 'JPEG', 180, 130, 920, 517);
          } catch (imgErr) {
            console.error("Error drawing image to PDF slide", imgErr);
            pdf.setTextColor(239, 68, 68);
            pdf.setFontSize(18);
            pdf.text("Image format conversion anomaly. Unable to draw.", 200, 320);
          }
        } else if (item.content) {
          // Wrap text nicely to fit slide area
          pdf.setTextColor(15, 23, 42);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(24);
          const splitLines = pdf.splitTextToSize(item.content, 1050);
          pdf.text(splitLines, 80, 160);
        }
      }
      
      pdf.save(`SyncBoard_ClassNotes_Room_${roomCode}.pdf`);
    } catch (e) {
      console.error("Critical error while rendering jsPDF archive: ", e);
    }
  };

  useEffect(() => {
    if (data?.type === 'timer') {
      const running = data.timerRunning || false;
      const baseSeconds = data.timerTimeLeft ?? 0;
      const updatedTime = data.timerUpdated ?? Date.now();

      if (running) {
        const elapsed = Math.floor((Date.now() - updatedTime) / 1000);
        const currentLeft = Math.max(0, baseSeconds - elapsed);
        setLocalTimerSeconds(currentLeft);

        const interval = setInterval(() => {
          const tElapsed = Math.floor((Date.now() - updatedTime) / 1000);
          const tLeft = Math.max(0, baseSeconds - tElapsed);
          setLocalTimerSeconds(tLeft);
          if (tLeft === 0) {
            clearInterval(interval);
          }
        }, 200);
        return () => clearInterval(interval);
      } else {
        setLocalTimerSeconds(baseSeconds);
      }
    }
  }, [data?.type, data?.timerTimeLeft, data?.timerRunning, data?.timerUpdated]);

  useEffect(() => {
    if (data?.type === 'namePicker' && data?.pickerRollTrigger) {
      if (lastRollTrigger.current !== data.pickerRollTrigger) {
        lastRollTrigger.current = data.pickerRollTrigger;
        
        const names = (data.namesList || '')
          .split(/[\n,;，；]+/)
          .map(n => n.trim())
          .filter(n => n.length > 0);
          
        if (names.length > 0) {
          setIsLocalRolling(true);
          let counter = 0;
          const interval = setInterval(() => {
            const randomIndex = Math.floor(Math.random() * names.length);
            setLocalRolledName(names[randomIndex]);
            counter++;
          }, 80);
          
          setTimeout(() => {
            clearInterval(interval);
            setIsLocalRolling(false);
          }, 1500);
        }
      }
    }
  }, [data?.type, data?.pickerRollTrigger, data?.namesList]);

  useEffect(() => {
    if (roomCode) {
      const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
      QRCode.toDataURL(inviteUrl, {
        width: 256,
        margin: 1,
        color: {
          dark: '#1e293b',
          light: '#ffffff'
        }
      })
      .then(url => setQrCodeUrl(url))
      .catch(err => console.error("Failed to generate QR Code", err));
    }
  }, [roomCode]);

  useEffect(() => {
    let code = safeStorage.getItem('syncboard_room');
    if (!code) {
      code = generateRoomCode();
      safeStorage.setItem('syncboard_room', code);
    }
    setRoomCode(code);
    
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', `room_${code}`);
    
    const setupRoom = async () => {
      try {
        const snap = await getDoc(roomRef);
        if (!snap.exists()) {
          await setDoc(roomRef, {
            hostId: user.uid,
            type: 'text',
            content: '',
            imageData: null,
            align: 'center',
            createdAt: serverTimestamp(),
            lastActive: serverTimestamp()
          });
        }
      } catch (error) {
        console.error("Error setting up Firestore document:", error);
        try {
          handleFirestoreError(error, OperationType.WRITE, `artifacts/${appId}/public/data/rooms/room_${code}`);
        } catch (e) {
          // Prevent fatal crash but log JSON info
        }
      } finally {
        setIsInitializing(false);
      }
    };

    setupRoom();

    const unsubscribe = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const fetched = snapshot.data() as RoomData;
        setData(fetched);
        
        if (fetched.theme && fetched.theme !== globalTheme) {
          setGlobalTheme(fetched.theme);
        }
        
        if (fetched.speakTrigger) {
          if (lastSpeakTrigger.current !== undefined && fetched.speakTrigger !== lastSpeakTrigger.current) {
            if (fetched.type === 'text' && fetched.content) {
              try {
                if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis) {
                  window.speechSynthesis.cancel();
                  if (typeof SpeechSynthesisUtterance !== 'undefined') {
                    const utterance = new SpeechSynthesisUtterance(fetched.content);
                    // Simple regex to choose language (Chinese or generic/English)
                    if (/[\u4e00-\u9fa5]/.test(fetched.content)) {
                      utterance.lang = 'zh-CN';
                    } else {
                      utterance.lang = 'en-US';
                    }
                    window.speechSynthesis.speak(utterance);
                  }
                }
              } catch (speechErr) {
                console.warn("Speech synthesis is not supported or restricted in this environment:", speechErr);
              }
            }
          }
          lastSpeakTrigger.current = fetched.speakTrigger;
        } else {
          lastSpeakTrigger.current = 0;
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `artifacts/${appId}/public/data/rooms/room_${code}`);
    });

    return () => unsubscribe();
  }, [user.uid]);

  const handleCopy = () => {
    if (!data?.content) return;
    const fallbackCopy = (text: string) => {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (e) {
        console.error("Fallback copy failed", e);
      }
      document.body.removeChild(textArea);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(data.content)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => {
          fallbackCopy(data.content);
        });
    } else {
      fallbackCopy(data.content);
    }
  };

  const handleDownloadSession = () => {
    if (!data) return;
    if (data.type === 'image' && data.imageData) {
      const link = document.createElement('a');
      link.href = data.imageData;
      link.download = `syncboard_canvas_room_${roomCode}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (data.content) {
      const blob = new Blob([data.content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `syncboard_text_room_${roomCode}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handleCaptureSnapshot = () => {
    if (!data) return;
    
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const theme = globalTheme;
      
      // Fill background based on current theme
      ctx.fillStyle = theme === 'dark' ? '#0f172a' : '#f8fafc';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw brand header
      ctx.fillStyle = theme === 'dark' ? '#38bdf8' : '#2563eb';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('SyncBoard Screen Snapshot', 60, 80);
      
      ctx.fillStyle = theme === 'dark' ? '#64748b' : '#94a3b8';
      ctx.font = '18px monospace';
      ctx.fillText(`ROOM: #${roomCode} | TIMESTAMP: ${new Date().toLocaleString()}`, 60, 120);
      
      // Draw dividing lines
      ctx.strokeStyle = theme === 'dark' ? '#1e293b' : '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(60, 150);
      ctx.lineTo(1860, 150);
      ctx.stroke();
      
      const triggerDownload = () => {
        const dataUrl = canvas.toDataURL('image/png');
        try {
          localStorage.setItem(`syncboard_snapshot_${roomCode}`, dataUrl);
        } catch (storageError) {
          console.warn("Storage quota limit reached for snapshot saving.", storageError);
        }
        
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `syncboard_snapshot_room_${roomCode}_${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      };

      if (data.type === 'image' && data.imageData) {
        const img = new Image();
        img.src = data.imageData;
        img.onload = () => {
          const maxW = 1600;
          const maxH = 800;
          let w = img.width;
          let h = img.height;
          const ratio = w / h;
          if (w > maxW) {
            w = maxW;
            h = w / ratio;
          }
          if (h > maxH) {
            h = maxH;
            w = h * ratio;
          }
          const x = 960 - w / 2;
          const y = 600 - h / 2;
          ctx.drawImage(img, x, y, w, h);
          triggerDownload();
        };
        img.onerror = () => {
          triggerDownload();
        };
      } else if (data.type === 'timer') {
        ctx.fillStyle = theme === 'dark' ? '#c084fc' : '#9333ea';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('COUNTDOWN TIMER / 倒计时器', 960, 350);
        
        ctx.fillStyle = theme === 'dark' ? '#f8fafc' : '#1e293b';
        ctx.font = 'black 140px monospace';
        const mins = Math.floor(localTimerSeconds / 60);
        const secs = localTimerSeconds % 60;
        const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        ctx.fillText(timeStr, 960, 520);
        
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText('ACTIVE DIGITAL CLOCK MODE', 960, 600);
        triggerDownload();
      } else if (data.type === 'namePicker') {
        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('RANDOM SELECTOR WINNER / 随机抽取', 960, 350);
        
        ctx.fillStyle = theme === 'dark' ? '#f8fafc' : '#0f172a';
        ctx.font = 'bold 90px sans-serif';
        ctx.fillText(data.pickedResult || 'WAITING FOR SIGNAL...', 960, 500);
        triggerDownload();
      } else {
        ctx.fillStyle = data.textColor || (theme === 'dark' ? '#f8fafc' : '#0f172a');
        const fontName = data.fontFamily === 'serif' ? 'Georgia' : data.fontFamily === 'mono' ? 'Courier New' : 'sans-serif';
        const fontSizeVal = data.fontSize ? Math.round(data.fontSize * 1.5) : 72;
        ctx.font = `${data.bold ? 'bold' : 'normal'} ${data.italic ? 'italic' : ''} ${fontSizeVal}px ${fontName}`;
        
        const lines = (data.content || '').split('\n');
        let currentY = 320;
        ctx.textAlign = data.align === 'center' ? 'center' : data.align === 'right' ? 'right' : 'left';
        const currentX = data.align === 'center' ? 960 : data.align === 'right' ? 1700 : 200;
        
        lines.forEach(line => {
          ctx.fillText(line, currentX, currentY);
          currentY += fontSizeVal + 24;
        });
        triggerDownload();
      }
    } catch (e) {
      console.error("Failed to capture snapshot of screen state", e);
    }
  };

  if (isInitializing) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#f8fafc]">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
        <p className="text-slate-500 font-bold">正在载入并建立大屏接收频道...</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-screen overflow-hidden relative font-sans transition-colors duration-300 ${
      globalTheme === 'dark' ? 'bg-[#0b0f19] text-slate-100' : 'bg-slate-50 text-slate-800'
    }`}>
      {/* Sleek Design Header */}
      <header className={`h-20 border-b px-8 flex items-center justify-between shrink-0 z-10 transition-colors duration-300 ${
        globalTheme === 'dark' ? 'bg-[#101726] border-slate-820' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack} 
            className={`p-3 rounded-xl transition-all cursor-pointer border shadow-sm ${
              globalTheme === 'dark' 
                ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-red-400 hover:bg-slate-800' 
                : 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:text-red-500'
            }`}
            title="返回主页 / Back"
          >
             <Trash2 className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-100/90">
              <RefreshCw className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h1 className={`text-xl font-black tracking-tight leading-none ${globalTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>SyncBoard</h1>
              <span className="text-[10px] text-emerald-500 font-bold tracking-wider uppercase flex items-center gap-1.5 mt-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                实时连接激活 / Live Connection Active
              </span>
            </div>
          </div>
        </div>

        {/* Access Code and Channel Tag */}
        <div className="flex items-center gap-6">
          {qrCodeUrl && (
            <div className="group relative">
              <div 
                className={`p-1.5 border rounded-xl cursor-pointer shadow-sm transition-all flex items-center justify-center ${
                  globalTheme === 'dark' ? 'bg-slate-900 border-slate-800 hover:bg-slate-800' : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
                title="扫码加入 / Scan to Join"
              >
                <img src={qrCodeUrl} className="w-10 h-10 object-contain rounded" alt="QR Code" />
              </div>
              <div className={`absolute top-14 right-0 invisible group-hover:visible opacity-0 group-hover:opacity-100 p-4 rounded-2xl shadow-2xl border transition-all duration-200 w-52 text-center z-50 ${
                globalTheme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}>
                <img src={qrCodeUrl} className="w-44 h-44 mx-auto object-contain rounded-xl bg-white p-1" alt="QR Code Expanded" />
                <p className={`text-[10px] font-extrabold uppercase tracking-wider mt-2 ${globalTheme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>扫码一键加入 / Scan to Join</p>
                <span className={`text-[8px] block mt-1 select-all break-all ${globalTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{`${window.location.origin}${window.location.pathname}?room=${roomCode}`}</span>
              </div>
            </div>
          )}
          <div className="flex flex-col items-end shrink-0">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">房间加入码 / Joining Code</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-3xl font-mono font-black leading-none tracking-tighter tabular-nums ${globalTheme === 'dark' ? 'text-amber-400' : 'text-blue-600'}`}>{roomCode}</span>
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            </div>
          </div>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2.5 rounded-xl border flex items-center justify-center transition-all shadow-sm cursor-pointer ${
              soundEnabled
                ? (globalTheme === 'dark' ? 'bg-emerald-950/45 border-emerald-800 text-emerald-400 hover:bg-emerald-900/40' : 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100')
                : (globalTheme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-500 hover:bg-slate-800' : 'bg-slate-100/60 border-slate-200 text-slate-400 hover:bg-slate-100')
            }`}
            title={soundEnabled ? '关闭声音回馈 / Mute Audio' : '开启声音回馈 / Unmute Audio'}
          >
            <Volume2 size={16} />
          </button>
          <div className={`h-10 w-px ${globalTheme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'} hidden sm:block`}></div>
          <div className={`items-center gap-2 px-4 py-2 rounded-full shadow-sm ${globalTheme === 'dark' ? 'bg-[#151c2e]' : 'bg-slate-100'} hidden sm:flex`}>
            <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">H</div>
            <span className={`text-xs font-bold ${globalTheme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>大屏端 / Host Station</span>
          </div>
        </div>
      </header>

      {/* Main Screen Receiver Display (Fully Responsive Stack layout) */}
      <main className="flex-1 flex flex-col lg:flex-row p-4 lg:p-6 gap-6 min-h-0 overflow-y-auto lg:overflow-hidden">
        <div className={`flex-1 rounded-[2.5rem] shadow-xl border flex flex-col overflow-hidden relative transition-colors duration-300 ${
          globalTheme === 'dark' ? 'bg-[#0f172a] border-slate-800 shadow-none' : 'bg-white border-slate-200/60 shadow-slate-200/60'
        }`} style={{ minHeight: '450px' }}>
          
          {/* Action indicator labels top-left */}
          <div className={`absolute top-6 left-6 flex gap-2 z-10 p-1.5 rounded-2xl border backdrop-blur-sm ${
            globalTheme === 'dark' ? 'bg-slate-900/80 border-slate-804' : 'bg-white/70 border-slate-100'
          }`}>
            <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${globalTheme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>4K 高灵敏投射 / 4K UHD</div>
            <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
              data?.type === 'image' ? (globalTheme === 'dark' ? 'bg-emerald-950/40 text-emerald-450' : 'bg-emerald-50 text-emerald-700') :
              data?.type === 'timer' ? (globalTheme === 'dark' ? 'bg-purple-950/40 text-purple-450' : 'bg-purple-50 text-purple-700') :
              data?.type === 'namePicker' ? (globalTheme === 'dark' ? 'bg-amber-950/40 text-amber-450' : 'bg-amber-50 text-amber-750') :
              (globalTheme === 'dark' ? 'bg-blue-950/40 text-blue-450' : 'bg-blue-50 text-blue-700')
            }`}>
              {data?.type === 'image' ? '白板手写幻灯片 / Whiteboard Sketch' :
               data?.type === 'timer' ? '倒计时看板 / Countdown Timer' :
               data?.type === 'namePicker' ? '幸运随机抽签 / Random Name Picker' :
               '文本实时同步 / Live Text Sync'}
            </div>
          </div>

          {/* Laser Pointer Gesture Trails */}
          {laserTrail.map((pt) => (
            <div
              key={pt.id}
              className="absolute pointer-events-none z-45 rounded-full bg-rose-500 blur-[1px] -translate-x-1/2 -translate-y-1/2 transition-all duration-150 ease-out"
              style={{
                left: `${pt.x}%`,
                top: `${pt.y}%`,
                width: `${pt.age * 14}px`,
                height: `${pt.age * 14}px`,
                opacity: pt.age * 0.75,
                boxShadow: '0 0 8px rgba(239, 68, 68, 0.5)'
              }}
            />
          ))}

          {/* Laser Pointer Overlay */}
          {data?.laserActive && data?.laserX !== undefined && data?.laserY !== undefined && (
            <div 
              className="absolute pointer-events-none z-50 transition-all duration-75 ease-out"
              style={{
                left: `${data.laserX}%`,
                top: `${data.laserY}%`,
                transform: 'translate(-50%, -50%)'
              }}
            >
              {/* Radiating pulsing laser rings */}
              <span className="absolute inline-flex h-12 w-12 -left-6 -top-6 rounded-full bg-rose-500/35 animate-ping" />
              <span className="absolute inline-flex h-6 w-6 -left-3 -top-3 rounded-full bg-rose-500/60 animate-pulse" />
              {/* Glowing Laser Center Core */}
              <div className="w-4.5 h-4.5 bg-rose-600 rounded-full border border-white shadow-[0_0_12px_#ef4444]" />
            </div>
          )}

          <div 
            className="w-full h-full transition-transform duration-300 ease-out origin-center p-16 flex items-center justify-center overflow-auto relative bg-transparent"
            style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
          >
            {data?.type === 'image' && data.imageData ? (
              <div className="max-w-full max-h-full flex items-center justify-center p-4">
                <img 
                  src={data.imageData} 
                  className="max-w-[95%] max-h-[85vh] object-contain rounded-2xl shadow-xl border border-slate-200/50 transition-all duration-300" 
                  alt="Sync Content" 
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : data?.type === 'timer' ? (
              /* Countdown Timer View */
              <div className="flex flex-col items-center justify-center p-12 bg-slate-900/5 border border-slate-200/50 rounded-[3rem] shadow-xl w-full max-w-2xl text-center backdrop-blur-sm animate-fade-in">
                <div className="p-4 bg-purple-100 text-purple-600 rounded-3xl mb-6 shadow-sm">
                  <TimerIcon size={36} className={data.timerRunning ? "animate-spin-slow" : ""} />
                </div>
                <h3 className="text-sm font-extrabold text-slate-400 uppercase tracking-widest mb-1">COUNTDOWN TIMER / 倒计时器</h3>
                <span className="text-[11px] font-mono text-emerald-500 font-black tracking-wide bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full mb-8">
                  {data.timerRunning ? "● ACTIVE" : "⏸ PAUSED"}
                </span>

                <div className={`text-8xl md:text-9xl font-mono font-black tracking-tighter tabular-nums mb-8 ${localTimerSeconds <= 10 && localTimerSeconds > 0 ? "text-rose-600 scale-105 transition-all duration-200 animate-pulse" : "text-slate-800"}`}>
                  {(() => {
                    const mins = Math.floor(localTimerSeconds / 60);
                    const secs = localTimerSeconds % 60;
                    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                  })()}
                </div>

                <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden border border-slate-200/60 p-0.5 mb-8">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${localTimerSeconds <= 10 ? "bg-rose-500 animate-pulse" : "bg-gradient-to-r from-purple-500 to-indigo-600"}`}
                    style={{ width: `${Math.min(100, data.timerDuration ? (localTimerSeconds / data.timerDuration) * 100 : 0)}%` }}
                  />
                </div>

                {localTimerSeconds === 0 && data.timerDuration && data.timerDuration > 0 ? (
                  <div className="animate-bounce bg-rose-50 border border-rose-200/80 p-4.5 rounded-2xl w-full">
                    <span className="text-xl font-black text-rose-600 tracking-tight block">⏰ TIME'S UP! / 时间到！</span>
                    <span className="text-xs font-semibold text-rose-400 block mt-1.5">Masa Tamat. Please proceed with the next agenda.</span>
                  </div>
                ) : (
                  <div className="text-sm font-bold text-slate-500 flex items-center gap-2">
                    <Hourglass size={14} className={data.timerRunning ? "animate-pulse" : ""} />
                    <span>设置限时: {Math.floor((data.timerDuration || 0) / 60)} 分钟 / Set: {Math.floor((data.timerDuration || 0) / 60)}m</span>
                  </div>
                )}
              </div>
            ) : data?.type === 'namePicker' ? (
              /* Random Name Picker View */
              <div className="flex flex-col items-center justify-center p-12 bg-slate-900/5 border border-slate-200/50 rounded-[3rem] shadow-xl w-full max-w-2xl text-center backdrop-blur-sm relative overflow-hidden animate-fade-in">
                <div className="p-4 bg-amber-100 text-amber-650 rounded-3xl mb-6 shadow-sm">
                  <UserCheck size={36} className={isLocalRolling ? "animate-bounce" : ""} />
                </div>
                <h3 className="text-sm font-extrabold text-slate-400 uppercase tracking-widest mb-4">RANDOM NAME PICKER / 幸运抽签</h3>

                {isLocalRolling ? (
                  <div className="space-y-4 py-8">
                    <div className="text-[10px] font-extrabold text-amber-500 uppercase tracking-widest animate-pulse">ROLLING NAMES... / 正在挑选</div>
                    <div className="text-5xl md:text-6xl font-black text-blue-600 scale-95 transition-all duration-100 bg-blue-50/50 border border-blue-100 px-10 py-6 rounded-[2rem] shadow-inner select-none font-sans">
                      {localRolledName}
                    </div>
                  </div>
                ) : data.pickedResult ? (
                  <div className="space-y-6 py-6 w-full animate-fade-in">
                    <div className="flex justify-center items-center gap-2.5">
                      <Sparkles className="text-amber-500 animate-pulse" size={20} />
                      <span className="text-xs font-extrabold text-amber-500 uppercase tracking-widest">CONGRATULATIONS / 恭喜被选中者</span>
                      <Sparkles className="text-amber-500" size={20} />
                    </div>
                    <div className="text-5xl md:text-6xl font-sans font-black text-slate-900 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 px-12 py-8 rounded-[2.5rem] shadow-lg shadow-amber-100/40 select-all relative overflow-hidden inline-block max-w-full break-words">
                      {data.pickedResult}
                    </div>
                    <div className="text-xs font-bold text-slate-400 mt-2">
                      🎉 幸运得主已产生！🎉
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 py-8">
                    <p className="text-slate-500 text-lg font-bold">准备就绪，等待移动端指令启动 / Waiting for signal...</p>
                    <div className="text-xs text-slate-400 font-semibold bg-slate-50 border border-slate-100 p-4 rounded-xl">
                      {data.namesList ? (
                        <div>
                          候选成员 ({data.namesList.split(/[\n,;，；]+/).filter(Boolean).length} 位):{' '}
                          <span className="text-blue-600 font-mono text-[10px] block mt-1.5 truncate max-w-md mx-auto">{data.namesList.replace(/\n/g, ', ')}</span>
                        </div>
                      ) : (
                        "请在管理员手机端输入候选名单，然后点击 🍀 随机提取"
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className={`w-full max-w-4xl p-6 ${
                data?.align === 'center' ? 'text-center' : 
                data?.align === 'right' ? 'text-right' : 
                data?.align === 'justify' ? 'text-justify' : 'text-left'
              }`}>
                {data?.content ? (
                  <h2 
                    className={`${
                      data?.fontFamily === 'serif' ? 'font-serif' : data?.fontFamily === 'mono' ? 'font-mono' : 'font-sans'
                    } ${
                      data?.bold ? 'font-black' : 'font-semibold'
                    } ${
                      data?.italic ? 'italic' : 'not-italic'
                    } ${
                      data?.strikethrough ? 'line-through' : 'no-underline'
                    } leading-[1.25] tracking-tight whitespace-pre-wrap break-words selection:bg-blue-250`}
                    style={{
                      color: data?.textColor || undefined,
                      fontSize: data?.fontSize ? `${data.fontSize}px` : undefined
                    }}
                  >
                    {data.content}
                  </h2>
                ) : (
                  <div className="flex flex-col md:flex-row items-center gap-10 max-w-4xl p-10 bg-white/50 backdrop-blur-sm rounded-[2rem] border border-slate-200/50 shadow-lg text-left">
                    <div className="flex-1 space-y-4">
                      <h2 className="text-3xl md:text-4xl font-black text-slate-800 leading-snug tracking-tight">
                        等待移动端连接 / Menanti Sambung...
                      </h2>
                      <p className="text-slate-500 text-sm md:text-base font-medium">
                        请使用手机浏览器输入房间提取码 <span className="font-mono text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl font-bold tracking-tight border border-blue-150">{roomCode}</span> 开启实时流同步。
                      </p>
                      <div className="text-xs text-slate-400 font-semibold space-y-1 bg-slate-100/60 p-4 rounded-xl border border-slate-200/40">
                        <div>或者使用系统相机扫描右侧二维码，移动端将自动配对建立流式连接。</div>
                        <div className="text-blue-500 font-mono text-[9px] break-all mt-1">{`${window.location.origin}${window.location.pathname}?room=${roomCode}`}</div>
                      </div>
                    </div>
                    {qrCodeUrl ? (
                      <div className="flex flex-col items-center p-3.5 bg-white border border-slate-200 rounded-2xl shrink-0 shadow-md">
                        <img src={qrCodeUrl} className="w-40 h-40 object-contain rounded-xl" alt="Lobby QR Code" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2.5 flex items-center gap-1"><QrCode size={11} /> 扫码一键加入 / SCAN JOIN</span>
                      </div>
                    ) : (
                      <div className="w-48 h-48 bg-slate-100 rounded-2xl flex items-center justify-center border border-dashed border-slate-300 animate-pulse shrink-0">
                        <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Symmetrical Floating Control Bar inside bottom container (Sleek Interface) */}
          <div className={`h-20 border-t px-10 flex items-center justify-between shrink-0 transition-colors duration-300 ${
            globalTheme === 'dark' ? 'bg-[#101726]/90 border-slate-800' : 'bg-slate-50/90 border-slate-200/60'
          }`}>
            <div className={`flex items-center gap-3 px-3 py-1.5 rounded-xl border shadow-sm ${
              globalTheme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
            }`}>
              {/* Zoom Buttons */}
              <button 
                onClick={() => setZoom(prev => Math.min(2.5, prev + 0.15))} 
                className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                  globalTheme === 'dark' ? 'hover:bg-slate-800 text-slate-400 hover:text-blue-400' : 'hover:bg-blue-50 text-slate-500 hover:text-blue-600'
                }`}
                title="放大 / Zoom In"
              >
                <ZoomIn size={18}/>
              </button>
              <span className={`text-xs font-mono font-bold w-16 text-center ${globalTheme === 'dark' ? 'text-slate-300' : 'text-slate-500'}`}>{Math.round(zoom*100)}% SCALE</span>
              <button 
                onClick={() => setZoom(prev => Math.max(0.4, prev - 0.15))} 
                className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                  globalTheme === 'dark' ? 'hover:bg-slate-800 text-slate-400 hover:text-blue-400' : 'hover:bg-blue-50 text-slate-500 hover:text-blue-600'
                }`}
                title="缩小 / Zoom Out"
              >
                <ZoomOut size={18}/>
              </button>
              <button 
                onClick={() => setZoom(1)} 
                className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                  globalTheme === 'dark' ? 'hover:bg-slate-800 text-slate-500 hover:text-slate-300' : 'hover:bg-slate-150 text-slate-400 hover:text-slate-600'
                }`} 
                title="还原 100% / Reset Scale"
              >
                <Maximize size={16}/>
              </button>
            </div>

            {/* Rotator and Action Widgets */}
            <div className="flex items-center gap-3">
              {/* Rotation controller widget */}
              <button 
                onClick={() => setRotation(prev => (prev + 90) % 360)} 
                className={`px-4.5 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 duration-100 cursor-pointer flex items-center gap-1.5 border ${
                  globalTheme === 'dark' 
                    ? 'bg-slate-900 hover:bg-slate-805 border-slate-800 text-slate-300' 
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
                title="将内容旋转 90 度 / Rotate content by 90-degree"
              >
                <RotateCw size={13} className="animate-spin-slow" />
                <span>旋转: {rotation}°</span>
              </button>

              {/* Snapshot image save button */}
              <button 
                onClick={handleCaptureSnapshot} 
                className={`px-4.5 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 duration-100 cursor-pointer flex items-center gap-1.5 border ${
                  globalTheme === 'dark' 
                    ? 'bg-blue-600 hover:bg-blue-500 border-blue-700 text-white shadow-blue-900/10' 
                    : 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700'
                }`}
                title="捕捉当前屏幕状态并自动下载为 PNG 图片"
              >
                <Camera size={14} />
                <span>现场快照 / Snapshot (PNG)</span>
              </button>

              <button 
                onClick={handleDownloadSession} 
                className="px-4.5 py-2.5 bg-slate-950 hover:bg-slate-900 text-white border border-slate-850 rounded-xl font-bold text-xs shadow-md transition-transform active:scale-95 duration-100 cursor-pointer flex items-center gap-1.5"
              >
                <Download size={14} />
                下载会话 / Download Session
              </button>

              {data?.type === 'text' && data.content && (
                <button 
                  onClick={handleCopy}
                  className={`px-4.5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all duration-150 active:scale-95 cursor-pointer flex items-center gap-1.5 ${
                    copied 
                      ? 'bg-emerald-600 text-white shadow-emerald-200' 
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100'
                  }`}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? '已复制 / Copied !' : '复制文本 / Copy Text'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Multi-page / Slide History Sidebar */}
        {data?.historyList && data.historyList.length > 0 && (
          <div className={`w-full lg:w-80 rounded-[2.5rem] border p-5 flex flex-col shrink-0 overflow-hidden transition-all duration-300 ${
            globalTheme === 'dark' ? 'bg-[#101726]/90 border-slate-800' : 'bg-white border-slate-200 shadow-lg shadow-slate-200/50'
          }`} style={{ minHeight: '350px' }}>
            <div className="flex items-center justify-between mb-3">
              <span className={`text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${
                globalTheme === 'dark' ? 'text-slate-300' : 'text-slate-800'
              }`}>
                <History className="text-blue-500 animate-pulse" size={14} />
                课程页历史 / Slides History
              </span>
              <span className="text-[9px] bg-blue-50 border border-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">
                {data.historyList.length} 页数 / PAGES
              </span>
            </div>
            
            <p className="text-[10px] text-slate-400 font-medium mb-3 leading-relaxed">
              控制器端点击“保存”时自动归档，点击即可投射归档内容。
            </p>
            
            <button
              onClick={handleExportPDF}
              className="mb-4 w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl shadow-md cursor-pointer transition-all active:scale-98 flex items-center justify-center gap-2 duration-150 shrink-0"
              title="一键导出整堂板书课件 PDF / Export All"
            >
              <Download size={12} />
              一键导出 PDF 课件 / Export Session PDF
            </button>
            
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 no-scrollbar scrollbar-none">
              {data.historyList.map((item, index) => {
                const isActive = (item.type === data.type && 
                                 (item.type === 'text' ? item.content === data.content : item.imageData === data.imageData));
                return (
                  <button
                    key={item.id}
                    onClick={async () => {
                      try {
                        const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', `room_${roomCode}`);
                        await updateDoc(roomRef, {
                          type: item.type,
                          content: item.content,
                          imageData: item.imageData,
                          textColor: item.type === 'text' ? (data.textColor || null) : null,
                          fontFamily: item.type === 'text' ? (data.fontFamily || null) : null,
                          fontSize: item.type === 'text' ? (data.fontSize || null) : null,
                          lastActive: serverTimestamp()
                        });
                      } catch (err) {
                        console.error("Failed to restore history page:", err);
                      }
                    }}
                    className={`w-full p-2.5 border rounded-xl flex items-center gap-3.5 cursor-pointer text-left transition-all ${
                      isActive 
                        ? (globalTheme === 'dark' ? 'bg-blue-950/45 border-blue-500 shadow-inner' : 'bg-blue-50 border-blue-300 shadow-sm')
                        : (globalTheme === 'dark' ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-slate-50/50 hover:bg-slate-50 border-slate-200/60')
                    }`}
                  >
                    <div className="relative shrink-0 flex items-center h-full">
                      {item.type === 'image' ? (
                        <div className="w-10 h-10 bg-slate-150 rounded-lg overflow-hidden border border-slate-200 flex items-center justify-center shadow-inner">
                          <img src={item.imageData!} className="w-full h-full object-cover" alt="Whiteboard preview" referrerPolicy="no-referrer" />
                        </div>
                      ) : (
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center border shadow-inner ${
                          isActive 
                            ? 'bg-blue-100/60 text-blue-600' 
                            : 'bg-indigo-50/45 text-slate-400'
                        }`}>
                          <Type size={14} />
                        </div>
                      )}
                      <div className="absolute -top-1.5 -left-1.5 w-4.5 h-4.5 bg-slate-950 text-white rounded-full text-[8px] font-mono font-bold flex items-center justify-center border border-slate-800/25">
                        {data.historyList.length - index}
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className={`text-[10px] font-bold truncate block ${
                        isActive 
                          ? 'text-blue-600' 
                          : (globalTheme === 'dark' ? 'text-slate-300' : 'text-slate-700')
                      }`}>
                        {item.type === 'text' ? item.content : '白板手写幻灯页'}
                      </span>
                      <span className="text-[8px] text-slate-400 font-mono font-bold">
                        {new Date(item.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Modern Status Footer */}
      <footer className="h-10 bg-slate-950 text-slate-500 text-[10px] px-8 flex items-center justify-between font-mono shrink-0 select-none">
        <div className="flex gap-6">
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            CHANNEL: STABLE-V5
          </span>
          <span>LATENCY: 12ms</span>
          <span>ENCRYPTION: AES-256 SSL</span>
        </div>
        <div className="flex gap-4">
          <span className="text-slate-300">BUILD 5.0.4-RELEASE</span>
          <span className="text-blue-400 hover:underline cursor-pointer">@SYNCBOARD</span>
        </div>
      </footer>
    </div>
  );
};

// --- Client View ---
interface ClientViewProps {
  user: User;
  onBack: () => void;
  globalTheme: 'light' | 'dark';
  setGlobalTheme: (t: 'light' | 'dark') => void;
}

interface HistoryItem {
  id: string;
  type: 'text' | 'image';
  content: string;
  imageData: string | null;
  savedAt: number;
}

const ClientView: React.FC<ClientViewProps> = ({ user, onBack, globalTheme, setGlobalTheme }) => {
  const urlParams = new URLSearchParams(window.location.search);
  const initialRoom = urlParams.get('room');

  const [step, setStep] = useState<string>(initialRoom ? 'connecting' : 'join');
  const [roomCode, setRoomCode] = useState<string>(initialRoom || '');
  const [inputMode, setInputMode] = useState<string>('text');
  const [text, setText] = useState<string>('');
  const [status, setStatus] = useState<string>('idle'); 
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  
  const [localClientTimerSeconds, setLocalClientTimerSeconds] = useState<number>(0);

  useEffect(() => {
    if (roomData?.type === 'timer') {
      const running = roomData.timerRunning || false;
      const baseSeconds = roomData.timerTimeLeft ?? 0;
      const updatedTime = roomData.timerUpdated ?? Date.now();

      if (running) {
        const elapsed = Math.floor((Date.now() - updatedTime) / 1000);
        const currentLeft = Math.max(0, baseSeconds - elapsed);
        setLocalClientTimerSeconds(currentLeft);

        const interval = setInterval(() => {
          const tElapsed = Math.floor((Date.now() - updatedTime) / 1000);
          const tLeft = Math.max(0, baseSeconds - tElapsed);
          setLocalClientTimerSeconds(tLeft);
          if (tLeft === 0) {
            clearInterval(interval);
          }
        }, 300);
        return () => clearInterval(interval);
      } else {
        setLocalClientTimerSeconds(baseSeconds);
      }
    }
  }, [roomData?.type, roomData?.timerTimeLeft, roomData?.timerRunning, roomData?.timerUpdated]);
  
  const [sessionHistory, setSessionHistory] = useState<HistoryItem[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<any>(null);

  useEffect(() => {
    if (roomCode) {
      const raw = safeStorage.getItem(`syncboard_history_${roomCode}`);
      if (raw) {
        try {
          setSessionHistory(JSON.parse(raw));
        } catch (e) {
          setSessionHistory([]);
        }
      } else {
        setSessionHistory([]);
      }
    }
  }, [roomCode]);

  const addToHistory = (type: 'text' | 'image', content: string, imageData: string | null) => {
    if (type === 'text' && !content.trim()) return;
    if (type === 'image' && !imageData) return;
    
    setSessionHistory(prev => {
      if (prev.length > 0) {
        const last = prev[0];
        if (last.type === type) {
          if (type === 'text' && last.content === content) return prev;
          if (type === 'image' && last.imageData === imageData) return prev;
        }
      }
      
      const newItem: HistoryItem = {
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type,
        content,
        imageData,
        savedAt: Date.now()
      };
      
      const nextList = [newItem, ...prev.filter(item => {
        if (item.type !== type) return true;
        if (type === 'text') return item.content !== content;
        return item.imageData !== imageData;
      })].slice(0, 5);
      
      safeStorage.setItem(`syncboard_history_${roomCode}`, JSON.stringify(nextList));
      return nextList;
    });
  };

  const recallHistoryItem = (item: HistoryItem) => {
    setStatus('syncing');
    
    // Maintain formatting metadata of recalled item or clear to item defaults
    updateCloud({ 
      type: item.type, 
      content: item.content, 
      imageData: item.imageData 
    })
      .then(() => {
        setStatus('idle');
        if (item.type === 'text') {
          setText(item.content);
        } else {
          setText('');
        }
      })
      .catch(() => setStatus('error'));
  };

  useEffect(() => {
    if (step === 'remote' && roomCode) {
      const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', `room_${roomCode}`);
      return onSnapshot(roomRef, (snapshot) => {
        if (snapshot.exists()) {
          const fetched = snapshot.data() as RoomData;
          setRoomData(fetched);
          if (fetched.type === 'text' && fetched.content !== text) {
            setText(fetched.content);
          }
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `artifacts/${appId}/public/data/rooms/room_${roomCode}`);
      });
    }
  }, [step, roomCode]);

  useEffect(() => {
    if (initialRoom && step === 'connecting') {
      const autoConnect = async () => {
        try {
          const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', `room_${initialRoom}`);
          const snap = await getDoc(roomRef);
          if (snap.exists()) { 
            setStep('remote'); 
          } else { 
            setErrorMsg("房间已过期 / Bilik tamat tempoh"); 
            setStep('join'); 
          }
        } catch (e) { 
          setStep('join'); 
          try {
            handleFirestoreError(e, OperationType.GET, `artifacts/${appId}/public/data/rooms/room_${initialRoom}`);
          } catch (_) {}
        }
      };
      autoConnect();
    }
  }, [initialRoom]);

  const connect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (roomCode.length !== 4) return;
    setStatus('syncing');
    setErrorMsg('');
    try {
      const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', `room_${roomCode}`);
      const snap = await getDoc(roomRef);
      if (snap.exists()) { 
        setStep('remote'); 
        setStatus('idle'); 
      } else { 
        setErrorMsg("房号不存在，请重新核对输入"); 
        setStatus('idle'); 
      }
    } catch (e) { 
      setErrorMsg("网络波动，请检查您的手机连接"); 
      setStatus('idle'); 
      try {
        handleFirestoreError(e, OperationType.GET, `artifacts/${appId}/public/data/rooms/room_${roomCode}`);
      } catch (_) {}
    }
  };

  const updateCloud = async (payload: Partial<RoomData>) => {
    try {
      const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', `room_${roomCode}`);
      await updateDoc(roomRef, { ...payload, lastActive: serverTimestamp() });
    } catch (err) {
      console.error("Failed to update document: ", err);
      setStatus('error');
      try {
        handleFirestoreError(err, OperationType.UPDATE, `artifacts/${appId}/public/data/rooms/room_${roomCode}`);
      } catch (_) {}
    }
  };

  const handleSpeak = async () => {
    if (!text.trim()) return;
    setStatus('syncing');
    try {
      await updateCloud({ 
        type: 'text', 
        content: text, 
        imageData: null, 
        speakTrigger: Date.now() 
      });
      setStatus('idle');
      try {
        if (navigator.vibrate) navigator.vibrate(50);
      } catch (e) {}
    } catch (e) {
      setStatus('error');
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    setStatus('syncing');
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      updateCloud({ type: 'text', content: val, imageData: null })
        .then(() => {
          setStatus('idle');
          addToHistory('text', val, null);
        })
        .catch(() => setStatus('error'));
    }, 450);
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('syncing');
    try {
      const base64 = await compressImage(file);
      await updateCloud({ type: 'image', imageData: base64, content: '' });
      setText(''); 
      setStatus('idle');
      addToHistory('image', '', base64);
      try {
        if (navigator.vibrate) navigator.vibrate(50);
      } catch (e) {
        // Safe catch for iframe / sandbox security policy restrictions
      }
    } catch (err) { 
      setStatus('error'); 
    }
  };

  if (step === 'join') {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center relative font-sans">
        <button 
          onClick={onBack} 
          className="absolute top-6 left-6 text-slate-500 hover:text-slate-800 font-bold flex items-center gap-1.5 cursor-pointer bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm text-sm"
        >
          ← 返回 / Landing
        </button>
        <div className="w-full max-w-sm bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-150">
          <div className="text-center space-y-3 mb-8">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
              <Smartphone className="w-6 h-6 animate-pulse" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">同步至大屏</h2>
            <h3 className="text-sm font-bold text-blue-600 uppercase tracking-widest mt-0.5">Segerak ke Skrin</h3>
            <p className="text-slate-400 text-xs leading-relaxed">请输入大屏上显示的 4 位数房间提取码，建立安全流式连接。</p>
          </div>
          <form onSubmit={connect} className="space-y-6">
            <input 
              type="tel" 
              maxLength={4} 
              autoFocus
              className="w-full text-center text-5xl font-mono font-black border-b-4 border-slate-200 focus:border-blue-600 outline-none pb-3 transition-colors text-slate-800 placeholder-slate-200 tracking-[0.25em]"
              value={roomCode}
              onChange={e => setRoomCode(e.target.value.replace(/\D/g, ''))}
              placeholder="0000"
            />
            {errorMsg && (
              <p className="text-rose-600 text-center font-bold text-xs bg-rose-50 border border-rose-100 p-2.5 rounded-xl flex items-center gap-1.5 justify-center">
                <AlertCircle size={14} className="shrink-0" />
                {errorMsg}
              </p>
            )}
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4.5 rounded-2xl font-bold text-base shadow-lg shadow-blue-100 transition-all active:scale-95 cursor-pointer">
              {status === 'syncing' ? 'Connecting...' : '开始同步 / Mula Segerak'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden font-sans">
      
      {/* Top Client Control Header */}
      <div className="bg-white px-6 py-4.5 shadow-sm flex justify-between items-center z-10 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shadow-inner">
            <Smartphone size={20} />
          </div>
          <div>
            <span className="font-extrabold text-slate-950 tracking-tight block text-sm leading-tight">SyncBoard Controller</span>
            <span className="text-[10px] font-mono text-blue-600 font-bold block mt-0.5">ROOM PIN: #{roomCode}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-full">
            <span className={`w-2 h-2 rounded-full ${status === 'syncing' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500 animate-pulse'}`} />
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{status === 'syncing' ? 'Syncing...' : 'Connected'}</span>
          </div>
          <button 
            onClick={() => { setStep('join'); setRoomCode(''); }} 
            className="text-xs font-bold text-slate-400 hover:text-red-500 border border-slate-200 hover:border-red-200 px-3 py-1.5 rounded-xl bg-white transition-colors cursor-pointer"
          >
            断开 / Quit
          </button>
        </div>
      </div>

      {/* Horizontal App Mode Selector */}
      <div className="bg-white px-4 py-2 border-b border-slate-200 flex gap-2 overflow-x-auto scrollbar-none shrink-0 no-scrollbar">
        {[
          { id: 'text', icon: <Type size={13} />, label: '实时投影 / Text' },
          { id: 'image', icon: <PenTool size={13} />, label: '白板手写 / Sketch' },
          { id: 'timer', icon: <TimerIcon size={13} />, label: '倒计时 / Timer' },
          { id: 'namePicker', icon: <UserCheck size={13} />, label: '幸运抽签 / Picker' }
        ].map(m => {
          const active = roomData?.type === m.id || (m.id === 'text' && roomData?.type === undefined);
          return (
            <button
              key={m.id}
              type="type"
              onClick={async () => {
                setStatus('syncing');
                const patch: Partial<RoomData> = { type: m.id as any };
                
                if (m.id === 'timer' && !roomData?.timerDuration) {
                  patch.timerDuration = 180;
                  patch.timerTimeLeft = 180;
                  patch.timerRunning = false;
                  patch.timerUpdated = Date.now();
                }
                if (m.id === 'namePicker' && roomData?.namesList === undefined) {
                  patch.namesList = "张三, 李四, 王五, 赵六, 孙七";
                  patch.pickedResult = null;
                  patch.isPickerRolling = false;
                }
                
                await updateCloud(patch);
                setStatus('idle');
                if (m.id === 'image') {
                  setInputMode('draw');
                } else {
                  setInputMode('text');
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all shrink-0 cursor-pointer border ${
                active 
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100/80' 
                  : 'bg-slate-50 text-slate-605 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {m.icon}
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 p-4 flex flex-col gap-4 overflow-hidden max-w-lg mx-auto w-full">
        
        {/* Style, Alignment and Formatting Toolbar */}
        <div className="flex flex-col bg-white p-3 rounded-2xl shadow-sm border border-slate-200/60 w-full gap-2 text-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] font-extrabold text-slate-400 tracking-wider uppercase">Align & Format</span>
              {inputMode === 'text' && (
                <button 
                  type="button"
                  onClick={handleSpeak}
                  disabled={!text.trim()}
                  className={`px-2.5 py-1 text-[10px] rounded-lg font-black tracking-tight transition-all flex items-center gap-1.5 cursor-pointer border ${
                    text.trim()
                      ? 'bg-blue-50 hover:bg-blue-100 text-blue-650 border-blue-200'
                      : 'bg-slate-50 text-slate-350 border-slate-100 cursor-not-allowed'
                  }`}
                  title="Click read text button on phone and host board will play the audio"
                >
                  <Volume2 size={11} className="shrink-0" />
                  <span>朗读文字 / SPEAK</span>
                </button>
              )}
            </div>
            <div className="flex gap-1">
              {/* Bold, Italic, Strikethrough */}
              <button 
                type="button"
                onClick={() => updateCloud({ bold: !roomData?.bold })}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  roomData?.bold 
                    ? 'bg-blue-600 text-white shadow shadow-blue-100' 
                    : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                }`}
                title="Bold"
              >
                <Bold size={15} />
              </button>
              <button 
                type="button"
                onClick={() => updateCloud({ italic: !roomData?.italic })}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  roomData?.italic 
                    ? 'bg-blue-600 text-white shadow shadow-blue-100' 
                    : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                }`}
                title="Italic"
              >
                <Italic size={15} />
              </button>
              <button 
                type="button"
                onClick={() => updateCloud({ strikethrough: !roomData?.strikethrough })}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  roomData?.strikethrough 
                    ? 'bg-blue-600 text-white shadow shadow-blue-100' 
                    : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                }`}
                title="Strikethrough"
              >
                <Strikethrough size={15} />
              </button>

              <div className="w-px h-6 bg-slate-200 mx-1 self-center" />

              {/* Alignments */}
              {[
                { id: 'left', icon: <AlignLeft size={15}/> },
                { id: 'center', icon: <AlignCenter size={15}/> },
                { id: 'right', icon: <AlignRight size={15}/> },
                { id: 'justify', icon: <AlignJustify size={15}/> }
              ].map(item => (
                <button 
                  key={item.id}
                  type="button"
                  onClick={() => updateCloud({ align: item.id })}
                  className={`p-2 rounded-xl transition-all cursor-pointer ${
                    roomData?.align === item.id 
                      ? 'bg-blue-600 text-white shadow shadow-blue-100' 
                      : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                  }`}
                  title={`Align: ${item.id}`}
                >
                  {item.icon}
                </button>
              ))}
            </div>
          </div>

          {/* New Font family & custom color presets controls */}
          {(roomData?.type === 'text' || roomData?.type === undefined) && (
            <>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-t border-slate-100 pt-2.5 mt-1 gap-2.5 text-xs">
                {/* Font selector dropdown */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 shrink-0 relative">
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase">Font / 字体:</span>
                  <select 
                    value={roomData?.fontFamily || 'sans'} 
                    onChange={e => updateCloud({ fontFamily: e.target.value as any })}
                    className="bg-transparent font-bold text-slate-700 outline-none text-xs cursor-pointer pr-1"
                  >
                    <option value="sans">Sans-serif / 默认</option>
                    <option value="serif">Elegant Serif / 宋体</option>
                    <option value="mono">Console Mono / 等宽</option>
                  </select>
                </div>

                {/* Color select palette and picker */}
                <div className="flex items-center gap-2 justify-between">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Palette size={13} className="text-slate-400" />
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase">Color:</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {['#0f172a', '#2563eb', '#16a34a', '#dc2626', '#9333ea', '#ea580c'].map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => updateCloud({ textColor: c })}
                        className={`w-5.5 h-5.5 rounded-full border cursor-pointer transition-all duration-100 ${
                          (roomData?.textColor || '#0f172a') === c 
                            ? 'border-slate-400 ring-2 ring-blue-100 scale-110 shadow-sm' 
                            : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: c }}
                        title={`Select color ${c}`}
                      />
                    ))}
                    {/* Native color picker with visual '+' */}
                    <div className="relative w-5.5 h-5.5 rounded-full border border-dashed border-slate-350 overflow-hidden bg-slate-50 flex items-center justify-center hover:scale-105 cursor-pointer">
                      <input 
                        type="color" 
                        value={roomData?.textColor || '#0f172a'}
                        onChange={e => updateCloud({ textColor: e.target.value })}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                        title="自定义颜色 / Custom"
                      />
                      <span className="text-[10px] font-black text-slate-400 pointer-events-none">+</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Font Size controls (slider & plus/minus precision modifiers) */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 mt-0.5 gap-3 text-xs">
                <div className="flex items-center gap-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-wide shrink-0">
                  <span>Size / 大小:</span>
                  <span className="font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-lg text-[10px]">{roomData?.fontSize || 48}px</span>
                </div>
                
                <div className="flex-1 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const currentSize = roomData?.fontSize || 48;
                      const nextSize = Math.max(16, currentSize - 4);
                      updateCloud({ fontSize: nextSize });
                    }}
                    className="p-1.5 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer shrink-0"
                    title="Decrease size"
                  >
                    <Minus size={13} />
                  </button>

                  <input 
                    type="range"
                    min={16}
                    max={112}
                    step={4}
                    value={roomData?.fontSize || 48}
                    onChange={e => updateCloud({ fontSize: parseInt(e.target.value) })}
                    className="flex-1 accent-blue-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer outline-none"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      const currentSize = roomData?.fontSize || 48;
                      const nextSize = Math.min(112, currentSize + 4);
                      updateCloud({ fontSize: nextSize });
                    }}
                    className="p-1.5 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer shrink-0"
                    title="Increase size"
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Session Recall Bar (Sleek Horizontal Clipboard) */}
        {sessionHistory.length > 0 && (
          <div className="flex flex-col gap-2 bg-white p-3 rounded-2xl border border-slate-200/60 shadow-sm w-full">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <History size={12} className="text-blue-500 animate-pulse" />
              历史投射记录 / Session History
            </span>
            <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
              {sessionHistory.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => recallHistoryItem(item)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 hover:border-blue-400 border border-slate-200 rounded-xl cursor-pointer transition-all shrink-0 max-w-[150px] text-left group"
                >
                  {item.type === 'image' ? (
                    <div className="w-6 h-6 bg-slate-200 rounded border border-slate-300 overflow-hidden flex items-center justify-center shrink-0">
                      <img src={item.imageData!} className="w-full h-full object-cover" alt="History" referrerPolicy="no-referrer" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 bg-blue-50 text-blue-600 rounded border border-blue-150 flex items-center justify-center shrink-0">
                      <Type size={11} />
                    </div>
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-bold text-slate-700 truncate block">
                      {item.type === 'text' ? item.content : '白板手写/贴图'}
                    </span>
                    <span className="text-[8px] text-slate-400 font-semibold-mono">
                      {new Date(item.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Panel Frame */}
        {roomData?.type === 'timer' ? (
          /* TIMER CONTROL INTERFACE */
          <div className="flex-1 flex flex-col gap-4 bg-white rounded-3xl border border-slate-200 shadow-md p-5 overflow-y-auto animate-fade-in text-slate-850">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-50 text-purple-650 rounded-xl">
                  <TimerIcon size={18} />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-800">计时管理端 / Timer Controller</h4>
                  <span className="text-[10px] text-slate-400 font-bold block">倒计时管理控制 / Countdown Control Terminal</span>
                </div>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold block ${roomData?.timerRunning ? "bg-emerald-50 text-emerald-600 animate-pulse" : "bg-slate-100 text-slate-500"}`}>
                {roomData?.timerRunning ? "运行中 / RUNNING" : "暂停中 / PAUSED"}
              </span>
            </div>

            {/* Big Digital Readout */}
            <div className="text-center py-6 bg-slate-50 rounded-2xl border border-slate-150 shadow-inner shrink-0">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">预计剩余时间 / Estimated Remaining</div>
              <div className="text-5xl font-mono font-black text-slate-700 mt-1 tabular-nums">
                {(() => {
                  const mins = Math.floor(localClientTimerSeconds / 60);
                  const secs = localClientTimerSeconds % 60;
                  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                })()}
              </div>
            </div>

            {/* Presets and custom settings */}
            <div className="space-y-3 shrink-0">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase block tracking-wider">快速选择时长 / Quick Duration Select</span>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: '1m', value: 60 },
                  { label: '3m', value: 180 },
                  { label: '5m', value: 300 },
                  { label: '10m', value: 600 }
                ].map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={async () => {
                      setStatus('syncing');
                      await updateCloud({
                        timerDuration: p.value,
                        timerTimeLeft: p.value,
                        timerRunning: false,
                        timerUpdated: Date.now()
                      });
                      setStatus('idle');
                    }}
                    className={`py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                      roomData?.timerDuration === p.value
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="flex justify-between items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    const left = Math.max(0, (roomData?.timerTimeLeft ?? 180) - 30);
                    updateCloud({ timerTimeLeft: left, timerUpdated: Date.now() });
                  }}
                  className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-705 font-bold text-xs rounded-xl flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Minus size={12} />
                  <span>30s</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const left = (roomData?.timerTimeLeft ?? 180) + 30;
                    const dur = (roomData?.timerDuration ?? 180) < left ? left : (roomData?.timerDuration ?? 180);
                    updateCloud({ timerTimeLeft: left, timerDuration: dur, timerUpdated: Date.now() });
                  }}
                  className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-750 font-bold text-xs rounded-xl flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus size={12} />
                  <span>30s</span>
                </button>
              </div>
            </div>

            {/* Primary action controls */}
            <div className="grid grid-cols-2 gap-3.5 pt-4 border-t border-slate-100 mt-auto shrink-0">
              <button
                type="button"
                onClick={async () => {
                  setStatus('syncing');
                  const running = roomData?.timerRunning || false;
                  let currentLeft = roomData?.timerTimeLeft ?? 180;
                  if (running) {
                    const elapsed = Math.floor((Date.now() - (roomData?.timerUpdated ?? Date.now())) / 1000);
                    currentLeft = Math.max(0, currentLeft - elapsed);
                  }
                  await updateCloud({
                    timerRunning: !running,
                    timerTimeLeft: currentLeft,
                    timerUpdated: Date.now()
                  });
                  setStatus('idle');
                }}
                className={`py-3 rounded-2xl flex items-center justify-center gap-2 font-black text-xs shadow cursor-pointer transition-transform active:scale-95 duration-100 ${
                  roomData?.timerRunning
                    ? 'bg-amber-500 text-white shadow-amber-100 hover:bg-amber-600'
                    : 'bg-purple-600 text-white shadow-purple-100 hover:bg-purple-755'
                }`}
              >
                {roomData?.timerRunning ? <Pause size={14} /> : <Play size={14} />}
                <span>{roomData?.timerRunning ? 'PAUSE / 暂停' : 'START / 开启'}</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  setStatus('syncing');
                  await updateCloud({
                    timerRunning: false,
                    timerTimeLeft: roomData?.timerDuration || 180,
                    timerUpdated: Date.now()
                  });
                  setStatus('idle');
                }}
                className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 rounded-2xl flex items-center justify-center gap-2 font-bold text-xs transition-transform active:scale-95 duration-100 cursor-pointer"
              >
                <RotateCcw size={14} />
                <span>RESET / 重置</span>
              </button>
            </div>
          </div>
        ) : roomData?.type === 'namePicker' ? (
          /* NAME PICKER CONTROL INTERFACE */
          <div className="flex-1 flex flex-col gap-4 bg-white rounded-3xl border border-slate-200 shadow-md p-5 overflow-y-auto animate-fade-in text-slate-850">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 text-amber-655 rounded-xl">
                  <UserCheck size={18} />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-800">幸运抽签控制端 / Random Name Picker</h4>
                  <span className="text-[10px] text-slate-400 font-bold block">随机选取名单管理 / Candidates Selector Dashboard</span>
                </div>
              </div>
            </div>

            {/* Candidate List input */}
            <div className="flex-1 flex flex-col gap-2 min-h-[140px]">
              <div className="flex justify-between items-center shrink-0">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase block tracking-wider">候选人名单 / Candidates List</span>
                <span className="text-[9px] font-mono text-slate-500 font-black bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-150">
                  {(roomData?.namesList || '').split(/[\n,;，；]+/).filter(Boolean).length} 位成员
                </span>
              </div>
              <textarea
                className="flex-1 w-full p-3 font-semibold text-xs bg-slate-50 border border-slate-200 focus:border-amber-400 focus:bg-white rounded-xl outline-none resize-none transition-all leading-relaxed text-slate-700 font-mono"
                placeholder="在此输入名字，用逗号或换行分隔。例：&#13;张三&#13;李四&#13;小红&#13;阿德南"
                value={roomData?.namesList || ''}
                onChange={e => updateCloud({ namesList: e.target.value })}
              />
            </div>

            {/* Picked Result Screen */}
            {roomData?.pickedResult && (
              <div className="bg-amber-50/55 border border-amber-200/60 p-3.5 rounded-2xl text-center shadow-inner animate-fade-in relative overflow-hidden shrink-0">
                <div className="text-[10px] font-extrabold text-amber-500 uppercase tracking-widest flex items-center justify-center gap-1.5 mb-1">
                  <Sparkles size={11} />
                  已抽取选中 / Picked Winner
                </div>
                <div className="text-lg font-black text-slate-800 tracking-tight select-all">
                  {roomData?.pickedResult}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3 pb-2 pt-2 border-t border-slate-150 shrink-0">
              <button
                type="button"
                onClick={async () => {
                  const names = (roomData?.namesList || '')
                    .split(/[\n,;，；]+/)
                    .map(n => n.trim())
                    .filter(n => n.length > 0);
                  if (names.length === 0) return;
                  
                  setStatus('syncing');
                  const randomName = names[Math.floor(Math.random() * names.length)];
                  
                  await updateCloud({
                    pickerRollTrigger: Date.now(),
                    pickedResult: randomName
                  });
                  setStatus('idle');
                }}
                disabled={!(roomData?.namesList || '').trim()}
                className={`py-3 rounded-2xl font-black text-xs shadow cursor-pointer transition-transform active:scale-95 duration-100 text-white flex items-center justify-center gap-1.5 ${
                  (roomData?.namesList || '').trim()
                    ? 'bg-amber-500 shadow-amber-100 hover:bg-amber-600'
                    : 'bg-slate-200 cursor-not-allowed shadow-none'
                }`}
              >
                <Sparkles size={14} />
                <span>🍀 随机抽取 / PICK</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  setStatus('syncing');
                  await updateCloud({ pickedResult: null });
                  setStatus('idle');
                }}
                className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-500 border border-slate-200 rounded-2xl font-bold text-center text-xs transition-transform active:scale-95 duration-100 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RotateCcw size={14} />
                <span>CLEAR / 复位</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 flex flex-col min-h-0 bg-white rounded-3xl border border-slate-250/50 shadow-md p-4">
              {inputMode === 'text' ? (
                <textarea 
                  className={`flex-1 w-full p-4 text-base focus:bg-slate-50/20 rounded-2xl outline-none resize-none transition-all ${
                    roomData?.align === 'center' ? 'text-center' : 
                    roomData?.align === 'right' ? 'text-right' : 
                    roomData?.align === 'justify' ? 'text-justify' : 'text-left'
                  } ${roomData?.bold ? 'font-black' : 'font-normal'} ${
                    roomData?.italic ? 'italic' : ''
                  } ${roomData?.strikethrough ? 'line-through' : ''}`}
                  placeholder="在这里输入想要同步的文字。大屏幕端将会以超低延迟与优雅的排版实时呈现..."
                  value={text}
                  onChange={handleTextChange}
                  style={{
                    color: roomData?.textColor || undefined,
                    fontFamily: roomData?.fontFamily === 'serif' ? 'font-serif' : roomData?.fontFamily === 'mono' ? 'font-mono' : 'font-sans'
                  }}
                />
              ) : (
                <div className="flex-1 bg-white rounded-2xl overflow-hidden border border-slate-100">
                   <DrawingCanvas 
                     onSend={dataUrl => {
                       updateCloud({ type: 'image', imageData: dataUrl, content: '' })
                         .then(() => {
                           setStatus('idle');
                           addToHistory('image', '', dataUrl);
                         });
                       setInputMode('text');
                       try {
                         if (navigator.vibrate) navigator.vibrate(50);
                       } catch (e) {
                         // Safe catch
                       }
                     }} 
                     updateCloud={updateCloud}
                   />
                </div>
              )}
            </div>

            {/* Bottom Toolbar Control Slots */}
            <div className="grid grid-cols-3 gap-3 mb-2">
              <button 
                type="button"
                onClick={() => setInputMode(inputMode === 'text' ? 'draw' : 'text')} 
                className={`py-4 rounded-2xl flex flex-col items-center justify-center gap-1.5 font-bold shadow-sm cursor-pointer transition-all ${
                  inputMode === 'draw' 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' 
                    : 'bg-white text-blue-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {inputMode === 'text' ? <PenTool size={22} /> : <Type size={22} />}
                <span className="text-[10px] tracking-wide font-extrabold">{inputMode === 'text' ? '白板手写 / Sketch' : '文字输入 / Keypad'}</span>
              </button>
              
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()} 
                className="py-4 bg-white text-emerald-600 border border-slate-250/70 rounded-2xl flex flex-col items-center justify-center gap-1.5 font-bold shadow-sm hover:bg-slate-50 active:bg-slate-50 transition-colors cursor-pointer"
              >
                <Camera size={22} />
                <span className="text-[10px] tracking-wide font-extrabold text-emerald-600">拍摄照片 / Snap</span>
              </button>
              
              <button 
                type="button"
                onClick={() => { setText(''); updateCloud({ type: 'text', content: '', imageData: null }); }} 
                className="py-4 bg-rose-50 text-rose-600 rounded-2xl flex flex-col items-center justify-center gap-1.5 font-bold hover:bg-rose-100 active:bg-rose-100 transition-colors cursor-pointer"
              >
                <Trash2 size={22} />
                <span className="text-[10px] tracking-wide font-extrabold">清空内容 / Clear</span>
              </button>
            </div>
          </>
        )}
        <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handlePhoto} />
      </div>
    </div>
  );
};

// --- Drawing Canvas Component ---
interface DrawingCanvasProps {
  onSend: (dataUrl: string) => void;
  updateCloud: (payload: Partial<RoomData>) => Promise<void>;
}

const DrawingCanvas: React.FC<DrawingCanvasProps> = ({ onSend, updateCloud }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState<boolean>(false);
  const [color, setColor] = useState<string>('#1e293b');
  
  // Custom tool configurations: draw strokes, stamp shapes, or laser pointer tracking
  const [tool, setTool] = useState<'draw' | 'stamp' | 'laser'>('draw');
  const [selectedStamp, setSelectedStamp] = useState<'arrow' | 'check' | 'star' | 'question' | 'heart'>('arrow');
  const [zoomFactor, setZoomFactor] = useState<number>(1);

  const [drawHistory, setDrawHistory] = useState<string[]>([]);
  const [drawRedoHistory, setDrawRedoHistory] = useState<string[]>([]);
  
  const colorRef = useRef<string>(color);
  
  useEffect(() => {
    colorRef.current = color;
  }, [color]);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || canvas.clientWidth || 350;
    const h = rect.height || canvas.clientHeight || 250;
    
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Save clear base state as starting point
    const baseState = canvas.toDataURL();
    setDrawHistory([baseState]);
  }, []);

  const saveState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const currentState = canvas.toDataURL();
    setDrawHistory(prev => [...prev, currentState]);
    setDrawRedoHistory([]);
  };

  const handleUndo = () => {
    if (drawHistory.length <= 1) return; // Keep at least the initial blank state
    
    const nextHistory = drawHistory.slice(0, drawHistory.length - 1);
    const poppedState = drawHistory[drawHistory.length - 1];
    
    setDrawHistory(nextHistory);
    setDrawRedoHistory(prev => [poppedState, ...prev]);
    
    const prevState = nextHistory[nextHistory.length - 1];
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    const img = new Image();
    img.src = prevState;
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width / dpr, canvas.height / dpr);
    };
  };

  const handleRedo = () => {
    if (drawRedoHistory.length === 0) return;
    
    const nextState = drawRedoHistory[0];
    const nextRedo = drawRedoHistory.slice(1);
    
    setDrawRedoHistory(nextRedo);
    setDrawHistory(prev => [...prev, nextState]);
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    const img = new Image();
    img.src = nextState;
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width / dpr, canvas.height / dpr);
    };
  };

  const handleReset = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    
    const baseState = canvas.toDataURL();
    setDrawHistory([baseState]);
    setDrawRedoHistory([]);
  };

  const drawStampOnCtx = (ctx: CanvasRenderingContext2D, char: string, px: number, py: number, colorStr: string) => {
    ctx.save();
    ctx.fillStyle = colorStr;
    ctx.font = '28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(char, px, py);
    ctx.restore();
  };

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, rawX: 0, rawY: 0, rectWidth: 1, rectHeight: 1 };
    const rect = canvas.getBoundingClientRect();
    
    const isTouch = 'touches' in e;
    const touch = isTouch && e.touches && e.touches.length > 0 ? e.touches[0] : null;
    
    // Fallback to changedTouches if touches is empty (e.g. on touchend / touchcancel)
    const changedTouch = isTouch && (!touch) && (e as TouchEvent).changedTouches && (e as TouchEvent).changedTouches.length > 0 
      ? (e as TouchEvent).changedTouches[0] 
      : null;
      
    const activeTouch = touch || changedTouch;
    const clientX = activeTouch ? activeTouch.clientX : (e as React.MouseEvent).clientX;
    const clientY = activeTouch ? activeTouch.clientY : (e as React.MouseEvent).clientY;
    
    const rawX = clientX - (rect?.left || 0);
    const rawY = clientY - (rect?.top || 0);
    const rectWidth = rect?.width || 1;
    const rectHeight = rect?.height || 1;

    // Normalizing coordinates back to logical sizes of the canvas (bulletproof coordinate scaling)
    const dpr = window.devicePixelRatio || 1;
    const canvasLogicalWidth = canvas.width / dpr;
    const canvasLogicalHeight = canvas.height / dpr;

    const x = (rawX / rectWidth) * canvasLogicalWidth;
    const y = (rawY / rectHeight) * canvasLogicalHeight;

    return { x, y, rawX, rawY, rectWidth, rectHeight };
  };

  const start = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (tool === 'laser') {
      const { rawX, rawY, rectWidth, rectHeight } = getPos(e);
      const xPct = Math.max(0, Math.min(100, (rawX / rectWidth) * 100));
      const yPct = Math.max(0, Math.min(100, (rawY / rectHeight) * 100));
      updateCloud({ 
        laserActive: true, 
        laserX: xPct,
        laserY: yPct
      });
      try {
        if (navigator.vibrate) navigator.vibrate(20);
      } catch (_) {}
      return;
    }

    if (tool === 'stamp') {
      const { x, y } = getPos(e);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const stampChar = selectedStamp === 'arrow' ? '➔' :
                        selectedStamp === 'check' ? '✔' :
                        selectedStamp === 'star' ? '★' :
                        selectedStamp === 'question' ? '❓' : '❤️';
      
      drawStampOnCtx(ctx, stampChar, x, y, colorRef.current);
      saveState();
      try {
        if (navigator.vibrate) navigator.vibrate(15);
      } catch (_) {}
      return;
    }

    setDrawing(true);
    const { x, y } = getPos(e);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = colorRef.current;
    ctx.beginPath(); 
    ctx.moveTo(x, y);
  };

  const move = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (tool === 'laser') {
      const { rawX, rawY, rectWidth, rectHeight } = getPos(e);
      const xPct = Math.max(0, Math.min(100, (rawX / rectWidth) * 100));
      const yPct = Math.max(0, Math.min(100, (rawY / rectHeight) * 100));
      updateCloud({ 
        laserActive: true, 
        laserX: xPct,
        laserY: yPct
      });
      try {
        if (navigator.vibrate && Math.random() < 0.25) {
          navigator.vibrate(10);
        }
      } catch (_) {}
      return;
    }

    if (!drawing) return;
    const { x, y } = getPos(e);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = colorRef.current;
    ctx.lineTo(x, y); 
    ctx.stroke();
  };

  const end = () => {
    if (tool === 'laser') {
      updateCloud({ laserActive: false });
      return;
    }

    if (drawing) {
      setDrawing(false);
      saveState();
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Sleek Toolbar for Tools, Stamps and Zoom */}
      <div className="flex flex-col gap-2 p-3 border-b bg-slate-50 border-slate-200">
        
        {/* Tool switches & Zoom slider */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Tool switches */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/30">
            {[
              { id: 'draw', label: '画笔 / Pen' },
              { id: 'stamp', label: '图章 / Stamp' },
              { id: 'laser', label: '激光笔 / Laser' }
            ].map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTool(t.id as any)}
                className={`px-3 py-1 text-[11px] font-bold rounded-lg cursor-pointer transition-all ${
                  tool === t.id 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Zoom Slider */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase">放大 / Zoom:</span>
            <input 
              type="range"
              min={1}
              max={2.5}
              step={0.1}
              value={zoomFactor}
              onChange={e => setZoomFactor(parseFloat(e.target.value))}
              className="w-20 cursor-pointer accent-blue-600 h-1 bg-slate-200 rounded-lg appearance-none"
            />
            <span className="text-[10px] font-mono font-bold text-slate-500 w-10 text-right">{Math.round(zoomFactor * 100)}%</span>
          </div>
        </div>

        {/* Dynamic options when tools match */}
        <div className="flex items-center justify-between mt-1 border-t border-slate-200/40 pt-2 gap-4">
          
          {/* Left Side options helper */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase shrink-0">颜色 / Colors:</span>
            <div className="flex gap-1.5 shrink-0">
              {['#1e293b', '#ef4444', '#3b82f6', '#10b981', '#f59e0b'].map(c => (
                <button 
                  key={c} 
                  onClick={() => setColor(c)} 
                  type="button"
                  className={`w-6 h-6 rounded-full border cursor-pointer transition-all ${
                    color === c ? 'border-slate-500 ring-2 ring-blue-500/10' : 'border-slate-200/60 shadow-sm'
                  }`} 
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Right Side context widgets */}
          {tool === 'stamp' && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase shrink-0">图章 / STAMPS:</span>
              <div className="flex gap-1 bg-white p-0.5 rounded-lg border border-slate-250 shrink-0">
                {[
                  { id: 'arrow', label: '➔' },
                  { id: 'check', label: '✔' },
                  { id: 'star', label: '★' },
                  { id: 'question', label: '❓' },
                  { id: 'heart', label: '❤️' }
                ].map(st => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setSelectedStamp(st.id as any)}
                    className={`w-6.5 h-6.5 text-xs rounded-md font-bold flex items-center justify-center transition-all cursor-pointer ${
                      selectedStamp === st.id 
                        ? 'bg-blue-50 text-blue-650 font-black border border-blue-250 shadow-sm' 
                        : 'text-slate-450 hover:bg-slate-50'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tool === 'laser' && (
            <div className="text-[10px] text-rose-500 font-extrabold flex items-center gap-1.5 animate-pulse shrink-0">
              <span className="w-1.5 h-1.5 bg-rose-500 rounded-full"></span>
              LASER TRACK ENGAGED
            </div>
          )}
        </div>
      </div>

      {/* Scrollable, Zoomable Canvas Section */}
      <div className="flex-grow w-full overflow-auto bg-slate-50 flex items-center justify-center relative p-1 shadow-inner h-0">
        <div 
          className="transition-transform duration-200 origin-center bg-white border border-slate-150 rounded-xl overflow-hidden relative w-full h-full"
          style={{ transform: `scale(${zoomFactor})` }}
        >
          <canvas 
            ref={canvasRef} 
            onMouseDown={start} 
            onMouseMove={move} 
            onMouseUp={end} 
            onMouseLeave={end}
            onTouchStart={start} 
            onTouchMove={move} 
            onTouchEnd={end} 
            className="w-full h-full touch-none cursor-crosshair absolute inset-0" 
          />
        </div>
      </div>

      <div className="p-3 bg-white border-t flex flex-col gap-3 shrink-0">
        {/* Undo and Redo controls stacked on top */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleUndo}
            disabled={drawHistory.length <= 1}
            className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-1.5 font-bold text-xs border transition-colors ${
              drawHistory.length > 1 
                ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 cursor-pointer shadow-sm' 
                : 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
            }`}
          >
            <RotateCcw size={14} />
            撤销 / Undo
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={drawRedoHistory.length === 0}
            className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-1.5 font-bold text-xs border transition-colors ${
              drawRedoHistory.length > 0 
                ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 cursor-pointer shadow-sm' 
                : 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
            }`}
          >
            <RotateCw size={14} />
            重做 / Redo
          </button>
        </div>
        
        <div className="flex gap-2.5">
          <button 
            onClick={handleReset}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-slate-650 transition-colors cursor-pointer text-xs uppercase"
            type="button"
          >
            重写 / Reset
          </button>
          <button 
            onClick={() => {
              const canvas = canvasRef.current;
              if (!canvas) return;
              const temp = document.createElement('canvas');
              temp.width = canvas.width; 
              temp.height = canvas.height;
              const tCtx = temp.getContext('2d');
              if (!tCtx) return;
              tCtx.fillStyle = '#ffffff'; 
              tCtx.fillRect(0, 0, temp.width, temp.height);
              tCtx.drawImage(canvas, 0, 0);
              onSend(temp.toDataURL('image/jpeg', 0.7));
            }} 
            className="flex-[2] py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-100 transition-all cursor-pointer text-xs uppercase"
            type="button"
          >
            确认投屏 / Push Board
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
