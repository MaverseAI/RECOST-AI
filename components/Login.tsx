import React, { useState } from 'react';
import { authService } from '../services/authService';
import { User } from '../types';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
  isDarkMode: boolean;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess, isDarkMode }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      // For demo: type 'admin@recost.ai' for Admin, anything else assumes User check
      const user = await authService.login(email);
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Błąd logowania');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const user = await authService.loginWithGoogle();
      onLoginSuccess(user);
    } catch (err) {
      setError('Nie udało się zalogować przez Google');
    } finally {
      setIsLoading(false);
    }
  };

  // Styles
  const cardClass = isDarkMode
    ? "bg-[#1C1C1E]/80 border border-white/5 shadow-2xl"
    : "bg-white/80 border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)]";
    
  const inputClass = isDarkMode
    ? "w-full px-4 py-4 bg-[#2C2C2E] border-none text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-500 transition-all"
    : "w-full px-4 py-4 bg-gray-50 border-none text-gray-900 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none placeholder-gray-400 transition-all shadow-inner";

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 animate-fade-in-up">
      {/* Logo Section */}
      <div className="mb-10 text-center">
        <div className={`w-20 h-20 mx-auto rounded-2xl flex items-center justify-center shadow-lg overflow-hidden transition-transform duration-500 bg-white border border-gray-100`}>
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-12 h-12">
            <defs>
                <linearGradient id="logoGradientLog" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                <stop stopColor="#3b82f6" />
                <stop offset="1" stopColor="#8b5cf6" />
                </linearGradient>
            </defs>
            <path d="M10 10H14M10 10V14M30 10H26M30 10V14M10 30H14M10 30V26M30 30H26M30 30V26" stroke="url(#logoGradientLog)" strokeWidth="3" strokeLinecap="round" />
            <path d="M15 26V20C15 19.4477 15.4477 19 16 19H19V26M21 26V15C21 14.4477 21.4477 14 22 14H25V26" fill="url(#logoGradientLog)" fillOpacity="0.8" />
            </svg>
        </div>
        <h1 className={`text-3xl font-extrabold mt-6 tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            RECOST AI
        </h1>
        <p className={`text-sm font-medium mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Zaloguj się, aby kontynuować
        </p>
      </div>

      {/* Login Card */}
      <div className={`w-full max-w-md backdrop-blur-md rounded-3xl p-8 ${cardClass}`}>
        
        <form onSubmit={handleEmailLogin} className="space-y-6">
            <div>
                <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ml-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Adres Email
                </label>
                <input 
                    type="email" 
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={inputClass}
                />
            </div>

            {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-medium text-center">
                    {error}
                </div>
            )}

            <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-xl font-bold hover:shadow-lg hover:shadow-blue-500/30 transition-all transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isLoading ? 'Logowanie...' : 'Zaloguj przez Email'}
            </button>
        </form>

        <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
                <div className={`w-full border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}></div>
            </div>
            <div className="relative flex justify-center text-sm">
                <span className={`px-4 font-medium ${isDarkMode ? 'bg-[#1C1C1E] text-gray-500' : 'bg-white text-gray-400'}`}>lub</span>
            </div>
        </div>

        <button 
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className={`w-full flex items-center justify-center py-4 rounded-xl font-bold transition-all transform hover:-translate-y-0.5 active:scale-95 border ${isDarkMode ? 'bg-white text-gray-900 hover:bg-gray-100 border-transparent' : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-200 shadow-sm'}`}
        >
            <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Zaloguj przez Google
        </button>

        <div className="mt-8 text-center">
            <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                Domyślny admin: <span className="font-mono">admin@recost.ai</span>
            </p>
        </div>
      </div>
    </div>
  );
};