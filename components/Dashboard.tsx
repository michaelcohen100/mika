
import React, { useState, useEffect } from 'react';
import { AppState, GenerationMode, GeneratedImage, ArtStyle, EditorTab, ExportFormat } from '../types';
import { generateBrandVisual, suggestPrompts, editGeneratedVisual, expandImageForFormat } from '../services/geminiService';
import { Button } from './Button';
import { Promptor } from './Promptor';
import { Sparkles, User, Package, Users, Download, ThumbsUp, ThumbsDown, CheckCircle2, Circle, AlertTriangle, Layers, Maximize2, X, Palette, Wand2, SplitSquareHorizontal, Crop, ArrowRight, Check } from 'lucide-react';

// Définition des styles disponibles
const ART_STYLES: ArtStyle[] = [
  {
    id: 'none',
    label: 'Naturel',
    promptModifier: 'Natural lighting, realistic photography, neutral tones.',
    icon: '📷',
    color: 'from-gray-700 to-gray-600'
  },
  {
    id: 'studio',
    label: 'Studio Pro',
    promptModifier: 'Professional studio photography, softbox lighting, solid clean background, high detail product shot, 8k resolution, sharp focus.',
    icon: '💡',
    color: 'from-blue-600 to-indigo-600'
  },
  {
    id: 'luxury',
    label: 'Luxe & Élégant',
    promptModifier: 'Luxury editorial style, golden hour warm lighting, bokeh depth of field, expensive atmosphere, vogue magazine aesthetic, rich textures.',
    icon: '💎',
    color: 'from-amber-600 to-yellow-600'
  },
  {
    id: 'neon',
    label: 'Cyber / Néon',
    promptModifier: 'Cyberpunk aesthetic, neon blue and pink lighting, dark moody atmosphere, wet reflection, futuristic city vibe, high contrast.',
    icon: '🌃',
    color: 'from-purple-600 to-pink-600'
  },
  {
    id: 'nature',
    label: 'Organique',
    promptModifier: 'Outdoor nature photography, sunlight dappled through leaves, soft organic tones, fresh atmosphere, botanical elements, morning light.',
    icon: '🌿',
    color: 'from-green-600 to-emerald-600'
  },
  {
    id: 'minimal',
    label: 'Minimaliste',
    promptModifier: 'Minimalist design, pastel colors, bright high-key lighting, plenty of negative space, clean lines, apple design aesthetic.',
    icon: '⚪',
    color: 'from-gray-200 to-white text-black'
  }
];

interface DashboardProps {
  appState: AppState;
  onImageGenerated: (img: GeneratedImage) => void;
  onFeedback: (id: string, type: 'like' | 'dislike') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ appState, onImageGenerated, onFeedback }) => {
  const [mode, setMode] = useState<GenerationMode>(GenerationMode.COMBINED);
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<ArtStyle>(ART_STYLES[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  const [variationCount, setVariationCount] = useState<number>(1);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(
    appState.products.length > 0 ? [appState.products[0].id] : []
  );
  const [showPromptor, setShowPromptor] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  
  // Lightbox State
  const [lightboxImage, setLightboxImage] = useState<GeneratedImage | null>(null);
  const [activeTab, setActiveTab] = useState<EditorTab>('details');
  
  // Editor State
  const [editInstruction, setEditInstruction] = useState('');
  const [isProcessingEdit, setIsProcessingEdit] = useState(false);

  // Comparison State
  const [isComparisonMode, setIsComparisonMode] = useState(false);
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const [showComparisonModal, setShowComparisonModal] = useState(false);

  const user = appState.user;
  const selectedProducts = appState.products.filter(p => selectedProductIds.includes(p.id));
  const primaryProduct = selectedProducts[0] || null;

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

  const toggleComparisonSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (comparisonIds.includes(id)) {
      setComparisonIds(prev => prev.filter(cid => cid !== id));
    } else {
      if (comparisonIds.length < 2) {
        setComparisonIds(prev => [...prev, id]);
      } else {
        // Replace the first one if full
        setComparisonIds(prev => [prev[1], id]);
      }
    }
  };

  const handleGenerate = async () => {
    if (!prompt) {
      alert("Veuillez entrer une description pour le prompt.");
      return;
    }
    
    if (mode !== GenerationMode.USER_ONLY && selectedProducts.length === 0) {
      alert("Veuillez sélectionner au moins un produit pour ce mode.");
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(`Initialisation...`);
    
    let successCount = 0;
    let errors: string[] = [];

    // Combine user prompt with style modifier
    const finalPrompt = `${prompt}. \n\nSTYLE INSTRUCTIONS: ${selectedStyle.promptModifier}`;

    for (let i = 0; i < variationCount; i++) {
      setGenerationProgress(`Génération du visuel ${i + 1}/${variationCount}...`);
      
      try {
        const url = await generateBrandVisual(
          finalPrompt, 
          mode, 
          user, 
          selectedProducts, 
          appState.likedPrompts
        );
        
        const newImage: GeneratedImage = {
          id: Date.now().toString() + Math.random().toString().slice(2, 5),
          url,
          prompt: finalPrompt,
          mode,
          productId: primaryProduct?.id, 
          styleId: selectedStyle.id,
          timestamp: Date.now()
        };
        
        onImageGenerated(newImage);
        successCount++;
        
      } catch (error: any) {
        console.error(`Variation ${i+1} failed:`, error);
        const msg = error instanceof Error ? error.message : "Erreur inconnue";
        errors.push(msg);
      }
    }

    setIsGenerating(false);
    setGenerationProgress('');

    if (successCount === 0 && errors.length > 0) {
       alert(`La génération a échoué.\n${errors[0]}`);
    }
  };

  const handleMagicEdit = async () => {
    if (!lightboxImage || !editInstruction) return;
    setIsProcessingEdit(true);
    try {
      const newUrl = await editGeneratedVisual(lightboxImage.url, editInstruction);
      const newImage: GeneratedImage = {
        ...lightboxImage,
        id: Date.now().toString(),
        url: newUrl,
        timestamp: Date.now(),
        prompt: `${lightboxImage.prompt} [Edit: ${editInstruction}]`,
        parentId: lightboxImage.id
      };
      onImageGenerated(newImage);
      setLightboxImage(newImage); // Switch to new image
      setEditInstruction('');
      setActiveTab('details');
    } catch (e: any) {
      alert(`Erreur d'édition: ${e.message}`);
    } finally {
      setIsProcessingEdit(false);
    }
  };

  const handleExport = async (format: ExportFormat) => {
    if (!lightboxImage) return;
    setIsProcessingEdit(true);
    try {
      const newUrl = await expandImageForFormat(lightboxImage.url, format);
      const newImage: GeneratedImage = {
        ...lightboxImage,
        id: Date.now().toString(),
        url: newUrl,
        timestamp: Date.now(),
        prompt: `${lightboxImage.prompt} [Export: ${format}]`,
        parentId: lightboxImage.id
      };
      onImageGenerated(newImage);
      setLightboxImage(newImage);
      setActiveTab('details');
    } catch (e: any) {
      alert(`Erreur d'exportation: ${e.message}`);
    } finally {
      setIsProcessingEdit(false);
    }
  };

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
                { id: GenerationMode.USER_ONLY, icon: User, label: 'Moi' },
                { id: GenerationMode.COMBINED, icon: Users, label: 'Combiné' },
                { id: GenerationMode.PRODUCT_ONLY, icon: Package, label: 'Produit' }
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

            {/* Product Selection */}
            {mode !== GenerationMode.USER_ONLY && (
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                   <label className="text-xs font-medium text-gray-400 block">
                     Sélectionner Produits ({selectedProductIds.length})
                   </label>
                   <span className="text-[10px] text-gray-600">Max 2 références utilisées</span>
                </div>
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
                  <div className="text-red-400 text-sm bg-red-900/20 p-2 rounded border border-red-900/50 flex items-center gap-2">
                    <AlertTriangle size={14} />
                    Aucun produit. Ajoutez-en un dans le Studio.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Style Selector - NEW FEATURE */}
          <div className="space-y-2">
             <div className="flex items-center gap-2 text-white font-bold">
                <Palette size={16} className="text-blue-500"/>
                <h3>Style Artistique</h3>
             </div>
             <div className="grid grid-cols-3 gap-2">
               {ART_STYLES.map((style) => (
                 <button
                   key={style.id}
                   onClick={() => setSelectedStyle(style)}
                   className={`relative p-2 rounded-lg border text-left transition-all overflow-hidden ${
                     selectedStyle.id === style.id 
                       ? 'border-blue-500 ring-1 ring-blue-500' 
                       : 'border-gray-800 bg-gray-900 hover:border-gray-700'
                   }`}
                 >
                   <div className={`absolute inset-0 bg-gradient-to-br ${style.color} opacity-10 pointer-events-none`}></div>
                   <div className="text-lg mb-1">{style.icon}</div>
                   <div className={`text-[10px] font-bold leading-tight ${selectedStyle.id === style.id ? 'text-blue-400' : 'text-gray-400'}`}>
                     {style.label}
                   </div>
                 </button>
               ))}
             </div>
          </div>

          {/* Prompting Section */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-white">Description</h3>
              <button 
                onClick={() => setShowPromptor(!showPromptor)}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                <Sparkles size={12} />
                {showPromptor ? 'Masquer Assistant' : 'Assistant Prompt'}
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
                ? `Décrivez ${user?.name || 'la personne'} utilisant les produits sélectionnés...` 
                : "Décrivez la scène, l'éclairage et l'ambiance..."}
              className="w-full bg-gray-900 border border-gray-800 rounded-lg p-3 text-white h-32 resize-none focus:ring-2 focus:ring-blue-500/50 outline-none text-sm"
            />
            
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

            {/* Variations Slider */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-3">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2 text-xs font-medium text-gray-300">
                  <Layers size={14} className="text-blue-500" />
                  Variantes par lot
                </div>
                <span className="text-xs font-bold text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded-full">
                  {variationCount}
                </span>
              </div>
              <input 
                type="range" 
                min="1" 
                max="10" 
                value={variationCount}
                onChange={(e) => setVariationCount(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-[10px] text-gray-600 mt-1 px-1">
                <span>1</span>
                <span>5</span>
                <span>10</span>
              </div>
            </div>

            <Button 
              onClick={handleGenerate} 
              isLoading={isGenerating} 
              className="w-full" 
              disabled={!prompt.trim() || (mode !== GenerationMode.USER_ONLY && selectedProductIds.length === 0)}
            >
              {isGenerating ? (
                <span className="flex flex-col items-center leading-tight">
                  <span>Traitement...</span>
                  <span className="text-[10px] opacity-75 font-normal">{generationProgress}</span>
                </span>
              ) : (
                <>
                  <Sparkles size={18} />
                  Générer {variationCount > 1 ? `Lot (${variationCount})` : ''}
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Right: Gallery Stream */}
        <div className="lg:col-span-2">
           <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold">Galerie</h2>
                <span className="text-xs text-gray-500">{recentImages.length} images</span>
              </div>
              
              {/* Comparison Toggle */}
              <button 
                onClick={() => { setIsComparisonMode(!isComparisonMode); setComparisonIds([]); }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  isComparisonMode 
                    ? 'bg-blue-900/30 border-blue-500 text-blue-300' 
                    : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-800'
                }`}
              >
                <SplitSquareHorizontal size={14} />
                {isComparisonMode ? 'Mode Comparaison Actif' : 'Comparer Images'}
              </button>
           </div>
           
           <div className="grid grid-cols-2 md:grid-cols-3 gap-4 relative">
            {recentImages.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center h-64 text-gray-600 border-2 border-dashed border-gray-800 rounded-2xl">
                <Sparkles size={32} className="mb-3 opacity-50" />
                <p>Aucune image. Commencez à créer !</p>
              </div>
            ) : (
              recentImages.map((img) => {
                const styleUsed = ART_STYLES.find(s => s.id === img.styleId);
                const isSelected = comparisonIds.includes(img.id);
                
                return (
                  <div 
                    key={img.id} 
                    className={`group relative bg-gray-900 rounded-lg overflow-hidden shadow-lg border transition-all cursor-pointer ${
                      isSelected 
                        ? 'border-blue-500 ring-2 ring-blue-500/50' 
                        : 'border-gray-800 hover:border-blue-500/30'
                    }`}
                    onClick={(e) => isComparisonMode ? toggleComparisonSelection(img.id, e) : setLightboxImage(img)}
                  >
                    <img src={img.url} alt={img.prompt} className="w-full aspect-square object-cover" />
                    
                    {!isComparisonMode && (
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Maximize2 className="text-white" size={24} />
                      </div>
                    )}
                    
                    {isComparisonMode && (
                       <div className={`absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'bg-black/50 border-white/50'}`}>
                          {isSelected && <Check size={14} />}
                       </div>
                    )}
                    
                    {/* Style Badge */}
                    {styleUsed && styleUsed.id !== 'none' && (
                       <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-[10px] text-white px-2 py-1 rounded-full flex items-center gap-1">
                         <span>{styleUsed.icon}</span> {styleUsed.label}
                       </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Floating Comparison Button */}
            {isComparisonMode && comparisonIds.length === 2 && (
              <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-bounce-in">
                <button 
                  onClick={() => setShowComparisonModal(true)}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-full font-bold shadow-xl flex items-center gap-2"
                >
                  <SplitSquareHorizontal size={18} />
                  Comparer (2/2)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Comparison Modal */}
      {showComparisonModal && comparisonIds.length === 2 && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex flex-col p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <SplitSquareHorizontal className="text-blue-500" /> Comparateur A/B
            </h2>
            <button onClick={() => setShowComparisonModal(false)} className="p-2 bg-gray-800 rounded-full hover:bg-gray-700"><X size={20}/></button>
          </div>
          
          <div className="flex-1 grid grid-cols-2 gap-4 overflow-hidden">
            {comparisonIds.map((id, idx) => {
              const img = recentImages.find(i => i.id === id);
              if (!img) return null;
              return (
                 <div key={id} className="flex flex-col h-full bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                    <div className="flex-1 relative">
                       <img src={img.url} className="w-full h-full object-contain bg-black" />
                       <div className="absolute top-4 left-4 bg-black/70 px-3 py-1 rounded-full text-sm font-bold border border-white/10">
                          {idx === 0 ? 'A' : 'B'}
                       </div>
                    </div>
                    <div className="p-4 border-t border-gray-800 flex justify-between items-center">
                       <div className="text-xs text-gray-400">
                          <p className="font-bold text-white mb-1">Généré le {new Date(img.timestamp).toLocaleDateString()}</p>
                          <p className="line-clamp-1">{img.prompt}</p>
                       </div>
                       <div className="flex gap-2">
                          <button 
                            onClick={() => onFeedback(img.id, 'like')} 
                            className={`p-2 rounded-lg ${img.feedback === 'like' ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'}`}
                          >
                            <ThumbsUp size={18} />
                          </button>
                          <a href={img.url} download className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700">
                             <Download size={18} />
                          </a>
                       </div>
                    </div>
                 </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <button 
            onClick={() => { setLightboxImage(null); setActiveTab('details'); setEditInstruction(''); }}
            className="absolute top-4 right-4 p-2 bg-gray-800 rounded-full text-white hover:bg-gray-700 z-10"
          >
            <X size={24} />
          </button>

          <div className="max-w-6xl w-full flex flex-col md:flex-row bg-gray-900 rounded-2xl overflow-hidden border border-gray-800 shadow-2xl h-[85vh]">
            
            {/* Image Area */}
            <div className="flex-1 bg-black flex items-center justify-center p-4 relative bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
              <img src={lightboxImage.url} className="max-w-full max-h-full object-contain shadow-2xl" alt="Généré" />
              {isProcessingEdit && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-20 backdrop-blur-sm">
                   <Sparkles className="animate-spin text-blue-500 mb-4" size={48} />
                   <p className="text-xl font-bold text-white">L'IA travaille...</p>
                   <p className="text-sm text-blue-300">Application de la magie numérique</p>
                </div>
              )}
            </div>

            {/* Sidebar with Tabs */}
            <div className="w-full md:w-96 bg-gray-900 flex flex-col border-l border-gray-800">
              
              {/* Tabs */}
              <div className="flex border-b border-gray-800">
                <button 
                  onClick={() => setActiveTab('details')}
                  className={`flex-1 py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'details' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 hover:text-white'}`}
                >
                  Détails
                </button>
                <button 
                  onClick={() => setActiveTab('edit')}
                  className={`flex-1 py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'edit' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-500 hover:text-white'}`}
                >
                  <Wand2 size={14} className="inline mr-1"/> Retouche
                </button>
                <button 
                  onClick={() => setActiveTab('export')}
                  className={`flex-1 py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'export' ? 'border-green-500 text-green-400' : 'border-transparent text-gray-500 hover:text-white'}`}
                >
                  <Crop size={14} className="inline mr-1"/> Export
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                
                {activeTab === 'details' && (
                  <div className="space-y-6 animate-fade-in">
                    <div>
                       <label className="text-xs font-mono text-gray-500 uppercase">Prompt</label>
                       <p className="text-sm text-gray-300 leading-relaxed mt-1 bg-gray-950 p-3 rounded-lg border border-gray-800">{lightboxImage.prompt}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                         <label className="text-xs font-mono text-gray-500 uppercase">Mode</label>
                         <p className="text-sm text-blue-400 mt-1 font-medium">{lightboxImage.mode}</p>
                      </div>
                      {lightboxImage.styleId && (
                        <div>
                          <label className="text-xs font-mono text-gray-500 uppercase">Style</label>
                          <p className="text-sm text-gray-300 mt-1 flex items-center gap-2">
                            {ART_STYLES.find(s => s.id === lightboxImage.styleId)?.icon}
                            {ART_STYLES.find(s => s.id === lightboxImage.styleId)?.label}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <div className="pt-6 mt-6 border-t border-gray-800 space-y-3">
                       <div className="flex gap-2">
                          <button 
                            onClick={() => onFeedback(lightboxImage.id, 'like')}
                            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors ${lightboxImage.feedback === 'like' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                          >
                            <ThumbsUp size={16} /> J'aime
                          </button>
                          <button 
                            onClick={() => onFeedback(lightboxImage.id, 'dislike')}
                            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors ${lightboxImage.feedback === 'dislike' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                          >
                            <ThumbsDown size={16} />
                          </button>
                       </div>
                       
                       <a 
                         href={lightboxImage.url}
                         download={`gemini-visual-${lightboxImage.id}.png`}
                         className="w-full py-3 bg-white text-black font-bold rounded-lg flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors"
                       >
                         <Download size={18} /> Télécharger HD
                       </a>
                    </div>
                  </div>
                )}

                {activeTab === 'edit' && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="bg-purple-900/20 border border-purple-500/20 p-4 rounded-xl">
                      <h4 className="font-bold text-purple-300 mb-2 flex items-center gap-2">
                        <Wand2 size={16} /> Éditeur Magique
                      </h4>
                      <p className="text-xs text-purple-200/70 mb-4">
                        Décrivez ce que vous voulez changer. L'IA va redessiner l'image en respectant votre demande.
                      </p>
                      
                      <textarea 
                        value={editInstruction}
                        onChange={(e) => setEditInstruction(e.target.value)}
                        placeholder="ex: Ajoute des lunettes de soleil, change le fond pour une plage, rend l'ambiance plus sombre..."
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-white min-h-[100px] focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                      />
                      
                      <Button 
                        onClick={handleMagicEdit} 
                        disabled={!editInstruction.trim() || isProcessingEdit}
                        className="w-full mt-4 bg-purple-600 hover:bg-purple-500"
                      >
                        <Sparkles size={16} /> Appliquer Retouche
                      </Button>
                    </div>
                  </div>
                )}

                {activeTab === 'export' && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="bg-green-900/20 border border-green-500/20 p-4 rounded-xl">
                      <h4 className="font-bold text-green-300 mb-2 flex items-center gap-2">
                        <Crop size={16} /> Studio d'Export
                      </h4>
                      <p className="text-xs text-green-200/70 mb-4">
                        Étendez intelligemment votre image pour les réseaux sociaux sans couper le sujet (Outpainting).
                      </p>

                      <div className="grid grid-cols-2 gap-3">
                        <button 
                          onClick={() => handleExport('9:16')}
                          disabled={isProcessingEdit}
                          className="flex flex-col items-center gap-2 p-4 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-colors"
                        >
                          <div className="w-6 h-10 border-2 border-gray-400 rounded-sm bg-gray-600"></div>
                          <span className="text-xs font-bold text-gray-300">Story (9:16)</span>
                        </button>
                        
                        <button 
                          onClick={() => handleExport('16:9')}
                          disabled={isProcessingEdit}
                          className="flex flex-col items-center gap-2 p-4 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-colors"
                        >
                          <div className="w-10 h-6 border-2 border-gray-400 rounded-sm bg-gray-600"></div>
                          <span className="text-xs font-bold text-gray-300">Banner (16:9)</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
