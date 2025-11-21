import React, { useState, useEffect } from 'react';
import { EntityProfile } from '../types';
import { ImageUploader } from './ImageUploader';
import { Button } from './Button';
import { analyzeImageForTraining } from '../services/geminiService';
import { Plus, Trash2, Save, RefreshCw, Edit2, Check, Sparkles } from 'lucide-react';

interface StudioProps {
  user: EntityProfile | null;
  products: EntityProfile[];
  onUpdateUser: (user: EntityProfile) => void;
  onUpdateProducts: (products: EntityProfile[]) => void;
}

export const Studio: React.FC<StudioProps> = ({ user, products, onUpdateUser, onUpdateProducts }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [editName, setEditName] = useState('');
  const [editImages, setEditImages] = useState<string[]>([]);
  const [editDescription, setEditDescription] = useState('');

  const startEdit = (entity: EntityProfile) => {
    setEditingId(entity.id);
    setEditName(entity.name);
    setEditImages(entity.images);
    setEditDescription(entity.description);
  };

  const startNewProduct = () => {
    setEditingId('new_product');
    setEditName('');
    setEditImages([]);
    setEditDescription('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditImages([]);
    setEditDescription('');
  };

  const handleAnalyze = async (type: 'PERSON' | 'PRODUCT') => {
    if (editImages.length === 0) {
      alert("Veuillez d'abord télécharger des images.");
      return;
    }
    setIsAnalyzing(true);
    try {
      const desc = await analyzeImageForTraining(editImages, type);
      setEditDescription(desc);
    } catch (error) {
      alert("L'analyse a échoué. Veuillez réessayer.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = async (type: 'PERSON' | 'PRODUCT') => {
    if (!editName || editImages.length === 0) {
      alert("Veuillez fournir un nom et télécharger au moins une image.");
      return;
    }
    
    setIsSaving(true);
    let finalDescription = editDescription;

    // AUTO-GENERATE Description if missing ("The Truth")
    if (!finalDescription) {
      try {
        finalDescription = await analyzeImageForTraining(editImages, type);
        setEditDescription(finalDescription); 
      } catch (error) {
        alert("Échec de l'auto-génération de la description d'identité. Vous pouvez essayer d'enregistrer à nouveau ou écrire une description manuellement.");
        setIsSaving(false);
        return;
      }
    }
    
    const newEntity: EntityProfile = {
      id: editingId === 'new_product' ? Date.now().toString() : editingId!,
      name: editName,
      description: finalDescription,
      images: editImages,
      type
    };

    if (type === 'PERSON') {
      onUpdateUser(newEntity);
    } else {
      if (editingId === 'new_product') {
        onUpdateProducts([...products, newEntity]);
      } else {
        onUpdateProducts(products.map(p => p.id === newEntity.id ? newEntity : p));
      }
    }
    setIsSaving(false);
    setEditingId(null);
  };

  const deleteProduct = (id: string) => {
    if (confirm('Supprimer ce produit ?')) {
      onUpdateProducts(products.filter(p => p.id !== id));
    }
  };

  if (editingId) {
    const isUser = editingId === user?.id;
    const isNew = editingId === 'new_product';
    const type = isUser ? 'PERSON' : 'PRODUCT';

    return (
      <div className="max-w-3xl mx-auto p-6 bg-gray-900 rounded-xl border border-gray-800 animate-fade-in">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">
            {isNew ? 'Ajouter un Produit' : `Modifier ${isUser ? 'Profil' : 'Produit'}`}
          </h2>
          <button onClick={cancelEdit} className="text-gray-400 hover:text-white"><XIcon /></button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Nom</label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder={isUser ? "Votre Nom" : "Nom du Produit"}
              />
            </div>

            <ImageUploader
              label="Photos de Référence"
              description={`Téléchargez jusqu'à 20 photos claires de ${isUser ? 'votre visage' : 'du produit'}.`}
              images={editImages}
              onImagesChange={setEditImages}
              maxImages={20}
            />
          </div>

          <div className="space-y-4 flex flex-col">
             <div className="flex justify-between items-center">
               <label className="block text-sm font-medium text-gray-400">
                 Description IA (La "Vérité")
               </label>
               <button 
                  onClick={() => handleAnalyze(type)}
                  disabled={isAnalyzing || isSaving || editImages.length === 0}
                  className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300 disabled:opacity-50"
               >
                 <Sparkles size={12} />
                 {isAnalyzing ? 'Analyse...' : 'Régénérer'}
               </button>
             </div>
             
             <div className="relative flex-1">
               <textarea
                 value={editDescription}
                 onChange={(e) => setEditDescription(e.target.value)}
                 className="w-full h-full min-h-[300px] bg-gray-950 border border-gray-800 rounded-lg p-4 text-sm text-gray-300 focus:ring-2 focus:ring-blue-500/50 outline-none resize-none leading-relaxed"
                 placeholder={isAnalyzing || isSaving ? "Analyse des caractéristiques..." : "Téléchargez des photos. Cette description sera générée automatiquement à l'enregistrement si vous la laissez vide."}
               />
               <div className="absolute bottom-4 right-4 text-[10px] text-gray-500 bg-black/50 px-2 py-1 rounded">
                 Astuce : Modifiez ce texte pour corriger les erreurs.
               </div>
             </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-6 border-t border-gray-800 mt-6">
          <Button variant="secondary" onClick={cancelEdit} disabled={isSaving}>Annuler</Button>
          <Button onClick={() => handleSave(type)} disabled={isSaving || !editName} isLoading={isSaving}>
            <Save size={18} />
            {isSaving ? 'Création Identité...' : 'Enregistrer'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">Gestion du Studio</h1>
        <p className="text-gray-400">Gérez vos jumeaux numériques et votre catalogue de produits.</p>
      </header>

      {/* User Profile Section */}
      <section className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              Profil Utilisateur
              {user && <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded">Actif</span>}
            </h2>
            <p className="text-sm text-gray-400">Vos données d'apparence numérique.</p>
          </div>
          {user ? (
            <Button variant="secondary" onClick={() => startEdit(user)} className="py-1 px-3 text-sm">
              <Edit2 size={14} /> Modifier
            </Button>
          ) : (
            <p className="text-red-400 text-sm">Profil Manquant</p>
          )}
        </div>
        
        {user && (
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex -space-x-3 shrink-0">
              {user.images.slice(0, 3).map((img, i) => (
                <img key={i} src={img} className="w-16 h-16 rounded-full border-2 border-gray-900 object-cover" />
              ))}
              {user.images.length > 3 && (
                <div className="w-16 h-16 rounded-full border-2 border-gray-900 bg-gray-800 flex items-center justify-center text-xs font-medium text-gray-400">
                  +{user.images.length - 3}
                </div>
              )}
            </div>
            <div className="bg-black/30 p-4 rounded-lg border border-gray-800 w-full">
              <p className="text-xs font-mono text-blue-400 mb-2 uppercase tracking-wider">Logique de Description</p>
              <p className="text-sm text-gray-400 line-clamp-3">{user.description}</p>
            </div>
          </div>
        )}
      </section>

      {/* Products Section */}
      <section className="space-y-4">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-xl font-bold text-white">Produits</h2>
            <p className="text-sm text-gray-400">Votre catalogue d'objets entraînés.</p>
          </div>
          <Button onClick={startNewProduct} className="py-2 px-4">
            <Plus size={18} /> Ajouter Produit
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {products.map(product => (
            <div key={product.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors flex flex-col">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-bold text-white">{product.name}</h3>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(product)} className="p-2 hover:bg-gray-800 rounded text-blue-400">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => deleteProduct(product.id)} className="p-2 hover:bg-gray-800 rounded text-red-400">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="flex gap-2 overflow-hidden h-32 rounded-lg bg-gray-950 mb-3 shrink-0">
                {product.images.slice(0, 3).map((img, i) => (
                  <img key={i} src={img} className="h-full w-auto object-cover" />
                ))}
                 {product.images.length > 3 && (
                  <div className="w-20 h-full bg-gray-800 flex items-center justify-center text-xs text-gray-400">
                    +{product.images.length - 3}
                  </div>
                 )}
              </div>
              <div className="bg-black/20 p-2 rounded border border-gray-800/50 flex-1">
                 <p className="text-[10px] text-gray-500 line-clamp-3 font-mono leading-relaxed">{product.description}</p>
              </div>
            </div>
          ))}
          
          {products.length === 0 && (
            <div className="col-span-full py-12 text-center border-2 border-dashed border-gray-800 rounded-xl text-gray-500">
              Aucun produit entraîné pour le moment. Cliquez sur "Ajouter Produit" pour commencer.
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

const XIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);