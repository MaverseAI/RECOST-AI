import React, { useState } from 'react';
import { Property } from '../types';

interface PropertyManagerProps {
  properties: Property[];
  onSave: (property: Property) => void;
  onClose: () => void;
  isDarkMode: boolean;
  initialTab?: 'add' | 'list';
}

export const PropertyManager: React.FC<PropertyManagerProps> = ({ 
  properties, 
  onSave, 
  onClose, 
  isDarkMode,
  initialTab = 'list'
}) => {
  const [activeTab, setActiveTab] = useState<'add' | 'list'>(initialTab);
  const [newAddress, setNewAddress] = useState('');
  const [showArchive, setShowArchive] = useState(false);

  const activeProperties = properties.filter(p => !p.isArchived);
  const archivedProperties = properties.filter(p => p.isArchived);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddress) return;

    const newProp: Property = {
      id: Date.now().toString(),
      name: newAddress,
      address: newAddress,
      isArchived: false,
    };
    onSave(newProp);
    setNewAddress('');
    // Close modal immediately after adding, allowing App.tsx to select the new property
    onClose();
  };

  const toggleArchive = (prop: Property) => {
    onSave({ ...prop, isArchived: !prop.isArchived });
  };

  // Styles
  const overlayClass = isDarkMode ? 'bg-black/60' : 'bg-gray-500/30';
  const modalClass = isDarkMode 
    ? "bg-slate-800/70 border border-white/10 text-white shadow-[0_4px_30px_rgba(0,0,0,0.5)] backdrop-blur-[20px]" 
    : "bg-white/85 border border-white/50 text-[#1d1d1f] shadow-[0_4px_30px_rgba(0,0,0,0.05)] backdrop-blur-[20px]";
  
  const inputClass = isDarkMode
    ? "w-full px-4 py-4 bg-slate-800 border-none text-white rounded-xl focus:ring-2 focus:ring-[#5e13f6] outline-none placeholder-slate-500 transition-all"
    : "w-full px-4 py-4 bg-gray-50 border-none text-[#1d1d1f] rounded-xl focus:ring-2 focus:ring-[#5e13f6] focus:bg-white outline-none placeholder-gray-400 transition-all shadow-inner";

  const btnPrimaryClass = "w-full bg-gradient-to-r from-[#5e13f6] to-[#8b5cf6] text-white py-4 rounded-xl font-bold hover:shadow-lg hover:shadow-[#5e13f6]/30 transition-all transform hover:-translate-y-0.5 active:scale-95";

  // iOS Segmented Control Style
  const tabContainerClass = isDarkMode ? "bg-slate-800 p-1 rounded-lg" : "bg-gray-100 p-1 rounded-lg";
  const tabBtnClass = (active: boolean) => `flex-1 py-1.5 text-sm font-medium rounded-md transition-all duration-300 ${
    active 
      ? (isDarkMode ? "bg-[#5e13f6] text-white shadow-lg" : "bg-white text-[#1d1d1f] shadow-sm") 
      : (isDarkMode ? "text-slate-400 hover:text-gray-200" : "text-[#86868b] hover:text-[#1d1d1f]")
  }`;

  const renderPropertyList = (list: Property[], isArchiveView: boolean) => (
    <div className="space-y-3 animate-fade-in-up">
      {list.length === 0 && (
        <p className={`text-center py-8 ${isDarkMode ? 'text-slate-600' : 'text-[#86868b]'}`}>
          {isArchiveView ? 'Brak zarchiwizowanych adresów.' : 'Brak aktywnych nieruchomości.'}
        </p>
      )}
      {list.map((prop) => (
        <div key={prop.id} className={`group flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 hover:scale-[1.01] ${
          isDarkMode 
            ? `border-white/5 ${prop.isArchived ? 'bg-transparent opacity-50' : 'bg-slate-800 hover:bg-slate-700'}`
            : `border-transparent shadow-sm hover:shadow-md ${prop.isArchived ? 'bg-gray-50 opacity-60' : 'bg-white shadow-gray-200/50'}`
        }`}>
          <div className="flex-1 pr-4">
            <div className={`font-semibold text-sm ${isDarkMode ? 'text-white' : 'text-[#1d1d1f]'}`}>{prop.address}</div>
          </div>
          <button
            onClick={() => toggleArchive(prop)}
            className={`text-xs px-4 py-2 font-semibold rounded-lg transition-all ${
              isDarkMode
                ? (prop.isArchived ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white')
                : (prop.isArchived ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-[#86868b] hover:bg-gray-200 hover:text-[#1d1d1f]')
            }`}
          >
            {prop.isArchived ? 'Przywróć' : 'Archiwizuj'}
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 backdrop-blur-md transition-all duration-300 ${overlayClass}`}>
      <div className={`w-full max-w-lg flex flex-col max-h-[90vh] rounded-3xl overflow-hidden animate-fade-in-up ${modalClass}`}>
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-500/10">
          <h3 className="font-bold text-xl tracking-tight">Zarządzanie Nieruchomościami</h3>
          <button onClick={onClose} className={`p-2 rounded-full transition-colors ${isDarkMode ? "hover:bg-white/10 text-slate-400" : "hover:bg-black/5 text-[#86868b]"}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4 pb-2">
           <div className={`flex ${tabContainerClass}`}>
              <button onClick={() => { setActiveTab('list'); setShowArchive(false); }} className={tabBtnClass(activeTab === 'list')}>
                Lista adresów
              </button>
              <button onClick={() => setActiveTab('add')} className={tabBtnClass(activeTab === 'add')}>
                Dodaj nowy
              </button>
           </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scroll flex-1">
          {activeTab === 'add' ? (
            <form onSubmit={handleAdd} className="space-y-6 animate-fade-in-up">
              <div className={`p-4 rounded-xl text-sm leading-relaxed ${isDarkMode ? 'bg-blue-500/10 text-blue-200 border border-blue-500/20' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
                Wpisz pełny adres nieruchomości. System automatycznie utworzy dedykowany folder na Dysku Google.
              </div>
              <div>
                <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ml-1 ${isDarkMode ? 'text-slate-400' : 'text-[#86868b]'}`}>Adres Nieruchomości</label>
                <input
                  type="text"
                  required
                  placeholder="np. ul. Marszałkowska 1/5, Warszawa"
                  className={inputClass}
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  autoFocus
                />
              </div>
              <button type="submit" className={btnPrimaryClass}>
                Dodaj Adres
              </button>
            </form>
          ) : (
            <div className="flex flex-col h-full">
              {showArchive ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                     <h4 className={`text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-[#86868b]'}`}>Archiwum</h4>
                     <button 
                       onClick={() => setShowArchive(false)}
                       className={`text-xs font-bold ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-[#5e13f6] hover:text-[#4c0cd0]'}`}
                     >
                       Wróć do aktywnych
                     </button>
                  </div>
                  {renderPropertyList(archivedProperties, true)}
                </>
              ) : (
                <>
                  {renderPropertyList(activeProperties, false)}
                  
                  <div className="mt-8 pt-4 border-t border-gray-500/10 text-center">
                    <button 
                      onClick={() => setShowArchive(true)}
                      className={`text-sm font-medium transition-colors ${isDarkMode ? 'text-slate-500 hover:text-gray-300' : 'text-[#86868b] hover:text-[#1d1d1f]'}`}
                    >
                      Pokaż archiwum ({archivedProperties.length})
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};