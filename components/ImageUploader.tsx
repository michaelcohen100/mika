import React from 'react';
import { Upload, X } from 'lucide-react';

interface ImageUploaderProps {
  label: string;
  description: string;
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  label,
  description,
  images,
  onImagesChange,
  maxImages = 20 // Default to 20 as requested
}) => {
  
  // Utility to resize and compress images to avoid storage overflow
  const processFile = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_SIZE = 800; // Resize to manageable size for Gemini & Storage

          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          // Compress to JPEG 70% quality
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const processors: Promise<string>[] = [];

    Array.from(files).forEach((file: File) => {
      processors.push(processFile(file));
    });

    Promise.all(processors).then(results => {
      const remainingSlots = maxImages - images.length;
      const newImages = results.slice(0, remainingSlots);
      const combined = [...images, ...newImages];
      onImagesChange(combined);
    });
  };

  const removeImage = (index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    onImagesChange(newImages);
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex justify-between items-end">
        <div>
          <h3 className="text-lg font-semibold text-white">{label}</h3>
          <p className="text-sm text-gray-400">{description}</p>
        </div>
        <span className="text-xs font-mono text-gray-500">
          {images.length} / {maxImages}
        </span>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
        {images.map((img, idx) => (
          <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-700 bg-gray-800">
            <img src={img} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover" />
            <button
              onClick={() => removeImage(idx)}
              className="absolute top-1 right-1 p-1 bg-red-500/90 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110"
            >
              <X size={12} />
            </button>
          </div>
        ))}

        {images.length < maxImages && (
          <label className="aspect-square rounded-lg border-2 border-dashed border-gray-700 hover:border-blue-500 bg-gray-800/50 hover:bg-gray-800 flex flex-col items-center justify-center cursor-pointer transition-all group">
            <Upload className="w-6 h-6 text-gray-500 group-hover:text-blue-500 mb-2" />
            <span className="text-[10px] text-gray-400 group-hover:text-blue-400 text-center px-1">
              Add Photo
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              multiple
            />
          </label>
        )}
      </div>
    </div>
  );
};