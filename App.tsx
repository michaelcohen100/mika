import React, { useState, useEffect } from 'react';
import { Studio } from './components/Studio';
import { Dashboard } from './components/Dashboard';
import { TrainingWizard } from './components/TrainingWizard';
import { AppStep, AppState, EntityProfile, GeneratedImage, TrainingData } from './types';
import { Sparkles, LayoutDashboard, Settings, Grid } from 'lucide-react';

// Helper to simulate persistent storage
const STORAGE_KEY = 'gemini_brand_studio_v1';

const getInitialState = (): AppState => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to load state", e);
    }
  }
  return {
    user: null,
    products: [],
    gallery: [],
    likedPrompts: []
  };
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(getInitialState);
  const [view, setView] = useState<AppStep>(AppStep.DASHBOARD);

  // Persist state whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      if (e instanceof DOMException && e.name === "QuotaExceededError") {
        console.error("Storage quota exceeded. Removing gallery images from cache to save space.");
        // Emergency fallback: Don't save gallery image data, only metadata, to preserve profile settings
        const slimState = { 
          ...state, 
          gallery: state.gallery.map(g => ({...g, url: ''})) // Remove base64 from gallery to save space
        }; 
        try { 
          localStorage.setItem(STORAGE_KEY, JSON.stringify(slimState)); 
        } catch(err) {
          alert("Storage full. Your settings cannot be saved anymore. Please clear browser data or remove some photos.");
        }
      }
    }
  }, [state]);

  // Redirect to onboarding if no user profile exists
  useEffect(() => {
    if (!state.user) {
      setView(AppStep.ONBOARDING);
    }
  }, [state.user]);

  // Handlers
  const handleOnboardingComplete = (data: TrainingData) => {
    const userProfile: EntityProfile = {
      id: 'user_main',
      name: data.userName,
      description: data.userDescription,
      images: data.userImages,
      type: 'PERSON'
    };

    const productProfile: EntityProfile = {
      id: Date.now().toString(),
      name: data.productName,
      description: data.productDescription,
      images: data.productImages,
      type: 'PRODUCT'
    };

    setState(prev => ({
      ...prev,
      user: userProfile,
      products: [...prev.products, productProfile]
    }));
    setView(AppStep.DASHBOARD);
  };

  const handleUpdateUser = (user: EntityProfile) => {
    setState(prev => ({ ...prev, user }));
  };

  const handleUpdateProducts = (products: EntityProfile[]) => {
    setState(prev => ({ ...prev, products }));
  };

  const handleImageGenerated = (img: GeneratedImage) => {
    setState(prev => ({
      ...prev,
      gallery: [img, ...prev.gallery]
    }));
  };

  const handleFeedback = (id: string, type: 'like' | 'dislike') => {
    setState(prev => {
      const img = prev.gallery.find(g => g.id === id);
      if (!img) return prev;

      let newLikedPrompts = [...prev.likedPrompts];
      
      if (type === 'like') {
        // Add prompt to memory if not already there
        if (!newLikedPrompts.includes(img.prompt)) {
          newLikedPrompts.push(img.prompt);
        }
      } else {
        // Remove from memory if disliked (correction)
        newLikedPrompts = newLikedPrompts.filter(p => p !== img.prompt);
      }

      return {
        ...prev,
        gallery: prev.gallery.map(g => g.id === id ? { ...g, feedback: type } : g),
        likedPrompts: newLikedPrompts
      };
    });
  };

  // If onboarding, show only wizard
  if (view === AppStep.ONBOARDING) {
    return (
      <div className="min-h-screen bg-black text-white">
         <nav className="border-b border-gray-800 p-4">
            <div className="flex items-center gap-2 text-xl font-bold">
              <Sparkles className="text-blue-500" /> Gemini Brand Studio
            </div>
         </nav>
         <div className="pt-10">
           <TrainingWizard onComplete={handleOnboardingComplete} />
         </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-gray-100 font-sans selection:bg-blue-500/30 pb-20">
      {/* Navbar */}
      <nav className="border-b border-gray-800 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView(AppStep.DASHBOARD)}>
            <div className="bg-gradient-to-tr from-blue-600 to-purple-600 p-2 rounded-lg">
              <Sparkles size={20} className="text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight hidden md:block">Gemini Brand Studio</span>
          </div>
          
          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 bg-gray-900 p-1 rounded-lg border border-gray-800">
            <NavButton 
              active={view === AppStep.DASHBOARD} 
              onClick={() => setView(AppStep.DASHBOARD)} 
              icon={LayoutDashboard} 
              label="Create" 
            />
            <NavButton 
              active={view === AppStep.STUDIO} 
              onClick={() => setView(AppStep.STUDIO)} 
              icon={Settings} 
              label="Studio" 
            />
          </div>
        </div>
      </nav>

      <main>
        {view === AppStep.DASHBOARD && (
          <Dashboard 
            appState={state} 
            onImageGenerated={handleImageGenerated} 
            onFeedback={handleFeedback}
          />
        )}
        {view === AppStep.STUDIO && (
          <Studio 
            user={state.user} 
            products={state.products}
            onUpdateUser={handleUpdateUser}
            onUpdateProducts={handleUpdateProducts}
          />
        )}
      </main>
    </div>
  );
};

const NavButton: React.FC<{ active: boolean; onClick: () => void; icon: any; label: string }> = ({ active, onClick, icon: Icon, label }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
      active ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
    }`}
  >
    <Icon size={16} />
    {label}
  </button>
);

export default App;