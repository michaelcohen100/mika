import React, { useState } from 'react';
import { ImageUploader } from './ImageUploader';
import { Button } from './Button';
import { TrainingData } from '../types';
import { analyzeImageForTraining } from '../services/geminiService';
import { ArrowRight, CheckCircle, Camera, Package } from 'lucide-react';

interface TrainingWizardProps {
  onComplete: (data: TrainingData) => void;
}

export const TrainingWizard: React.FC<TrainingWizardProps> = ({ onComplete }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [data, setData] = useState<Partial<TrainingData>>({
    userImages: [],
    productImages: [],
    userName: '',
    productName: ''
  });

  const handleNext = async () => {
    if (step === 1) {
      if (!data.userImages?.length || !data.userName) return;
      setStep(2);
    } else {
      // Finalize
      if (!data.productImages?.length || !data.productName) return;
      
      setIsAnalyzing(true);
      try {
        // Analyze User
        const userDesc = await analyzeImageForTraining(data.userImages!, 'PERSON');
        // Analyze Product
        const prodDesc = await analyzeImageForTraining(data.productImages!, 'PRODUCT');
        
        onComplete({
          userImages: data.userImages!,
          userDescription: userDesc,
          productImages: data.productImages!,
          productDescription: prodDesc,
          userName: data.userName!,
          productName: data.productName!
        });
      } catch (error) {
        alert("Failed to analyze images. Please try again.");
      } finally {
        setIsAnalyzing(false);
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8 relative">
        <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-800 -z-10"></div>
        <div className={`flex flex-col items-center gap-2 ${step >= 1 ? 'text-blue-400' : 'text-gray-600'}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${step >= 1 ? 'bg-gray-900 border-blue-500' : 'bg-gray-900 border-gray-700'}`}>
            <Camera size={20} />
          </div>
          <span className="text-xs font-medium">You</span>
        </div>
        <div className={`flex flex-col items-center gap-2 ${step >= 2 ? 'text-blue-400' : 'text-gray-600'}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${step >= 2 ? 'bg-gray-900 border-blue-500' : 'bg-gray-900 border-gray-700'}`}>
            <Package size={20} />
          </div>
          <span className="text-xs font-medium">Product</span>
        </div>
      </div>

      <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8 backdrop-blur-sm">
        {step === 1 ? (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">Introduce yourself</h2>
              <p className="text-gray-400">Gemini needs to learn what you look like. Upload clear photos of your face.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Your Name</label>
              <input
                type="text"
                value={data.userName}
                onChange={e => setData({...data, userName: e.target.value})}
                placeholder="e.g. Alex"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <ImageUploader
              label="Your Photos"
              description="Upload 1 to 20 clear photos. More photos = better accuracy, but one is enough to start."
              images={data.userImages || []}
              onImagesChange={imgs => setData({...data, userImages: imgs})}
              maxImages={20}
            />
          </div>
        ) : (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">Showcase your product</h2>
              <p className="text-gray-400">Upload photos of the product you want to feature in your visuals.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Product Name</label>
              <input
                type="text"
                value={data.productName}
                onChange={e => setData({...data, productName: e.target.value})}
                placeholder="e.g. Chronos Watch"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <ImageUploader
              label="Product Photos"
              description="Upload 1 to 20 photos from different angles."
              images={data.productImages || []}
              onImagesChange={imgs => setData({...data, productImages: imgs})}
              maxImages={20}
            />
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-gray-800 flex justify-end">
          <Button 
            onClick={handleNext}
            isLoading={isAnalyzing}
            disabled={(step === 1 && (!data.userName || !data.userImages?.length)) || (step === 2 && (!data.productName || !data.productImages?.length))}
          >
            {step === 1 ? 'Next Step' : 'Start Training'}
            {!isAnalyzing && <ArrowRight size={18} />}
          </Button>
        </div>
      </div>
      
      {isAnalyzing && (
        <div className="text-center mt-4 text-gray-400 text-sm animate-pulse">
          Gemini is analyzing features and building visual models...
        </div>
      )}
    </div>
  );
};