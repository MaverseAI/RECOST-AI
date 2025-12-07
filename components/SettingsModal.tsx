import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { authService } from '../services/authService';

interface SettingsModalProps {
  onClose: () => void;
  isDarkMode: boolean;
  currentUser: User;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, isDarkMode, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'users'>('general');
  const [sheetFolder, setSheetFolder] = useState('');
  const [scansFolder, setScansFolder] = useState('');
  
  // User Management State
  const [subUsers, setSubUsers] = useState<User[]>([]);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');

  const isAdmin = currentUser.role === 'ADMIN';

  useEffect(() => {
    // Load Global Settings
    const storedSheet = localStorage.getItem('recost_global_sheet_folder');
    const storedScans = localStorage.getItem('recost_global_scans_folder');
    if (storedSheet) setSheetFolder(storedSheet);
    if (storedScans) setScansFolder(storedScans);

    // Load users if admin
    if (isAdmin) {
      setSubUsers(authService.getSubUsers());
    }
  }, [isAdmin]);

  const handleSaveSettings = () => {
    if (!isAdmin) return;
    localStorage.setItem('recost_global_sheet_folder', sheetFolder);
    localStorage.setItem('recost_global_scans_folder', scansFolder);
    onClose();
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (newUserEmail && newUserName) {
      const newUser = authService.createSubUser(newUserEmail, newUserName);
      setSubUsers([...subUsers, newUser]);
      setNewUserEmail('');
      setNewUserName('');
    }
  };

  const handleRemoveUser = (id: string) => {
    authService.removeSubUser(id);
    setSubUsers(subUsers.filter(u => u.id !== id));
  };

  // Styles
  const overlayClass = isDarkMode ? 'bg-black/60' : 'bg-gray-500/30';
  const modalClass = isDarkMode 
    ? "bg-[#1C1C1E]/90 border border-gray-700/50 text-white shadow-2xl shadow-black/50" 
    : "bg-white/90 border border-white/50 text-gray-900 shadow-2xl shadow-blue-900/10";
  
  const inputTransparent = isDarkMode
    ? "w-full bg-transparent text-right text-white focus:outline-none placeholder-gray-600 font-medium disabled:text-gray-500 disabled:cursor-not-allowed"
    : "w-full bg-transparent text-right text-gray-900 focus:outline-none placeholder-gray-400 font-medium disabled:text-gray-400 disabled:cursor-not-allowed";
    
  const inputFormClass = isDarkMode
    ? "w-full px-4 py-3 bg-[#2C2C2E] border-none text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-500"
    : "w-full px-4 py-3 bg-gray-50 border-none text-gray-900 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-400";

  const labelClass = isDarkMode
    ? "text-gray-400 font-medium text-sm whitespace-nowrap mr-4"
    : "text-gray-500 font-medium text-sm whitespace-nowrap mr-4";

  const listGroupContainer = isDarkMode
    ? "bg-[#2C2C2E] rounded-2xl overflow-hidden border border-gray-800"
    : "bg-gray-50 rounded-2xl overflow-hidden border border-gray-200 shadow-inner";
      
  const listGroupItem = isDarkMode
    ? "flex items-center justify-between p-4 border-b border-gray-800 last:border-0"
    : "flex items-center justify-between p-4 border-b border-gray-200 last:border-0";

  // Tab Button Style
  const tabBtnClass = (active: boolean) => `flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
    active 
      ? (isDarkMode ? "bg-[#3A3A3C] text-white shadow-md" : "bg-white text-gray-900 shadow-sm") 
      : (isDarkMode ? "text-gray-400 hover:text-gray-200" : "text-gray-500 hover:text-gray-900")
  }`;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 backdrop-blur-md transition-all duration-300 ${overlayClass}`}>
      <div className={`w-full max-w-lg flex flex-col max-h-[90vh] glass-panel rounded-3xl overflow-hidden animate-fade-in-up ${modalClass}`}>
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-500/10">
          <h3 className="font-bold text-xl tracking-tight">Ustawienia</h3>
          <button onClick={onClose} className={`p-2 rounded-full transition-colors ${isDarkMode ? "hover:bg-white/10 text-gray-400" : "hover:bg-black/5 text-gray-500"}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Tabs (Only if Admin) */}
        {isAdmin && (
           <div className="px-6 pt-4 pb-2">
              <div className={`flex p-1 rounded-xl ${isDarkMode ? "bg-[#2C2C2E]" : "bg-gray-100"}`}>
                 <button onClick={() => setActiveTab('general')} className={tabBtnClass(activeTab === 'general')}>Ogólne</button>
                 <button onClick={() => setActiveTab('users')} className={tabBtnClass(activeTab === 'users')}>Użytkownicy</button>
              </div>
           </div>
        )}

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scroll space-y-8 flex-1">
            
            {activeTab === 'general' ? (
                <>
                {/* Account Section */}
                <div className="space-y-3">
                    <h4 className={`text-xs font-bold uppercase tracking-wider ml-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        Zalogowano jako
                    </h4>
                    <div className={`flex items-center p-4 rounded-2xl border ${isDarkMode ? 'bg-[#2C2C2E] border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md uppercase">
                            {currentUser.email.charAt(0)}
                        </div>
                        <div className="ml-4 flex-1">
                            <div className={`font-semibold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{currentUser.name || 'Użytkownik'}</div>
                            <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{currentUser.email}</div>
                        </div>
                        <div className={`text-xs font-bold px-2 py-1 rounded-full ${isAdmin ? 'bg-purple-500/10 text-purple-500' : 'bg-blue-500/10 text-blue-500'}`}>
                            {isAdmin ? 'ADMIN' : 'USER'}
                        </div>
                    </div>
                </div>

                {/* Drive Configuration Section */}
                <div className="space-y-3">
                    <h4 className={`text-xs font-bold uppercase tracking-wider ml-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        Konfiguracja Dysku Google
                    </h4>
                    {!isAdmin && (
                        <div className={`p-3 rounded-xl text-xs mb-2 ${isDarkMode ? 'bg-yellow-500/10 text-yellow-500' : 'bg-yellow-50 text-yellow-700'}`}>
                            Tylko administrator może edytować ścieżki zapisu.
                        </div>
                    )}
                    <div className={listGroupContainer}>
                        <div className={listGroupItem}>
                            <label className={labelClass}>Folder Arkusza</label>
                            <input 
                                type="text" 
                                placeholder="/RECOST/Data"
                                value={sheetFolder}
                                onChange={(e) => setSheetFolder(e.target.value)}
                                className={inputTransparent}
                                disabled={!isAdmin}
                            />
                        </div>
                        <div className={listGroupItem}>
                            <label className={labelClass}>Folder Dokumentów</label>
                            <input 
                                type="text" 
                                placeholder="/RECOST/Scans"
                                value={scansFolder}
                                onChange={(e) => setScansFolder(e.target.value)}
                                className={inputTransparent}
                                disabled={!isAdmin}
                            />
                        </div>
                    </div>
                    {isAdmin && (
                        <p className={`text-[10px] px-2 leading-relaxed ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                            Te ustawienia będą stosowane dla wszystkich użytkowników aplikacji.
                        </p>
                    )}
                </div>

                {/* Save Button (Admin Only) */}
                {isAdmin && (
                    <div className="pt-4">
                        <button 
                            onClick={handleSaveSettings}
                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-xl font-bold hover:shadow-lg hover:shadow-blue-500/30 transition-all transform hover:-translate-y-0.5 active:scale-95"
                        >
                            Zapisz Ustawienia
                        </button>
                    </div>
                )}
                </>
            ) : (
                <div className="space-y-6 animate-fade-in-up">
                    <div className={`p-4 rounded-xl text-sm ${isDarkMode ? 'bg-blue-500/10 text-blue-200' : 'bg-blue-50 text-blue-700'}`}>
                        Dodaj użytkowników, którzy będą mogli korzystać z aplikacji używając Twoich ustawień chmury.
                    </div>
                    
                    {/* Add User Form */}
                    <form onSubmit={handleAddUser} className="space-y-3">
                         <input 
                            type="text" 
                            placeholder="Imię i Nazwisko"
                            className={inputFormClass}
                            value={newUserName}
                            onChange={(e) => setNewUserName(e.target.value)}
                            required
                         />
                         <input 
                            type="email" 
                            placeholder="Adres Email"
                            className={inputFormClass}
                            value={newUserEmail}
                            onChange={(e) => setNewUserEmail(e.target.value)}
                            required
                         />
                         <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors">
                            Dodaj Użytkownika
                         </button>
                    </form>

                    <div className="pt-4 border-t border-gray-500/10">
                        <h4 className={`text-xs font-bold uppercase tracking-wider mb-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                            Lista Użytkowników
                        </h4>
                        {subUsers.length === 0 ? (
                            <p className={`text-center py-4 text-sm ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>Brak dodatkowych użytkowników</p>
                        ) : (
                            <div className="space-y-3">
                                {subUsers.map(user => (
                                    <div key={user.id} className={`flex items-center justify-between p-3 rounded-xl border ${isDarkMode ? 'bg-[#2C2C2E] border-gray-700' : 'bg-white border-gray-200'}`}>
                                        <div>
                                            <div className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{user.name}</div>
                                            <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{user.email}</div>
                                        </div>
                                        <button 
                                            onClick={() => handleRemoveUser(user.id)}
                                            className="text-red-500 hover:text-red-600 p-2"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

        </div>
      </div>
    </div>
  );
};