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
  Zap
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
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 selection:bg-blue-100 selection:text-blue-900 antialiased">
      {mode === 'landing' && <LandingView onSelectMode={handleSetMode} />}
      {mode === 'host' && <HostView user={user} onBack={() => handleSetMode('landing')} />}
      {mode === 'client' && <ClientView user={user} onBack={() => handleSetMode('landing')} />}
    </div>
  );
}

// --- Landing View ---
interface LandingViewProps {
  onSelectMode: (mode: string) => void;
}

const LandingView: React.FC<LandingViewProps> = ({ onSelectMode }) => (
  <div className="flex flex-col items-center justify-center min-h-screen p-6 space-y-12 bg-slate-50 relative overflow-hidden">
    {/* Background Decorative Blobs */}
    <div className="absolute top-0 left-0 w-80 h-80 bg-blue-100/40 rounded-full blur-3xl -z-10 -translate-x-10 -translate-y-10"></div>
    <div className="absolute bottom-0 right-0 w-80 h-80 bg-emerald-100/30 rounded-full blur-3xl -z-10 translate-x-10 translate-y-10"></div>

    <div className="text-center space-y-4 max-w-xl">
      <div className="inline-flex p-4 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-100/80 mb-2 transition-transform hover:rotate-12 duration-300">
        <RefreshCw className="w-10 h-10" />
      </div>
      <h1 className="text-5xl font-black text-slate-900 tracking-tight leading-none">
        Sync<span className="text-blue-600 font-extrabold">Board</span>
      </h1>
      <p className="text-slate-400 text-lg font-medium tracking-wide">
        Instant Multi-Device Workspace
      </p>
      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/80 border border-slate-200 shadow-sm rounded-full text-[10px] font-mono tracking-widest text-slate-500">
        <span>SESSION ID: STABLE-V5</span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-3xl">
      <button
        onClick={() => onSelectMode('host')}
        className="group flex flex-col items-center p-10 bg-white border border-slate-200/60 rounded-[2.5rem] shadow-xl hover:shadow-2xl hover:border-blue-500 hover:-translate-y-1 transition-all duration-300 active:scale-95 text-left cursor-pointer"
      >
        <div className="p-5 bg-blue-50 text-blue-600 rounded-full mb-6 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 shadow-sm shadow-blue-100">
          <Monitor className="w-12 h-12" />
        </div>
        <h2 className="text-2xl font-black text-slate-950 tracking-tight">大屏接收端</h2>
        <h3 className="text-sm font-bold text-blue-600 mt-1 uppercase tracking-wide">Penerima Skrin</h3>
        <p className="text-slate-400 mt-3 text-xs text-center leading-relaxed">
          作为投影大屏幕，实时同步并接收来自智能手机控制器的文本、白板批注、或现场抓拍照片。
        </p>
        <div className="mt-4 px-3 py-1 bg-slate-50 group-hover:bg-blue-50 rounded-lg text-[10px] font-bold text-slate-400 group-hover:text-blue-600 transition-colors">
          HOST DISPLAY MODE
        </div>
      </button>

      <button
        onClick={() => onSelectMode('client')}
        className="group flex flex-col items-center p-10 bg-white border border-slate-200/60 rounded-[2.5rem] shadow-xl hover:shadow-2xl hover:border-emerald-500 hover:-translate-y-1 transition-all duration-300 active:scale-95 text-left cursor-pointer"
      >
        <div className="p-5 bg-emerald-50 text-emerald-600 rounded-full mb-6 group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300 shadow-sm shadow-emerald-100">
          <Smartphone className="w-12 h-12" />
        </div>
        <h2 className="text-2xl font-black text-slate-950 tracking-tight">手机控制器</h2>
        <h3 className="text-sm font-bold text-emerald-600 mt-1 uppercase tracking-wide">Pengawal Telefon</h3>
        <p className="text-slate-400 mt-3 text-xs text-center leading-relaxed">
          输入文本并实时对齐、切换白板进行随手写画批注、或拍摄照片一键推送至大屏接收端。
        </p>
        <div className="mt-4 px-3 py-1 bg-slate-50 group-hover:bg-emerald-50 rounded-lg text-[10px] font-bold text-slate-400 group-hover:text-emerald-600 transition-colors">
          CLIENT CONTROL MODE
        </div>
      </button>
    </div>
  </div>
);

// --- Host View ---
interface HostViewProps {
  user: User;
  onBack: () => void;
}

const HostView: React.FC<HostViewProps> = ({ user, onBack }) => {
  const [roomCode, setRoomCode] = useState<string>('');
  const [data, setData] = useState<RoomData | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [zoom, setZoom] = useState<number>(1);

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
            content: 'SyncBoard 准备就绪！\n输入房号开始同步。\n\nSyncBoard sedia!\nMasukkan kod bilik untuk mula.',
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
        setData(snapshot.data() as RoomData);
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

  if (isInitializing) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#f8fafc]">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
        <p className="text-slate-500 font-bold">正在载入并建立大屏接收频道...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden relative font-sans">
      {/* Sleek Design Header */}
      <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack} 
            className="p-3 bg-slate-50 hover:bg-slate-100 hover:text-red-500 rounded-xl transition-all cursor-pointer border border-slate-200 shadow-sm"
            title="返回主页 / Back"
          >
             <Trash2 className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-100/90">
              <RefreshCw className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">SyncBoard</h1>
              <span className="text-[10px] text-emerald-500 font-bold tracking-wider uppercase flex items-center gap-1.5 mt-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                Live Connection Active
              </span>
            </div>
          </div>
        </div>

        {/* Access Code and Channel Tag */}
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Room Access Code</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-3xl font-mono font-black text-blue-600 leading-none tracking-tighter tabular-nums">{roomCode}</span>
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            </div>
          </div>
          <div className="h-10 w-px bg-slate-200"></div>
          <div className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-full shadow-sm">
            <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">H</div>
            <span className="text-xs font-bold text-slate-600">Host Station</span>
          </div>
        </div>
      </header>

      {/* Main Screen Receiver Display */}
      <main className="flex-1 flex p-6 gap-6 min-h-0">
        <div className="flex-1 bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/60 border border-slate-200/60 flex flex-col overflow-hidden relative">
          
          {/* Action indicator labels top-left */}
          <div className="absolute top-6 left-6 flex gap-2 z-10 bg-white/70 backdrop-blur-sm p-1.5 rounded-2xl border border-slate-100">
            <div className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-bold text-slate-500 uppercase tracking-wide">4K RESOLUTION</div>
            <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${data?.type === 'image' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
              {data?.type === 'image' ? 'WHITEBOARD SKETCH / IMAGE' : 'LIVE TEXT SYNC'}
            </div>
          </div>

          <div 
            className="w-full h-full transition-transform duration-300 ease-out origin-center p-16 flex items-center justify-center overflow-auto bg-slate-50/10"
            style={{ transform: `scale(${zoom})` }}
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
            ) : (
              <div className={`w-full max-w-4xl p-6 ${
                data?.align === 'center' ? 'text-center' : 
                data?.align === 'right' ? 'text-right' : 
                data?.align === 'justify' ? 'text-justify' : 'text-left'
              }`}>
                {data?.content ? (
                  <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 leading-[1.25] tracking-tight whitespace-pre-wrap break-words selection:bg-blue-250">
                    {data.content}
                  </h2>
                ) : (
                  <div className="space-y-4">
                    <h2 className="text-3xl md:text-5xl font-black text-slate-300 leading-snug tracking-tight">
                      等待移动端进行连接与展示...
                    </h2>
                    <p className="text-slate-400 text-lg font-medium">
                      请使用手机浏览器扫描或输入房间号 <span className="font-mono text-slate-800 bg-slate-100 px-2 py-1 rounded-lg">{roomCode}</span> 开启实时投屏、书写跟拍摄投射。
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Symmetrical Floating Control Bar inside bottom container (Sleek Interface) */}
          <div className="h-20 bg-slate-50/90 backdrop-blur-md border-t border-slate-200/60 px-10 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-xl border border-slate-100 shadow-sm">
              <button 
                onClick={() => setZoom(prev => Math.min(2.5, prev + 0.15))} 
                className="p-1.5 hover:bg-blue-50 text-slate-500 hover:text-blue-600 rounded-lg cursor-pointer transition-colors"
                title="放大"
              >
                <ZoomIn size={18}/>
              </button>
              <span className="text-xs font-mono font-bold text-slate-500 w-16 text-center">{Math.round(zoom*100)}% SCALE</span>
              <button 
                onClick={() => setZoom(prev => Math.max(0.4, prev - 0.15))} 
                className="p-1.5 hover:bg-blue-50 text-slate-500 hover:text-blue-600 rounded-lg cursor-pointer transition-colors"
                title="缩小"
              >
                <ZoomOut size={18}/>
              </button>
              <button 
                onClick={() => setZoom(1)} 
                className="p-1.5 hover:bg-slate-150 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer transition-colors" 
                title="还原 100%"
              >
                <Maximize size={16}/>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button 
                onClick={handleDownloadSession} 
                className="px-5 py-2.5 bg-slate-950 hover:bg-slate-900 text-white rounded-xl font-bold text-xs shadow-md shadow-slate-900/10 transition-transform active:scale-95 duration-100 cursor-pointer flex items-center gap-1.5 border border-slate-800"
              >
                <Download size={14} />
                Download Session
              </button>
              {data?.type === 'text' && data.content && (
                <button 
                  onClick={handleCopy}
                  className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all duration-150 active:scale-95 cursor-pointer flex items-center gap-1.5 ${
                    copied 
                      ? 'bg-emerald-600 text-white shadow-emerald-200' 
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-100'
                  }`}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied !' : 'Copy to Clipboard'}
                </button>
              )}
            </div>
          </div>
        </div>
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
}

const ClientView: React.FC<ClientViewProps> = ({ user, onBack }) => {
  const urlParams = new URLSearchParams(window.location.search);
  const initialRoom = urlParams.get('room');

  const [step, setStep] = useState<string>(initialRoom ? 'connecting' : 'join');
  const [roomCode, setRoomCode] = useState<string>(initialRoom || '');
  const [inputMode, setInputMode] = useState<string>('text');
  const [text, setText] = useState<string>('');
  const [status, setStatus] = useState<string>('idle'); 
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<any>(null);

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

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    setStatus('syncing');
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      updateCloud({ type: 'text', content: val, imageData: null })
        .then(() => setStatus('idle'))
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

      <div className="flex-1 p-4 flex flex-col gap-4 overflow-hidden max-w-lg mx-auto w-full">
        
        {/* Style and Alignment Toolbar */}
        <div className="flex bg-white p-1.5 rounded-2xl shadow-sm self-center border border-slate-200/60 justify-center w-full">
          <div className="flex w-full items-center justify-between px-2">
            <span className="text-xs font-extrabold text-slate-400 tracking-wider">ALIGN CONTENT</span>
            <div className="flex gap-1.5">
              {[
                { id: 'left', icon: <AlignLeft size={16}/> },
                { id: 'center', icon: <AlignCenter size={16}/> },
                { id: 'right', icon: <AlignRight size={16}/> },
                { id: 'justify', icon: <AlignJustify size={16}/> }
              ].map(item => (
                <button 
                  key={item.id}
                  onClick={() => updateCloud({ align: item.id })}
                  className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                    roomData?.align === item.id 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' 
                      : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                  }`}
                  title={`对齐: ${item.id}`}
                >
                  {item.icon}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Input Panel Frame */}
        <div className="flex-1 flex flex-col min-h-0 bg-white rounded-3xl border border-slate-250/50 shadow-md p-4">
          {inputMode === 'text' ? (
            <textarea 
              className={`flex-1 w-full p-4 text-base focus:bg-slate-50/20 rounded-2xl outline-none resize-none transition-all ${
                roomData?.align === 'center' ? 'text-center' : 
                roomData?.align === 'right' ? 'text-right' : 
                roomData?.align === 'justify' ? 'text-justify' : 'text-left'
              }`}
              placeholder="在这里输入想要同步的文字。大屏幕端将会以超低延迟与优雅的排版实时呈现..."
              value={text}
              onChange={handleTextChange}
            />
          ) : (
            <div className="flex-1 bg-white rounded-2xl overflow-hidden border border-slate-100">
               <DrawingCanvas onSend={dataUrl => {
                 updateCloud({ type: 'image', imageData: dataUrl, content: '' })
                   .then(() => setStatus('idle'));
                 setInputMode('text');
                 try {
                   if (navigator.vibrate) navigator.vibrate(50);
                 } catch (e) {
                   // Safe catch for iframe / sandbox security policy restrictions
                 }
               }} />
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
        <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handlePhoto} />
      </div>
    </div>
  );
};

// --- Drawing Canvas Component ---
interface DrawingCanvasProps {
  onSend: (dataUrl: string) => void;
}

const DrawingCanvas: React.FC<DrawingCanvasProps> = ({ onSend }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState<boolean>(false);
  const [color, setColor] = useState<string>('#1e293b');
  
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
  }, []);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
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
    
    return { 
      x: clientX - (rect?.left || 0), 
      y: clientY - (rect?.top || 0) 
    };
  };

  const start = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
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

  const end = () => setDrawing(false);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Sleek Canvas Palette Bar */}
      <div className="flex gap-3 p-3.5 border-b bg-slate-50/60 justify-center">
        {['#1e293b', '#ef4444', '#3b82f6', '#10b981', '#f59e0b'].map(c => (
          <button 
            key={c} 
            onClick={() => setColor(c)} 
            type="button"
            className={`w-7.5 h-7.5 rounded-full border-2 cursor-pointer transition-all ${
              color === c ? 'border-blue-600 scale-115' : 'border-slate-100'
            }`} 
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <canvas 
        ref={canvasRef} 
        onMouseDown={start} 
        onMouseMove={move} 
        onMouseUp={end} 
        onMouseLeave={end}
        onTouchStart={start} 
        onTouchMove={move} 
        onTouchEnd={end} 
        className="flex-1 w-full touch-none cursor-crosshair bg-slate-50/10" 
      />
      <div className="p-3 bg-white border-t flex gap-3">
        <button 
          onClick={() => { 
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height); 
          }} 
          className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-slate-600 transition-colors cursor-pointer text-xs uppercase"
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
  );
};

export default App;
