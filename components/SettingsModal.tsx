import React, { useState, useEffect } from 'react';

interface SettingsModalProps {
  onClose: () => void;
  isDarkMode: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, isDarkMode }) => {
  // Mock State for settings
  const [sheetFolder, setSheetFolder] = useState('');
  const [scansFolder, setScansFolder] = useState('');
  const accountName = "demo.user@gmail.com"; // Mock connected account

  useEffect(() => {
    // Load settings from local storage
    const storedSheet = localStorage.getItem('recost_sheet_folder');
    const storedScans = localStorage.getItem('recost_scans_folder');
    if (storedSheet) setSheetFolder(storedSheet);
    if (storedScans) setScansFolder(storedScans);
  }, []);

  const handleSave = () => {
    localStorage.setItem('recost_sheet_folder', sheetFolder);
    localStorage.setItem('recost_scans_folder', scansFolder);
    onClose();
  };

  // Styles reused to match PropertyManager
  const overlayClass = isDarkMode ? 'bg-black/60' : 'bg-gray-500/30';
  const modalClass = isDarkMode 
    ? "bg-[#1C1C1E]/90 border border-gray-700/50 text-white shadow-2xl shadow-black/50" 
    : "bg-white/90 border border-white/50 text-gray-900 shadow-2xl shadow-blue-900/10";
  
  const inputTransparent = isDarkMode
    ? "w-full bg-transparent text-right text-white focus:outline-none placeholder-gray-600 font-medium"
    : "w-full bg-transparent text-right text-gray-900 focus:outline-none placeholder-gray-400 font-medium";

  const labelClass = isDarkMode
    ? "text-gray-400 font-medium text-sm whitespace-nowrap mr-4"
    : "text-gray-500 font-medium text-sm whitespace-nowrap mr-4";

  const listGroupContainer = isDarkMode
    ? "bg-[#2C2C2E] rounded-2xl overflow-hidden border border-gray-800"
    : "bg-gray-50 rounded-2xl overflow-hidden border border-gray-200 shadow-inner";
      
  const listGroupItem = isDarkMode
    ? "flex items-center justify-between p-4 border-b border-gray-800 last:border-0"
    : "flex items-center justify-between p-4 border-b border-gray-200 last:border-0";

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

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scroll space-y-8">
            
            {/* Account Section */}
            <div className="space-y-3">
                <h4 className={`text-xs font-bold uppercase tracking-wider ml-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    Połączone Konto
                </h4>
                <div className={`flex items-center p-4 rounded-2xl border ${isDarkMode ? 'bg-[#2C2C2E] border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                        {accountName.charAt(0).toUpperCase()}
                    </div>
                    <div className="ml-4 flex-1">
                        <div className={`font-semibold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Google Account</div>
                        <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{accountName}</div>
                    </div>
                    <div className="flex items-center text-green-500 text-xs font-bold px-2 py-1 bg-green-500/10 rounded-full">
                        <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
                        Połączono
                    </div>
                </div>
            </div>

            {/* Drive Configuration Section */}
            <div className="space-y-3">
                <h4 className={`text-xs font-bold uppercase tracking-wider ml-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    Konfiguracja Dysku Google
                </h4>
                <div className={listGroupContainer}>
                    <div className={listGroupItem}>
                        <label className={labelClass}>Folder Arkusza</label>
                        <input 
                            type="text" 
                            placeholder="/RECOST/Data"
                            value={sheetFolder}
                            onChange={(e) => setSheetFolder(e.target.value)}
                            className={inputTransparent}
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
                        />
                    </div>
                </div>
                <p className={`text-[10px] px-2 leading-relaxed ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    Wskazane ścieżki zostaną użyte do utworzenia struktury folderów na Twoim Dysku Google.
                </p>
            </div>

            {/* Save Button */}
            <div className="pt-4">
                <button 
                    onClick={handleSave}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-xl font-bold hover:shadow-lg hover:shadow-blue-500/30 transition-all transform hover:-translate-y-0.5 active:scale-95"
                >
                    Zapisz Ustawienia
                </button>
            </div>

        </div>
      </div>
    </div>
  );
};