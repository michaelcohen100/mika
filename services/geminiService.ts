
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { EntityProfile, GenerationMode, ExportFormat } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Helper to retry an async operation.
 */
async function retryOperation<T>(operation: () => Promise<T>, retries = 3): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    if (retries > 0) {
      console.warn(`Operation failed, retrying... (${retries} attempts left). Error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, 5000)); // Increased wait time
      return retryOperation(operation, retries - 1);
    }
    throw error;
  }
}

/**
 * Analyzes images to create a detailed physical description.
 */
export const analyzeImageForTraining = async (
  base64Images: string[],
  subjectType: 'PERSON' | 'PRODUCT'
): Promise<string> => {
  try {
    const prompt = subjectType === 'PERSON' 
      ? "You are a casting director. Describe the person in these photos in extreme detail. Focus on facial structure, eye color, hair texture, age, and skin tone. Be objective and precise."
      : "You are a 3D Product Modeler. Describe this object's geometry, materials, textures, label details, reflection properties, and colors in extreme detail so it can be recreated digitally.";

    const parts = base64Images.slice(0, 3).map(img => ({
      inlineData: {
        mimeType: 'image/jpeg',
        data: img.includes(',') ? img.split(',')[1] : img
      }
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          ...parts,
          { text: prompt }
        ]
      }
    });

    return response.text || "Pas de description générée.";
  } catch (error) {
    console.error("Error analyzing images:", error);
    throw error;
  }
};

/**
 * Generates a new image based on profiles and user prompt.
 */
export const generateBrandVisual = async (
  userPrompt: string,
  mode: GenerationMode,
  user: EntityProfile | null,
  products: EntityProfile[], 
  likedPrompts: string[] = []
): Promise<string> => {
  
  const performGeneration = async () => {
    const imageParts: any[] = [];
    let promptBuilder = "";

    // 1. Image Payload Construction (Max 3 images strictly)
    // Priority: User (1) -> Products (up to 2)
    
    if ((mode === GenerationMode.USER_ONLY || mode === GenerationMode.COMBINED) && user && user.images.length > 0) {
      const rawUser = user.images[0];
      const base64User = rawUser.includes(',') ? rawUser.split(',')[1] : rawUser;
      
      if (base64User) {
        imageParts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64User
          }
        });
        promptBuilder += `Reference Image 1: Main Subject (Person). `;
      }
    }

    if ((mode === GenerationMode.PRODUCT_ONLY || mode === GenerationMode.COMBINED) && products.length > 0) {
      // Limit total images to 3. If we have user, we can take 2 products. If no user, 3 products.
      const maxProducts = imageParts.length > 0 ? 2 : 3;
      const activeProducts = products.slice(0, maxProducts);
      
      activeProducts.forEach((product, index) => {
        if (product.images.length > 0) {
          const rawProd = product.images[0];
          const base64Prod = rawProd.includes(',') ? rawProd.split(',')[1] : rawProd;

          if (base64Prod) {
            imageParts.push({
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Prod
              }
            });
            const imgIndex = imageParts.length; // Current length includes this new one effectively in logic below, but strict index is Length
            promptBuilder += `Reference Image ${imgIndex}: Product (${product.name}). `;
          }
        }
      });
    }

    // 2. Prompt Engineering
    promptBuilder += `\n\nROLE: Professional Commercial Photographer & Digital Artist.`;
    promptBuilder += `\nTASK: Create a photorealistic image based on the user's request.`;
    promptBuilder += `\nUSER REQUEST (Translate to English internally): "${userPrompt}"`;
    
    if (imageParts.length > 0) {
      promptBuilder += `\n\nVISUAL INSTRUCTIONS:`;
      promptBuilder += `\n- Use the provided reference images as the PRIMARY source for the subject's appearance.`;
      promptBuilder += `\n- Seamlessly blend the subjects into the described environment.`;
      promptBuilder += `\n- Ensure consistent lighting matches the scene.`;
    }

    if (likedPrompts.length > 0) {
       promptBuilder += `\n- STYLE PREFERENCE: High fidelity, sharp focus, ${likedPrompts.length} previous likes suggest a preference for professional lighting.`;
    }

    // 3. Execution
    const fullParts = [
      ...imageParts,
      { text: promptBuilder }
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: fullParts,
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });

    const candidate = response.candidates?.[0];
    
    // Safety Check
    if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
       throw new Error(`L'IA a bloqué cette demande en raison de : ${candidate.finishReason}. Essayez de supprimer les descripteurs spécifiques de visage ou les actions complexes.`);
    }

    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData) {
          const base64ImageBytes = part.inlineData.data;
          return `data:image/png;base64,${base64ImageBytes}`;
        }
      }
    }
    
    const textPart = candidate?.content?.parts?.find(p => p.text);
    if (textPart) {
        throw new Error(`Le modèle a renvoyé du texte au lieu d'une image : ${textPart.text}`);
    }
    
    throw new Error("La génération est terminée mais aucune donnée d'image n'a été renvoyée.");
  };

  return retryOperation(performGeneration, 3);
};

/**
 * MAGIC EDITOR: Modifies an existing image based on instruction.
 */
export const editGeneratedVisual = async (
  originalImageUrl: string,
  instruction: string
): Promise<string> => {
  
  const performEdit = async () => {
    const base64Data = originalImageUrl.includes(',') ? originalImageUrl.split(',')[1] : originalImageUrl;
    
    const parts = [
      {
        inlineData: {
          mimeType: 'image/png',
          data: base64Data
        }
      },
      { text: `ROLE: Expert Photo Retoucher.\nTASK: Edit this image. ${instruction}\nCONSTRAINT: Maintain the identity of the person and the look of the product exactly. Only modify what is requested.` }
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: {
        imageConfig: { aspectRatio: "1:1" }
      }
    });

    const candidate = response.candidates?.[0];
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData) {
           return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error("L'édition a échoué.");
  };
  return retryOperation(performEdit, 2);
};

/**
 * EXPORT STUDIO: Expands image to new format (Outpainting).
 */
export const expandImageForFormat = async (
  originalImageUrl: string,
  format: ExportFormat
): Promise<string> => {
  
  const performExpansion = async () => {
    const base64Data = originalImageUrl.includes(',') ? originalImageUrl.split(',')[1] : originalImageUrl;
    
    const parts = [
      {
        inlineData: {
          mimeType: 'image/png',
          data: base64Data
        }
      },
      { text: `ROLE: Digital Artist.\nTASK: Expand the canvas of this image to fit a ${format} aspect ratio for social media use.\nINSTRUCTION: Seamlessly extend the background. Do NOT distort or crop the central subject/product. Keep the style consistent.` }
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: {
        imageConfig: { aspectRatio: format }
      }
    });

    const candidate = response.candidates?.[0];
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData) {
           return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error("L'exportation a échoué.");
  };
  return retryOperation(performExpansion, 2);
};

/**
 * CREATES A MASTER PROMPT
 */
export const refinePrompt = async (roughIdea: string, context?: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `
        You are a World-Class Prompt Engineer for AI Image Generators.
        Your task: Take the user's rough idea (which might be in French) and convert it into an ENGLISH "Master Prompt" optimized for photorealism.
        
        User's Rough Idea: "${roughIdea}"
        Context: ${context || 'General scene'}
        
        Format the output as a single, dense, highly detailed paragraph in ENGLISH.
        Include specific keywords for:
        - Subject details (pose, expression)
        - Lighting (e.g., volumetric, cinematic, golden hour, studio softbox)
        - Camera/Lens (e.g., 85mm, f/1.8, depth of field, bokeh)
        - Art Style (e.g., Hyper-realistic, 8k, Unreal Engine 5 render, Vogue editorial)
        - Color Grading
        
        Output ONLY the English prompt text. No intro or explanation.
      `,
    });
    return response.text || roughIdea;
  } catch (e) {
    return roughIdea;
  }
};

export const suggestPrompts = async (
  userDesc: string,
  productDesc: string
): Promise<string[]> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Suggest 3 creative, distinct photo concepts for: Person (${userDesc.substring(0, 50)}...) and Product (${productDesc.substring(0, 50)}...). Return valid JSON array of strings in French.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    
    const text = response.text;
    if (!text) return [];
    return JSON.parse(text);
  } catch (e) {
    return ["Séance photo studio avec éclairage sombre", "Photo lifestyle en extérieur dans la nature", "Composition style urbain moderne"];
  }
};
