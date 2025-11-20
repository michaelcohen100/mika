import React, { useState, useEffect } from 'react';
import { AppState, GenerationMode, GeneratedImage, EntityProfile } from '../types';
import { generateBrandVisual, suggestPrompts } from '../services/geminiService';
import { Button } from './Button';
import { Promptor } from './Promptor';
import { Sparkles, User, Package, Users, Download, ThumbsUp, ThumbsDown, CheckCircle2, Circle } from 'lucide-react';

interface DashboardProps {
  appState: AppState;
  onImageGenerated: (img: GeneratedImage) => void;
  onFeedback: (id: string, type: 'like' | 'dislike') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ appState, onImageGenerated, onFeedback }) => {
  const [mode, setMode] = useState<GenerationMode>(GenerationMode.COMBINED);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Multi-select state for products
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(
    appState.products.length > 0 ? [appState.products[0].id] : []
  );
  
  const [showPromptor, setShowPromptor] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const user = appState.user;
  
  // Get full product objects
  const selectedProducts = appState.products.filter(p => selectedProductIds.includes(p.id));
  const primaryProduct = selectedProducts[0] || null;

  // Load suggestions when product selection changes
  useEffect(() => {
    if (user && primaryProduct) {
      suggestPrompts(user.description, primaryProduct.description).then(setSuggestions);
    }
  }, [primaryProduct?.id, user?.id]);

  const toggleProduct = (id: string) => {
    setSelectedProductIds(prev => 
      prev.includes(id) 
        ? prev.filter(pid => pid !== id)
        : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    if (!prompt) {
      alert("Please enter a prompt description.");
      return;
    }
    
    // Validation: Must select at least one product if not in USER_ONLY mode
    if (mode !== GenerationMode.USER_ONLY && selectedProducts.length === 0) {
      alert("Please select at least one product for this mode.");
      return;
    }

    setIsGenerating(true);
    try {
      const url = await generateBrandVisual(
        prompt, 
        mode, 
        user, 
        selectedProducts, // Pass all selected products
        appState.likedPrompts
      );
      
      const newImage: GeneratedImage = {
        id: Date.now().toString(),
        url,
        prompt,
        mode,
        productId: primaryProduct?.id, // Just track the first one for metadata simplicity
        timestamp: Date.now()
      };
      onImageGenerated(newImage);
    } catch (error: any) {
      console.error("Generation failed:", error);
      // Show detailed error for debugging using error.message
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      alert(`Failed to generate image. \n\nReason: ${errorMessage}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Get recent images (reverse chronological)
  const recentImages = [...appState.gallery].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left: Controls */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Mode Selector */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
             <div className="grid grid-cols-3 gap-1 bg-gray-950 p-1 rounded-lg">
              {[
                { id: GenerationMode.USER_ONLY, icon: User, label: 'Me' },
                { id: GenerationMode.COMBINED, icon: Users, label: 'Combined' },
                { id: GenerationMode.PRODUCT_ONLY, icon: Package, label: 'Product' }
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`flex flex-col items-center gap-1 py-2 rounded-md text-xs font-medium transition-all ${
                    mode === m.id 
                      ? 'bg-gray-800 text-blue-400 shadow-sm' 
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <m.icon size={16} />
                  {m.label}
                </button>
              ))}
            </div>

            {/* Product Selection (Multi-select) */}
            {mode !== GenerationMode.USER_ONLY && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-400 block">
                  Select Products ({selectedProductIds.length})
                </label>
                {appState.products.length > 0 ? (
                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                    {appState.products.map(p => {
                      const isSelected = selectedProductIds.includes(p.id);
                      return (
                        <div 
                          key={p.id}
                          onClick={() => toggleProduct(p.id)}
                          className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer border transition-all ${
                            isSelected 
                              ? 'bg-blue-900/20 border-blue-500/50' 
                              : 'bg-gray-800 border-gray-800 hover:border-gray-700'
                          }`}
                        >
                          <div className={`shrink-0 ${isSelected ? 'text-blue-400' : 'text-gray-600'}`}>
                            {isSelected ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                          </div>
                          <img src={p.images[0]} alt={p.name} className="w-8 h-8 rounded object-cover bg-gray-900" />
                          <span className={`text-sm truncate ${isSelected ? 'text-white' : 'text-gray-400'}`}>
                            {p.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-red-400 text-sm bg-red-900/20 p-2 rounded border border-red-900/50">
                    No products found. Go to Studio to add one.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Prompting Section */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-white">Create Visual</h3>
              <button 
                onClick={() => setShowPromptor(!showPromptor)}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                <Sparkles size={12} />
                {showPromptor ? 'Hide Promptor' : 'Open Promptor'}
              </button>
            </div>

            {showPromptor && (
              <Promptor 
                onUsePrompt={(p) => { setPrompt(p); setShowPromptor(false); }} 
                contextUser={user?.name}
                contextProduct={primaryProduct?.name}
              />
            )}

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={mode === GenerationMode.COMBINED 
                ? `Describe ${user?.name || 'the person'} with the products...` 
                : "Describe the scene, lighting, and mood..."}
              className="w-full bg-gray-900 border border-gray-800 rounded-lg p-3 text-white h-32 resize-none focus:ring-2 focus:ring-blue-500/50 outline-none text-sm"
            />
            
            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s, i) => (
                  <button 
                    key={i} 
                    onClick={() => setPrompt(s)}
                    className="text-[10px] bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded-full border border-gray-700 transition-colors truncate max-w-[200px]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <Button 
              onClick={handleGenerate} 
              isLoading={isGenerating} 
              className="w-full" 
              disabled={!prompt.trim() || (mode !== GenerationMode.USER_ONLY && selectedProductIds.length === 0)}
            >
              <Sparkles size={18} />
              Generate
            </Button>
          </div>

          {/* Memory Indicator */}
          {appState.likedPrompts.length > 0 && (
            <div className="p-3 bg-blue-900/10 border border-blue-500/10 rounded-lg text-xs text-blue-300/80">
              <span className="font-bold">Memory Active:</span> I've learned from {appState.likedPrompts.length} visual styles you liked.
            </div>
          )}
        </div>

        {/* Right: Gallery Stream */}
        <div className="lg:col-span-2">
           <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Recent Creations</h2>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {recentImages.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center h-64 text-gray-600 border-2 border-dashed border-gray-800 rounded-2xl">
                <Sparkles size={32} className="mb-3 opacity-50" />
                <p>No images yet. Start creating!</p>
              </div>
            ) : (
              recentImages.map((img) => (
                <div key={img.id} className="group relative bg-gray-900 rounded-xl overflow-hidden shadow-2xl border border-gray-800 animate-fade-in-up">
                  <img src={img.url} alt={img.prompt} className="w-full aspect-square object-cover" />
                  
                  {/* Overlay Actions */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                    <p className="text-white text-xs line-clamp-2 mb-3 opacity-90">{img.prompt}</p>
                    
                    <div className="flex justify-between items-center">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => onFeedback(img.id, 'like')}
                          className={`p-2 rounded-full transition-colors ${img.feedback === 'like' ? 'bg-blue-600 text-white' : 'bg-white/10 text-white hover:bg-blue-600'}`}
                        >
                          <ThumbsUp size={14} />
                        </button>
                        <button 
                          onClick={() => onFeedback(img.id, 'dislike')}
                          className={`p-2 rounded-full transition-colors ${img.feedback === 'dislike' ? 'bg-red-600 text-white' : 'bg-white/10 text-white hover:bg-red-600'}`}
                        >
                          <ThumbsDown size={14} />
                        </button>
                      </div>
                      
                      <a 
                        href={img.url} 
                        download={`gemini-visual-${img.id}.png`}
                        className="p-2 bg-white text-black rounded-full hover:scale-110 transition-transform"
                      >
                        <Download size={14} />
                      </a>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};