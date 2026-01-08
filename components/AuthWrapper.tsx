import React, { useEffect, useState } from 'react';
import netlifyIdentity from 'netlify-identity-widget';
import { LogIn, LogOut, User, ShieldAlert } from 'lucide-react';

// VOEG HIER DE TOEGESTANE E-MAILADRESSEN TOE
const ALLOWED_EMAILS = [
  'edwin@editsolutions.nl',
  'winski123@hotmail.com'
];

interface AuthWrapperProps {
  children: React.ReactNode;
}

const AuthWrapper: React.FC<AuthWrapperProps> = ({ children }) => {
  const [user, setUser] = useState<netlifyIdentity.User | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Initialize Netlify Identity
    netlifyIdentity.init({
      locale: 'nl', // Set language to Dutch
      APIUrl: 'https://videoforgemax.netlify.app/.netlify/identity' // Direct link for local testing
    });

    const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

    const checkAndExtendSession = () => {
      const currentUser = netlifyIdentity.currentUser();
      const expiry = localStorage.getItem('vf_session_expiry');
      const now = Date.now();

      if (currentUser) {
        if (expiry && now > parseInt(expiry)) {
          // Sessie is verlopen
          netlifyIdentity.logout();
          setUser(null);
          localStorage.removeItem('vf_session_expiry');
        } else {
          // Sessie is nog geldig, verleng met een maand vanaf nu
          localStorage.setItem('vf_session_expiry', (now + ONE_MONTH_MS).toString());
          setUser(currentUser);
        }
      } else {
        setUser(null);
        localStorage.removeItem('vf_session_expiry');
      }
      setIsInitialized(true);
    };

    checkAndExtendSession();

    // Event listeners for login and logout
    netlifyIdentity.on('login', (user) => {
      localStorage.setItem('vf_session_expiry', (Date.now() + ONE_MONTH_MS).toString());
      setUser(user);
      netlifyIdentity.close();
    });

    netlifyIdentity.on('logout', () => {
      localStorage.removeItem('vf_session_expiry');
      setUser(null);
    });

    return () => {
      netlifyIdentity.off('login');
      netlifyIdentity.off('logout');
    };
  }, []);

  const handleLogin = () => {
    netlifyIdentity.open();
  };

  const handleLogout = () => {
    netlifyIdentity.logout();
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  // Check of de gebruiker is ingelogd én of het e-mailadres in de lijst staat
  const isAllowed = user && user.email && ALLOWED_EMAILS.includes(user.email);

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-3xl p-8 shadow-2xl flex flex-col items-center gap-6">
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/20">
            <User size={40} className="text-white" />
          </div>
          
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-white">VideoForge</h1>
            <p className="text-slate-400">Log in om toegang te krijgen tot de video tools.</p>
          </div>

          <button
            onClick={handleLogin}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-semibold flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg shadow-indigo-500/20"
          >
            <LogIn size={20} />
            Inloggen / Registreren
          </button>
          
          <p className="text-xs text-slate-500 text-center">
            Alleen geautoriseerde gebruikers hebben toegang.
          </p>
        </div>
      </div>
    );
  }

  // Als wel ingelogd, maar niet op de lijst
  if (!isAllowed) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md bg-slate-800/50 backdrop-blur-xl border border-red-500/30 rounded-3xl p-8 shadow-2xl flex flex-col items-center gap-6">
          <div className="w-20 h-20 bg-red-500/10 rounded-2xl flex items-center justify-center border border-red-500/50">
            <ShieldAlert size={40} className="text-red-500" />
          </div>
          
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Geen Toegang</h1>
            <p className="text-slate-400">Het e-mailadres <strong>{user.email}</strong> is niet geautoriseerd voor deze applicatie.</p>
          </div>

          <button
            onClick={handleLogout}
            className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-all"
          >
            <LogOut size={18} />
            Met ander account inloggen
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed top-4 right-4 z-[60]">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-full text-sm font-medium transition-all backdrop-blur-sm border border-slate-700 shadow-lg"
          title="Uitloggen"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">Uitloggen</span>
        </button>
      </div>
      {children}
    </>
  );
};

export default AuthWrapper;
