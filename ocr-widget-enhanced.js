import React, { useState, useEffect, useRef } from 'react';
import { Camera, Mic, HelpCircle, X, Check, Loader, ChevronRight } from 'lucide-react';

// Demo Component - Shows the complete widget in action
export default function OCRWidgetDemo() {
  const [formData, setFormData] = useState({
    item: '',
    quantity: '',
    description: '',
    location: ''
  });
  
  const [widgetState, setWidgetState] = useState({
    isOpen: false,
    isScanning: false,
    isListening: false,
    mappings: [],
    showToast: false,
    toastMessage: '',
    toastType: 'info'
  });

  // Simulate OCR scan
  const handleScan = () => {
    setWidgetState(prev => ({ ...prev, isScanning: true }));
    
    setTimeout(() => {
      const mockMappings = [
        { field: 'item', value: 'Wardrobe', confidence: 0.95, checked: true },
        { field: 'quantity', value: '1', confidence: 0.90, checked: true },
        { field: 'description', value: 'Oak wood, large', confidence: 0.85, checked: true },
        { field: 'location', value: 'Master bedroom', confidence: 0.92, checked: true }
      ];
      
      setWidgetState(prev => ({
        ...prev,
        isScanning: false,
        mappings: mockMappings,
        isOpen: true
      }));
      
      showToast('Found 4 matches! Review and apply.', 'success');
    }, 2000);
  };

  // Simulate voice input
  const handleVoice = () => {
    setWidgetState(prev => ({ ...prev, isListening: true }));
    
    setTimeout(() => {
      const mockMappings = [
        { field: 'item', value: 'Chair', confidence: 0.88, checked: true },
        { field: 'quantity', value: '2', confidence: 0.85, checked: true },
        { field: 'description', value: 'Blue fabric dining chairs', confidence: 0.80, checked: true },
        { field: 'location', value: 'Dining room', confidence: 0.87, checked: true }
      ];
      
      setWidgetState(prev => ({
        ...prev,
        isListening: false,
        mappings: mockMappings,
        isOpen: true
      }));
      
      showToast('Voice captured! Review matches.', 'success');
    }, 3000);
  };

  // Apply mappings to form
  const handleApply = () => {
    const newFormData = { ...formData };
    widgetState.mappings
      .filter(m => m.checked)
      .forEach(m => {
        newFormData[m.field] = m.value;
      });
    
    setFormData(newFormData);
    setWidgetState(prev => ({ ...prev, isOpen: false, mappings: [] }));
    showToast('Applied to form!', 'success');
  };

  // Show toast notification
  const showToast = (message, type = 'info') => {
    setWidgetState(prev => ({
      ...prev,
      showToast: true,
      toastMessage: message,
      toastType: type
    }));
    
    setTimeout(() => {
      setWidgetState(prev => ({ ...prev, showToast: false }));
    }, 3000);
  };

  // Toggle mapping checkbox
  const toggleMapping = (index) => {
    setWidgetState(prev => ({
      ...prev,
      mappings: prev.mappings.map((m, i) => 
        i === index ? { ...m, checked: !m.checked } : m
      )
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-800 rounded-full text-xs font-semibold mb-4">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          AppyCrew OCR Widget v10 - Enhanced
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
          Smart Form Filling Demo
        </h1>
        <p className="text-slate-600">
          Click the camera or microphone to auto-fill this inventory form
        </p>
      </div>

      {/* Demo Form */}
      <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 border border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900 mb-6">
            Inventory Item Form
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Item
              </label>
              <select
                value={formData.item}
                onChange={(e) => setFormData({ ...formData, item: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              >
                <option value="">Select item...</option>
                <option value="Chair">Chair</option>
                <option value="Table">Table</option>
                <option value="Wardrobe">Wardrobe</option>
                <option value="Sofa">Sofa</option>
                <option value="Box">Box</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Quantity
              </label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                placeholder="0"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Colour, condition, notes..."
                rows={3}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Location
              </label>
              <select
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              >
                <option value="">Select location...</option>
                <option value="Living room">Living room</option>
                <option value="Master bedroom">Master bedroom</option>
                <option value="Kitchen">Kitchen</option>
                <option value="Dining room">Dining room</option>
                <option value="Garage">Garage</option>
              </select>
            </div>
          </div>
        </div>

        {/* Instructions Panel */}
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl shadow-lg p-6 md:p-8 text-white">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <HelpCircle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-semibold">How It Works</h2>
          </div>

          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 font-semibold">
                1
              </div>
              <div>
                <h3 className="font-semibold mb-1">Scan a Photo</h3>
                <p className="text-white/80 text-sm">
                  Click the camera button and take a photo of your inventory sheet or item label
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 font-semibold">
                2
              </div>
              <div>
                <h3 className="font-semibold mb-1">Or Use Voice</h3>
                <p className="text-white/80 text-sm">
                  Click the microphone and say: "2 blue chairs, dining room"
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 font-semibold">
                3
              </div>
              <div>
                <h3 className="font-semibold mb-1">Review & Apply</h3>
                <p className="text-white/80 text-sm">
                  Check the suggested matches and click Apply to fill the form instantly
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-white/10 rounded-xl backdrop-blur-sm">
            <div className="flex items-center gap-2 text-sm">
              <span>💡</span>
              <span className="text-white/90">
                Keyboard shortcut: <kbd className="px-2 py-0.5 bg-white/20 rounded">Ctrl+Shift+S</kbd>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Speed Dial FAB */}
      <SpeedDialFAB
        onScan={handleScan}
        onVoice={handleVoice}
        isScanning={widgetState.isScanning}
        isListening={widgetState.isListening}
      />

      {/* Review Panel */}
      {widgetState.isOpen && (
        <ReviewPanel
          mappings={widgetState.mappings}
          onClose={() => setWidgetState(prev => ({ ...prev, isOpen: false }))}
          onApply={handleApply}
          onToggle={toggleMapping}
        />
      )}

      {/* Toast Notification */}
      {widgetState.showToast && (
        <Toast
          message={widgetState.toastMessage}
          type={widgetState.toastType}
        />
      )}
    </div>
  );
}

// Speed Dial Floating Action Button
function SpeedDialFAB({ onScan, onVoice, isScanning, isListening }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Speed Dial Container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {/* Action Buttons */}
        <div className={`flex flex-col items-end gap-3 transition-all duration-300 ${
          isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
        }`}>
          {/* Voice Button */}
          <button
            onClick={() => {
              setIsOpen(false);
              onVoice();
            }}
            disabled={isListening}
            className="group relative"
          >
            <div className="w-12 h-12 bg-pink-500 hover:bg-pink-600 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95">
              {isListening ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Mic className="w-5 h-5 text-white" />
              )}
            </div>
            <span className="absolute right-14 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900 text-white text-sm rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              Voice Input
            </span>
          </button>

          {/* Scan Button */}
          <button
            onClick={() => {
              setIsOpen(false);
              onScan();
            }}
            disabled={isScanning}
            className="group relative"
          >
            <div className="w-12 h-12 bg-indigo-600 hover:bg-indigo-700 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95">
              {isScanning ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Camera className="w-5 h-5 text-white" />
              )}
            </div>
            <span className="absolute right-14 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900 text-white text-sm rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              Scan Photo
            </span>
          </button>

          {/* Help Button */}
          <button
            onClick={() => setIsOpen(false)}
            className="group relative"
          >
            <div className="w-12 h-12 bg-amber-500 hover:bg-amber-600 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95">
              <HelpCircle className="w-5 h-5 text-white" />
            </div>
            <span className="absolute right-14 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900 text-white text-sm rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              Help & Tips
            </span>
          </button>
        </div>

        {/* Main FAB */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${
            isScanning ? 'bg-indigo-600 animate-pulse' :
            isListening ? 'bg-pink-500 animate-pulse' :
            'bg-slate-900 hover:bg-slate-800'
          }`}
        >
          {isScanning || isListening ? (
            <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <div className={`transition-transform duration-300 ${isOpen ? 'rotate-45' : 'rotate-0'}`}>
              {isOpen ? (
                <X className="w-6 h-6 text-white" />
              ) : (
                <Camera className="w-6 h-6 text-white" />
              )}
            </div>
          )}
        </button>

        {/* Label */}
        {!isOpen && !isScanning && !isListening && (
          <div className="absolute -top-12 right-0 px-4 py-2 bg-slate-900 text-white text-sm rounded-lg shadow-lg whitespace-nowrap animate-bounce">
            Click to scan
            <div className="absolute -bottom-1 right-4 w-2 h-2 bg-slate-900 rotate-45" />
          </div>
        )}
      </div>
    </>
  );
}

// Review Panel
function ReviewPanel({ mappings, onClose, onApply, onToggle }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-slideUp">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Review Matches</h3>
            <p className="text-slate-300 text-sm">Check accuracy before applying</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Mappings List */}
        <div className="p-6 max-h-96 overflow-y-auto">
          <div className="space-y-3">
            {mappings.map((mapping, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-indigo-300 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={mapping.checked}
                  onChange={() => onToggle(index)}
                  className="mt-1 w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-900 text-sm capitalize">
                      {mapping.field}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${
                        mapping.confidence > 0.9 ? 'bg-green-500' :
                        mapping.confidence > 0.8 ? 'bg-yellow-500' : 'bg-orange-500'
                      }`} />
                      <span className={`text-xs font-medium ${
                        mapping.confidence > 0.9 ? 'text-green-700' :
                        mapping.confidence > 0.8 ? 'text-yellow-700' : 'text-orange-700'
                      }`}>
                        {Math.round(mapping.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                  <p className="text-slate-700 break-words">
                    {mapping.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onApply}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            Apply to Form
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Toast Notification
function Toast({ message, type = 'info' }) {
  const icons = {
    success: <Check className="w-5 h-5" />,
    error: <X className="w-5 h-5" />,
    info: <HelpCircle className="w-5 h-5" />,
    loading: <Loader className="w-5 h-5 animate-spin" />
  };

  const colors = {
    success: 'bg-green-50 border-green-500 text-green-900',
    error: 'bg-red-50 border-red-500 text-red-900',
    info: 'bg-blue-50 border-blue-500 text-blue-900',
    loading: 'bg-indigo-50 border-indigo-500 text-indigo-900'
  };

  return (
    <div className="fixed top-6 right-6 z-[60] animate-slideIn">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border-l-4 ${colors[type]} max-w-sm`}>
        <div className="flex-shrink-0">
          {icons[type]}
        </div>
        <p className="text-sm font-medium">
          {message}
        </p>
      </div>
    </div>
  );
}

// Add animations to Tailwind
const style = document.createElement('style');
style.textContent = `
  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(100%);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(100%);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .animate-slideUp {
    animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .animate-slideIn {
    animation: slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
`;
document.head.appendChild(style);
