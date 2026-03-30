/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { 
  Sparkles, 
  Image as ImageIcon, 
  Film,
  Download, 
  Loader2, 
  Wand2, 
  RefreshCw,
  Info,
  Maximize2,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Mic2,
  Trash2,
  Volume2,
  Upload,
  Clapperboard,
  Share2,
  ChevronRight,
  Book,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

// Types
interface GeneratedAsset {
  type: 'image' | 'sequence' | 'audio' | 'ebook';
  url?: string;
  urls?: string[]; // For sequences
  prompt: string;
  enhancedPrompt: string;
  timestamp: number;
  ebookData?: EbookData;
}

interface EbookData {
  title: string;
  author: string;
  chapters: {
    title: string;
    content: string;
    imageUrl?: string;
  }[];
}

const STYLES = [
  { id: 'cinematic', name: 'Cinematográfico', suffix: 'estilo cinematográfico, iluminação dramática, 85mm, f/1.8' },
  { id: 'hyperreal', name: 'Hiper-realista', suffix: 'hiper-realista, ultra HD 8K, texturas de pele realistas, detalhes minuciosos' },
  { id: '3d', name: '3D Render', suffix: '3D render, Octane Render, Unreal Engine 5, Ray Tracing, volumétrico' },
  { id: 'anime', name: 'Anime', suffix: 'estilo anime moderno, cores vibrantes, traços limpos, Makoto Shinkai style' },
  { id: 'oil', name: 'Pintura a Óleo', suffix: 'pintura a óleo clássica, pinceladas visíveis, textura de tela, luz de Rembrandt' },
];

const VOICES = [
  { id: 'Puck', name: 'Puck (Juvenil)', gender: 'Masculino' },
  { id: 'Charon', name: 'Charon (Sério)', gender: 'Masculino' },
  { id: 'Kore', name: 'Kore (Suave)', gender: 'Feminino' },
  { id: 'Fenrir', name: 'Fenrir (Profundo)', gender: 'Masculino' },
  { id: 'Zephyr', name: 'Zephyr (Claro)', gender: 'Feminino' },
  { id: 'Fenrir', name: 'Diabo Sexy', gender: 'Masculino', style: 'Say with an extremely deep, ultra-masculine, gravelly and seductive devilish voice, very slow and commanding: ' },
  { id: 'Kore', name: 'Bruxa Sombria', gender: 'Feminino', style: 'Say with a raspy, mysterious and slightly wicked witch voice: ' },
  { id: 'Charon', name: 'Narrador Épico', gender: 'Masculino', style: 'Say with a powerful, dramatic and epic narrator voice: ' },
  { id: 'Puck', name: 'Criança Curiosa', gender: 'Masculino', style: 'Say with a high-pitched, energetic and innocent child voice: ' },
  { id: 'Zephyr', name: 'Executiva Elegante', gender: 'Feminino', style: 'Say with a professional, calm and sophisticated corporate voice: ' },
  { id: 'Charon', name: 'Robô Futurista', gender: 'Masculino', style: 'Say with a monotone, metallic and precise robotic voice: ' },
  { id: 'Fenrir', name: 'Velho Sábio', gender: 'Masculino', style: 'Say with a slow, gravelly and warm elderly voice: ' },
  { id: 'Kore', name: 'Garota de Anime', gender: 'Feminino', style: 'Say with a high-pitched, cute and expressive anime girl voice: ' },
  { id: 'Zephyr', name: 'Repórter de TV', gender: 'Feminino', style: 'Say with a fast-paced, clear and authoritative news reporter voice: ' },
  { id: 'Fenrir', name: 'Vilão de Cinema', gender: 'Masculino', style: 'Say with a deep, menacing and cold cinematic villain voice: ' },
  { id: 'Kore', name: 'Fada Encantada', gender: 'Feminino', style: 'Say with a light, airy and magical fairy voice: ' },
  { id: 'Charon', name: 'Locutor de Rádio', gender: 'Masculino', style: 'Say with a smooth, resonant and professional radio broadcaster voice: ' },
  { id: 'Zephyr', name: 'Mãe Acolhedora', gender: 'Feminino', style: 'Say with a warm, gentle and loving motherly voice: ' },
  { id: 'Fenrir', name: 'Soldado em Combate', gender: 'Masculino', style: 'Say with a breathless, intense and gritty soldier voice: ' },
  { id: 'Kore', name: 'Professora Doce', gender: 'Feminino', style: 'Say with a patient, clear and kind teacher voice: ' },
  { id: 'Charon', name: 'Médico Especialista', gender: 'Masculino', style: 'Say with a calm, analytical and reassuring medical professional voice: ' },
  { id: 'Zephyr', name: 'Atleta Motivado', gender: 'Feminino', style: 'Say with a breathless, high-energy and determined athlete voice: ' },
  { id: 'Puck', name: 'Criança Chorando', gender: 'Masculino', style: 'Say with a sobbing, shaky and emotional crying child voice: ' },
  { id: 'Kore', name: 'Sussurro Misterioso', gender: 'Feminino', style: 'Say with a very quiet, breathy and secretive whispering voice: ' },
];

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

// Utility to convert raw PCM to WAV
const pcmToWav = (pcmBase64: string, sampleRate: number = 24000) => {
  const binaryString = window.atob(pcmBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const buffer = new ArrayBuffer(44 + bytes.length);
  const view = new DataView(buffer);

  // RIFF identifier
  view.setUint32(0, 0x52494646, false); // "RIFF"
  // file length
  view.setUint32(4, 36 + bytes.length, true);
  // RIFF type
  view.setUint32(8, 0x57415645, false); // "WAVE"
  // format chunk identifier
  view.setUint32(12, 0x666d7420, false); // "fmt "
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, 1, true);
  // channel count
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * 2, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  view.setUint32(36, 0x64617461, false); // "data"
  // data chunk length
  view.setUint32(40, bytes.length, true);

  // write the PCM data
  for (let i = 0; i < bytes.length; i++) {
    view.setUint8(44 + i, bytes[i]);
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
};

export default function App() {
  const [mode, setMode] = useState<'image' | 'sequence' | 'tts' | 'generator' | 'ebook'>('image');
  const [prompt, setPrompt] = useState('');
  const [idea, setIdea] = useState('');
  const [ebookIdea, setEbookIdea] = useState('');
  const [ebookAuthorName, setEbookAuthorName] = useState('');
  const [ebookFooterName, setEbookFooterName] = useState('Visionary Studio AI');
  const [generatorTarget, setGeneratorTarget] = useState<'image' | 'sequence' | 'tts'>('image');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentAsset, setCurrentAsset] = useState<GeneratedAsset | null>(null);
  const [history, setHistory] = useState<GeneratedAsset[]>([]);
  const [selectedStyle, setSelectedStyle] = useState(STYLES[0]);
  const [showEnhanced, setShowEnhanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isMultiSpeaker, setIsMultiSpeaker] = useState(false);
  const [secondVoice, setSecondVoice] = useState(VOICES[1]);
  
  // Sequence Player State
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  const [selectedVoice, setSelectedVoice] = useState(VOICES[2]);
  const [isTtsGenerating, setIsTtsGenerating] = useState(false);
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);

  const enhancePromptWithAI = async (isStandalone = false) => {
    const textToEnhance = isStandalone ? idea : prompt;
    const target = isStandalone ? generatorTarget : mode;
    
    if (!textToEnhance.trim()) return;
    setIsEnhancingPrompt(true);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Atue como um mestre de engenharia de prompts. Transforme o texto abaixo em um prompt profissional, altamente detalhado e visualmente/emocionalmente impactante para ${target === 'image' ? 'geração de imagem' : target === 'sequence' ? 'sequência cinematográfica' : 'narrativa de áudio'}.
        
        Siga este algoritmo de criação:
        1. DOR: Identifique o conflito, a solidão ou o desafio no prompt original e amplifique-o para criar profundidade.
        2. EMOÇÃO: Adicione camadas de sentimentos humanos complexos (nostalgia, medo, esperança, melancolia).
        3. ALEGRIA: Finalize com um elemento de brilho, resolução ou beleza transcendente que traga impacto positivo.
        
        Escreva o prompt final SEMPRE em PORTUGUÊS (PT-BR), garantindo que seja rico em detalhes, poético e impactante.
        Retorne APENAS o texto do prompt final, sem explicações.
        
        Texto original: "${textToEnhance}"`,
      });
      
      if (response.text) {
        const enhanced = response.text.trim();
        if (isStandalone) {
          setPrompt(enhanced);
          // Optionally switch mode after generation? 
          // Let's stay in generator mode so they can see it first.
        } else {
          setPrompt(enhanced);
        }
      }
    } catch (err) {
      console.error('Erro ao melhorar prompt:', err);
      setError('Não foi possível melhorar o prompt agora. Tente novamente.');
    } finally {
      setIsEnhancingPrompt(false);
    }
  };

  // Auto-play sequence
  useEffect(() => {
    let interval: NodeJS.Timeout;
    let animationFrame: number;
    let lastTime = Date.now();

    if (mode === 'sequence' && currentAsset?.type === 'sequence' && isPlaying && currentAsset.urls) {
      interval = setInterval(() => {
        setCurrentFrame((prev) => (prev + 1) % currentAsset.urls!.length);
      }, 3000);
    }
    return () => {
      clearInterval(interval);
      cancelAnimationFrame(animationFrame);
    };
  }, [currentAsset, isPlaying, mode]);

  const enhancePrompt = (basePrompt: string, variation?: string) => {
    const styleSuffix = selectedStyle.suffix;
    const baseEnhancement = `${styleSuffix}, ultra HD, 8K, extremamente detalhado, foco nítido, iluminação profissional, profundidade de campo, reflexos naturais, renderização profissional, qualidade de estúdio, composição perfeita.`;
    
    if (mode === 'sequence' && variation) {
      return `${basePrompt}, ${variation}, ${baseEnhancement}`;
    }
    return `${basePrompt}, ${baseEnhancement}`;
  };

  const generateAsset = async () => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    setError(null);
    setCurrentFrame(0);
    setIsPlaying(true);
    
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    try {
      if (mode === 'tts') {
        await generateTts();
        return;
      }
      if (mode === 'image') {
        setStatusMessage('Iniciando visão...');
        const enhanced = enhancePrompt(prompt);
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: [{ text: enhanced }] },
          config: { imageConfig: { aspectRatio: "1:1" } },
        });

        let imageUrl = '';
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            imageUrl = `data:image/png;base64,${part.inlineData.data}`;
            break;
          }
        }

        if (imageUrl) {
          const newAsset: GeneratedAsset = {
            type: 'image',
            url: imageUrl,
            prompt: prompt,
            enhancedPrompt: enhanced,
            timestamp: Date.now(),
          };
          setCurrentAsset(newAsset);
          setHistory(prev => [newAsset, ...prev].slice(0, 10));
        } else {
          throw new Error('Nenhuma imagem foi gerada.');
        }
      } else if (mode === 'sequence') {
        setStatusMessage('Roteirizando sequência...');
        const variations = [
          'establishing shot, wide angle, introduction of the scene',
          'medium shot, focus on details, action starting',
          'close up, emotional climax, dramatic lighting'
        ];
        
        const urls: string[] = [];
        for (let i = 0; i < variations.length; i++) {
          setStatusMessage(`Gerando cena ${i + 1} de 3...`);
          const enhanced = enhancePrompt(prompt, variations[i]);
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: enhanced }] },
            config: { imageConfig: { aspectRatio: "1:1" } },
          });

          for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
              urls.push(`data:image/png;base64,${part.inlineData.data}`);
              break;
            }
          }
        }

        if (urls.length > 0) {
          const newAsset: GeneratedAsset = {
            type: 'sequence',
            urls: urls,
            prompt: prompt,
            enhancedPrompt: enhancePrompt(prompt),
            timestamp: Date.now(),
          };
          setCurrentAsset(newAsset);
          setHistory(prev => [newAsset, ...prev].slice(0, 10));
        } else {
          throw new Error('Falha ao gerar a sequência de imagens.');
        }
      }
    } catch (err: any) {
      console.error('Erro ao gerar asset:', err);
      const errorMessage = err.message || '';
      if (errorMessage.includes("Requested entity was not found") || 
          errorMessage.includes("permission") || 
          errorMessage.includes("403")) {
        setError('Erro de permissão ou autenticação. Selecione uma chave de API paga para este recurso.');
      } else {
        setError(errorMessage || 'Ocorreu um erro. Tente novamente.');
      }
    } finally {
      setIsGenerating(false);
      setStatusMessage('');
    }
  };

  const generateTts = async () => {
    const textToNarrate = prompt;
    if (!textToNarrate.trim()) return;
    
    setIsTtsGenerating(true);
    setIsGenerating(true);
    setError(null);
    setStatusMessage('Narrando texto...');
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const config: any = {
        responseModalities: [Modality.AUDIO],
        speechConfig: {}
      };

      if (isMultiSpeaker) {
        config.speechConfig.multiSpeakerVoiceConfig = {
          speakerVoiceConfigs: [
            {
              speaker: 'Personagem 1',
              voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice.id } }
            },
            {
              speaker: 'Personagem 2',
              voiceConfig: { prebuiltVoiceConfig: { voiceName: secondVoice.id } }
            }
          ]
        };
      } else {
        config.speechConfig.voiceConfig = {
          prebuiltVoiceConfig: { voiceName: selectedVoice.id }
        };
      }

      let finalPrompt = textToNarrate;
      if (isMultiSpeaker) {
        let instructions = "TTS the following conversation. ";
        if ((selectedVoice as any).style) instructions += `Personagem 1 should ${(selectedVoice as any).style.replace('Say ', '').replace(':', '')}. `;
        if ((secondVoice as any).style) instructions += `Personagem 2 should ${(secondVoice as any).style.replace('Say ', '').replace(':', '')}. `;
        finalPrompt = `${instructions}\n${textToNarrate}`;
      } else if ((selectedVoice as any).style) {
        finalPrompt = `${(selectedVoice as any).style}${textToNarrate}`;
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: finalPrompt }] }],
        config: config,
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioUrl = pcmToWav(base64Audio);
        const newAsset: GeneratedAsset = {
          type: 'audio',
          url: audioUrl,
          prompt: textToNarrate,
          enhancedPrompt: isMultiSpeaker ? `Diálogo: ${selectedVoice.name} & ${secondVoice.name}` : `Voz: ${selectedVoice.name}`,
          timestamp: Date.now(),
        };
        
        setCurrentAsset(newAsset);
        setHistory(prev => [newAsset, ...prev].slice(0, 10));
      }
    } catch (err: any) {
      console.error('TTS Error:', err);
      setError('Erro ao gerar narrativa. Verifique se o formato do diálogo está correto (ex: "P1: Olá. P2: Oi.") se estiver usando múltiplos personagens.');
    } finally {
      setIsTtsGenerating(false);
      setIsGenerating(false);
      setStatusMessage('');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      
      const newAsset: GeneratedAsset = {
        type: 'image',
        url: url,
        prompt: `Upload: ${file.name}`,
        enhancedPrompt: `Arquivo local: ${file.name}`,
        timestamp: Date.now(),
      };

      setHistory(prev => [newAsset, ...prev].slice(0, 20));
    };
    reader.readAsDataURL(file);
  };

  const generateEbook = async () => {
    if (!ebookIdea.trim()) return;
    setIsGenerating(true);
    setStatusMessage('Criando estrutura do E-book...');
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const structureResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Crie um e-book realista e envolvente baseado na ideia: "${ebookIdea}". 
        O e-book deve ter um título, um autor fictício ${ebookAuthorName ? `(use o nome "${ebookAuthorName}")` : ''} e exatamente 10 capítulos curtos e envolventes.
        Para cada capítulo, forneça:
        1. Título do capítulo.
        2. Conteúdo do texto (pelo menos 2 parágrafos).
        3. Um prompt detalhado em INGLÊS para gerar uma imagem cinematográfica que ilustre este capítulo.
        
        Retorne o resultado estritamente em formato JSON seguindo este esquema:
        {
          "title": "Título do E-book",
          "author": "Nome do Autor",
          "chapters": [
            {
              "title": "Título do Capítulo",
              "content": "Texto do capítulo...",
              "imagePrompt": "Detailed English prompt for the image"
            }
          ]
        }`,
        config: { responseMimeType: "application/json" }
      });

      const ebookRaw = JSON.parse(structureResponse.text);
      const chaptersWithImages = [];

      for (let i = 0; i < ebookRaw.chapters.length; i++) {
        const chapter = ebookRaw.chapters[i];
        setStatusMessage(`Gerando ilustração ${i + 1} de ${ebookRaw.chapters.length}...`);
        
        const imageResponse = await ai.models.generateContent({
          model: "gemini-2.5-flash-image",
          contents: { parts: [{ text: chapter.imagePrompt }] },
          config: { imageConfig: { aspectRatio: "16:9" } }
        });

        let imageUrl = '';
        for (const part of imageResponse.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            imageUrl = `data:image/png;base64,${part.inlineData.data}`;
            break;
          }
        }

        chaptersWithImages.push({
          title: chapter.title,
          content: chapter.content,
          imageUrl: imageUrl
        });
      }

      const ebookData: EbookData = {
        title: ebookRaw.title,
        author: ebookRaw.author,
        chapters: chaptersWithImages
      };

      const newAsset: GeneratedAsset = {
        type: 'ebook',
        prompt: ebookIdea,
        enhancedPrompt: ebookIdea,
        timestamp: Date.now(),
        ebookData: ebookData
      };

      setCurrentAsset(newAsset);
      setHistory(prev => [newAsset, ...prev].slice(0, 10));
    } catch (err: any) {
      console.error('Erro ao gerar E-book:', err);
      setError('Falha ao gerar o E-book. Verifique sua conexão e tente novamente.');
    } finally {
      setIsGenerating(false);
      setStatusMessage('');
    }
  };

  const downloadEbook = (asset: GeneratedAsset) => {
    if (asset.type !== 'ebook' || !asset.ebookData) return;
    const data = asset.ebookData;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${data.title}</title>
        <style>
          body { font-family: 'Georgia', serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 40px; background: #fdfdfd; }
          h1 { text-align: center; font-size: 3em; margin-bottom: 10px; color: #1a1a1a; }
          .author { text-align: center; font-style: italic; color: #666; margin-bottom: 50px; border-bottom: 1px solid #eee; padding-bottom: 20px; }
          .chapter { margin-bottom: 60px; page-break-before: always; }
          h2 { font-size: 2em; color: #d97706; border-left: 4px solid #d97706; padding-left: 15px; margin-bottom: 30px; }
          img { width: 100%; border-radius: 12px; margin-bottom: 25px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
          p { margin-bottom: 20px; text-align: justify; font-size: 1.1em; }
          .footer { text-align: center; font-size: 0.8em; color: #999; margin-top: 100px; border-top: 1px solid #eee; padding-top: 20px; }
        </style>
      </head>
      <body>
        <h1>${data.title}</h1>
        <div class="author">Por ${data.author}</div>
        
        ${data.chapters.map((ch, i) => `
          <div class="chapter">
            <h2>Capítulo ${i + 1}: ${ch.title}</h2>
            ${ch.imageUrl ? `<img src="${ch.imageUrl}" alt="${ch.title}">` : ''}
            <div>${ch.content.split('\n').map(p => `<p>${p}</p>`).join('')}</div>
          </div>
        `).join('')}
        
        <div class="footer">Gerado por ${ebookFooterName}</div>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${data.title.replace(/\s+/g, '-').toLowerCase()}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAsset = (asset: GeneratedAsset) => {
    if (asset.type === 'ebook') {
      downloadEbook(asset);
      return;
    }
    if (asset.type === 'sequence' && asset.urls) {
      asset.urls.forEach((url, i) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = `visionary-sequence-${i + 1}-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
    } else if (asset.url) {
      const link = document.createElement('a');
      link.href = asset.url;
      link.download = `visionary-ai-${asset.type}-${Date.now()}.${asset.type === 'image' ? 'png' : asset.type === 'audio' ? 'mp3' : 'mp4'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0502] text-stone-100 font-sans selection:bg-orange-500/30">
      {/* Background Atmosphere */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-orange-900/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-stone-900/40 blur-[150px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8 lg:py-12">
        {/* Navigation / Mode Switcher */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                <Clapperboard className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tighter text-white">VISIONARY <span className="text-orange-500">STUDIO</span></span>
            </div>
            <div className="h-6 w-px bg-white/10" />
            <nav className="flex p-1 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10">
              {[
                { id: 'image', icon: ImageIcon, label: 'Imagem' },
                { id: 'sequence', icon: Film, label: 'Sequência' },
                { id: 'tts', icon: Mic2, label: 'Narrativa' },
                { id: 'generator', icon: Sparkles, label: 'Gerador' },
                { id: 'ebook', icon: Book, label: 'E-book' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id as any)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl transition-all text-[11px] uppercase tracking-wider font-bold",
                    mode === m.id ? "bg-white text-black shadow-lg" : "text-stone-500 hover:text-stone-300"
                  )}
                >
                  <m.icon className="w-3.5 h-3.5" />
                  {m.label}
                </button>
              ))}
            </nav>
          </div>
          
          <div className="flex items-center gap-4">
            <label className="cursor-pointer p-3 bg-white/5 border border-white/10 rounded-2xl text-stone-400 hover:text-white transition-colors">
              <Upload className="w-5 h-5" />
              <input 
                type="file" 
                className="hidden" 
                accept="image/*" 
                onChange={handleFileUpload}
              />
            </label>
            <button className="p-3 bg-white/5 border border-white/10 rounded-2xl text-stone-400 hover:text-white transition-colors">
              <Share2 className="w-5 h-5" />
            </button>
            <button className="px-6 py-3 bg-white text-black rounded-2xl text-sm font-bold hover:scale-105 transition-transform">
              MEUS PROJETOS
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* Left Column: Controls */}
            <div className="lg:col-span-5 space-y-8">
              <header className="space-y-4">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur-md"
                >
                  <Sparkles className="w-4 h-4 text-orange-400" />
                  <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-stone-400">Visionary Engine v3.5</span>
                </motion.div>
                <motion.h1 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-5xl lg:text-7xl font-light tracking-tighter leading-[0.9] text-white"
                >
                  Crie <br />
                  <span className="italic font-serif text-orange-400">
                    {mode === 'image' ? 'Imagens' : mode === 'sequence' ? 'Sequências' : mode === 'tts' ? 'Narrativas' : mode === 'ebook' ? 'E-books' : 'Prompts'}
                  </span> <br />
                  Épicos.
                </motion.h1>
              </header>

              <section className="space-y-6 bg-white/5 border border-white/10 p-8 rounded-[32px] backdrop-blur-xl">
                {mode === 'generator' ? (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[11px] uppercase tracking-widest font-semibold text-stone-500">
                        Sua Ideia
                      </label>
                      <textarea
                        value={idea}
                        onChange={(e) => setIdea(e.target.value)}
                        placeholder="Ex: Um astronauta perdido em um jardim de cristais..."
                        className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-lg focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all min-h-[120px] resize-none placeholder:text-stone-700"
                      />
                    </div>

                    <div className="space-y-4">
                      <label className="text-[11px] uppercase tracking-widest font-semibold text-stone-500">
                        Tipo de Prompt
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'image', label: 'Imagem', icon: ImageIcon },
                          { id: 'sequence', label: 'Sequência', icon: Film },
                          { id: 'tts', label: 'Narrativa', icon: Mic2 },
                        ].map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setGeneratorTarget(t.id as any)}
                            className={cn(
                              "flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all",
                              generatorTarget === t.id 
                                ? "bg-orange-500 border-orange-400 text-white shadow-lg shadow-orange-500/20" 
                                : "bg-white/5 border-white/10 text-stone-400 hover:bg-white/10"
                            )}
                          >
                            <t.icon className="w-5 h-5" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">{t.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl space-y-2">
                      <div className="flex items-center gap-2 text-orange-400">
                        <Sparkles className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Algoritmo Ativo</span>
                      </div>
                      <p className="text-[10px] text-stone-400 leading-relaxed">
                        Seu prompt será otimizado usando o framework <span className="text-white font-bold">Dor • Emoção • Alegria</span> para máximo impacto visual e narrativo.
                      </p>
                    </div>
                  </div>
                ) : mode === 'ebook' ? (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[11px] uppercase tracking-widest font-semibold text-stone-500">
                        Ideia do E-book
                      </label>
                      <textarea
                        value={ebookIdea}
                        onChange={(e) => setEbookIdea(e.target.value)}
                        placeholder="Ex: Uma história sobre um dragão que não conseguia soltar fogo, mas descobriu um poder maior..."
                        className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-lg focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all min-h-[120px] resize-none placeholder:text-stone-700"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[11px] uppercase tracking-widest font-semibold text-stone-500">
                          Nome do Autor (Opcional)
                        </label>
                        <input
                          type="text"
                          value={ebookAuthorName}
                          onChange={(e) => setEbookAuthorName(e.target.value)}
                          placeholder="Ex: Seu Nome Artístico"
                          className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all placeholder:text-stone-700"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[11px] uppercase tracking-widest font-semibold text-stone-500">
                          Assinatura no Rodapé
                        </label>
                        <input
                          type="text"
                          value={ebookFooterName}
                          onChange={(e) => setEbookFooterName(e.target.value)}
                          placeholder="Ex: Visionary Studio AI"
                          className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all placeholder:text-stone-700"
                        />
                      </div>
                    </div>

                    <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl space-y-2">
                      <div className="flex items-center gap-2 text-orange-400">
                        <Book className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Algoritmo de E-book</span>
                      </div>
                      <p className="text-[10px] text-stone-400 leading-relaxed">
                        Geramos automaticamente capítulos, textos envolventes e ilustrações cinematográficas para cada parte da sua história.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2 relative">
                      <label className="text-[11px] uppercase tracking-widest font-semibold text-stone-500 flex justify-between">
                        Seu Prompt
                        <span className="text-orange-400/60 lowercase italic font-serif">
                          {mode === 'sequence' ? 'descreva uma história' : 'seja descritivo'}
                        </span>
                      </label>
                      <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={
                          mode === 'image' ? "Ex: Um leão futurista no espaço..." : 
                          mode === 'sequence' ? "Ex: A jornada de um robô descobrindo a natureza..." :
                          "Ex: P1: Olá, bem-vindo ao Visionary Studio. P2: Obrigado! Vamos criar algo incrível hoje."
                        }
                        className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-lg focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all min-h-[120px] resize-none placeholder:text-stone-700"
                      />
                      <button
                        onClick={() => enhancePromptWithAI(false)}
                        disabled={isEnhancingPrompt || !prompt.trim()}
                        className={cn(
                          "absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border",
                          isEnhancingPrompt 
                            ? "bg-stone-800 border-stone-700 text-stone-500 cursor-wait" 
                            : "bg-orange-500/20 border-orange-500/30 text-orange-400 hover:bg-orange-500 hover:text-white"
                        )}
                      >
                        {isEnhancingPrompt ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Melhorando...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3" />
                            Melhorar com IA
                          </>
                        )}
                      </button>
                    </div>

                    {mode !== 'tts' && (
                      <div className="space-y-4">
                        <label className="text-[11px] uppercase tracking-widest font-semibold text-stone-500">
                          Estilo Visual
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {STYLES.map((style) => (
                            <button
                              key={style.id}
                              onClick={() => setSelectedStyle(style)}
                              className={cn(
                                "px-4 py-2 rounded-full text-xs transition-all border",
                                selectedStyle.id === style.id 
                                  ? "bg-orange-500 border-orange-400 text-white shadow-[0_0_20px_rgba(249,115,22,0.3)]" 
                                  : "bg-white/5 border-white/10 text-stone-400 hover:bg-white/10"
                              )}
                            >
                              {style.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {mode === 'tts' && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] uppercase tracking-widest font-semibold text-stone-500">
                            Configuração de Voz
                          </label>
                          <button 
                            onClick={() => setIsMultiSpeaker(!isMultiSpeaker)}
                            className={cn(
                              "px-3 py-1 rounded-full text-[10px] font-bold transition-all border",
                              isMultiSpeaker ? "bg-orange-500 border-orange-400 text-white" : "bg-white/5 border-white/10 text-stone-400"
                            )}
                          >
                            {isMultiSpeaker ? 'MÚLTIPLOS PERSONAGENS' : 'PERSONAGEM ÚNICO'}
                          </button>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] text-stone-600 uppercase font-bold">
                              {isMultiSpeaker ? 'Voz do Personagem 1' : 'Voz Principal'}
                            </label>
                            <div className="grid grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-2 scrollbar-hide">
                              {VOICES.map(voice => (
                                <button
                                  key={voice.name}
                                  onClick={() => setSelectedVoice(voice)}
                                  className={cn(
                                    "px-3 py-2 rounded-xl text-[10px] text-left transition-all border",
                                    selectedVoice.name === voice.name 
                                      ? "bg-orange-500 border-orange-400 text-white" 
                                      : "bg-white/5 border-white/10 text-stone-400 hover:bg-white/10"
                                  )}
                                >
                                  <div className="font-bold truncate">{voice.name}</div>
                                  <div className="opacity-60">{voice.gender}</div>
                                </button>
                              ))}
                            </div>
                          </div>

                          {isMultiSpeaker && (
                            <div className="space-y-2">
                              <label className="text-[10px] text-stone-600 uppercase font-bold">Voz do Personagem 2</label>
                              <div className="grid grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-2 scrollbar-hide">
                                {VOICES.map(voice => (
                                  <button
                                    key={voice.name}
                                    onClick={() => setSecondVoice(voice)}
                                    className={cn(
                                      "px-3 py-2 rounded-xl text-[10px] text-left transition-all border",
                                      secondVoice.name === voice.name 
                                        ? "bg-orange-500 border-orange-400 text-white" 
                                        : "bg-white/5 border-white/10 text-stone-400 hover:bg-white/10"
                                    )}
                                  >
                                    <div className="font-bold truncate">{voice.name}</div>
                                    <div className="opacity-60">{voice.gender}</div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {isMultiSpeaker && (
                          <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-start gap-3">
                            <Info className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                            <p className="text-[10px] text-stone-400 leading-relaxed">
                              No modo múltiplos personagens, use o formato de diálogo no texto: <br />
                              <span className="text-white font-mono">"P1: Olá, como vai? P2: Tudo bem, e você?"</span>
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                <div className="pt-4">
                  <button
                    onClick={
                      mode === 'generator' ? () => enhancePromptWithAI(true) : 
                      mode === 'ebook' ? generateEbook : 
                      generateAsset
                    }
                    disabled={
                      (mode === 'generator' ? (isEnhancingPrompt || !idea.trim()) : 
                       mode === 'ebook' ? (isGenerating || !ebookIdea.trim()) : 
                       (isGenerating || !prompt.trim()))
                    }
                    className={cn(
                      "w-full h-16 rounded-2xl flex items-center justify-center gap-3 text-lg font-medium transition-all group relative overflow-hidden",
                      (mode === 'generator' ? (isEnhancingPrompt || !idea.trim()) : 
                       mode === 'ebook' ? (isGenerating || !ebookIdea.trim()) : 
                       (isGenerating || !prompt.trim()))
                        ? "bg-stone-800 text-stone-500 cursor-not-allowed"
                        : "bg-white text-black hover:scale-[1.02] active:scale-[0.98]"
                    )}
                  >
                    {isGenerating || isEnhancingPrompt ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span>{statusMessage || (isEnhancingPrompt ? 'Refinando Ideia...' : 'Processando...')}</span>
                      </>
                    ) : (
                      <>
                        {mode === 'generator' ? (
                          <Sparkles className="w-6 h-6 text-orange-500" />
                        ) : mode === 'ebook' ? (
                          <Book className="w-6 h-6 text-orange-500" />
                        ) : (
                          mode === 'image' ? <Wand2 className="w-6 h-6" /> : mode === 'sequence' ? <Film className="w-6 h-6" /> : <Mic2 className="w-6 h-6" />
                        )}
                        <span>
                          {mode === 'generator' ? 'Gerar Prompt Profissional' : 
                           mode === 'ebook' ? 'Gerar E-book Completo' : 
                           mode === 'image' ? 'Gerar Obra de Arte' : 
                           mode === 'sequence' ? 'Gerar Sequência Animada' : 'Gerar Narrativa AI'}
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                      </>
                    )}
                  </button>

                  {mode === 'generator' && prompt && !isEnhancingPrompt && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Resultado Gerado:</span>
                        <button 
                          onClick={() => setMode(generatorTarget)}
                          className="text-[10px] font-bold uppercase tracking-widest text-orange-400 hover:text-orange-300 flex items-center gap-1"
                        >
                          Ir para {generatorTarget === 'image' ? 'Imagem' : generatorTarget === 'sequence' ? 'Sequência' : 'Narrativa'}
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="text-sm text-stone-300 italic line-clamp-3 bg-black/20 p-3 rounded-xl border border-white/5">
                        "{prompt}"
                      </div>
                    </motion.div>
                  )}
                </div>

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm"
                  >
                    {error}
                  </motion.div>
                )}
              </section>
            </div>

            <div className="lg:col-span-7 flex flex-col gap-8">
              <div className="relative w-full bg-stone-900/40 border border-white/10 rounded-[40px] overflow-hidden flex items-center justify-center group shadow-2xl transition-all duration-500 aspect-square">
                <AnimatePresence mode="wait">
                  {isGenerating || isEnhancingPrompt ? (
                    <motion.div 
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center gap-6 p-12 text-center"
                    >
                      <div className="relative">
                        <div className="w-24 h-24 border-2 border-orange-500/20 rounded-full animate-[spin_3s_linear_infinite]" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <RefreshCw className="w-8 h-8 text-orange-400 animate-spin" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xl font-light text-white">{statusMessage || (isEnhancingPrompt ? 'Refinando sua visão...' : 'Processando...')}</p>
                        <p className="text-sm text-stone-500 italic font-serif">"A arte não reproduz o visível, ela torna visível."</p>
                      </div>
                    </motion.div>
                  ) : mode === 'generator' ? (
                    <motion.div 
                      key="generator-view"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center p-12 text-center space-y-8 w-full h-full bg-stone-900/20"
                    >
                      <div className="w-24 h-24 rounded-full bg-orange-500/10 flex items-center justify-center">
                        <Sparkles className="w-12 h-12 text-orange-400" />
                      </div>
                      <div className="space-y-4 max-w-md">
                        <h2 className="text-2xl font-light text-white tracking-tight">Laboratório de Prompts</h2>
                        <p className="text-sm text-stone-500 leading-relaxed">
                          Transforme ideias simples em comandos poderosos. O algoritmo de <span className="text-orange-400 font-bold">Dor • Emoção • Alegria</span> garante que cada prompt tenha uma narrativa profunda e visualmente deslumbrante.
                        </p>
                      </div>
                      {prompt && (
                        <motion.div 
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="w-full bg-black/40 border border-white/10 rounded-3xl p-8 relative group"
                        >
                          <div className="absolute -top-3 left-6 px-3 py-1 bg-orange-500 rounded-full text-[10px] font-bold uppercase tracking-widest text-white">
                            Prompt Otimizado
                          </div>
                          <p className="text-lg text-stone-200 font-serif italic leading-relaxed">
                            "{prompt}"
                          </p>
                          <div className="mt-6 flex justify-center gap-4">
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(prompt);
                                setStatusMessage('Copiado!');
                                setTimeout(() => setStatusMessage(''), 2000);
                              }}
                              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-stone-400 hover:text-white transition-all"
                            >
                              <Share2 className="w-3 h-3" />
                              Copiar Prompt
                            </button>
                            <button 
                              onClick={() => setMode(generatorTarget)}
                              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 text-white text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-orange-500/20"
                            >
                              <Wand2 className="w-3 h-3" />
                              Usar Agora
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </motion.div>
                  ) : currentAsset ? (
                    <motion.div 
                      key={currentAsset.timestamp}
                      initial={{ opacity: 0, scale: 1.05 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="relative w-full h-full"
                    >
                      {currentAsset.type === 'ebook' && currentAsset.ebookData && (
                        <div className="w-full h-full bg-[#fdfdfd] text-[#333] overflow-y-auto p-8 md:p-12 font-serif">
                          <div className="max-w-2xl mx-auto space-y-12">
                            <header className="text-center space-y-4 border-b border-stone-200 pb-12">
                              <h1 className="text-4xl md:text-6xl font-bold text-stone-900 leading-tight">
                                {currentAsset.ebookData.title}
                              </h1>
                              <p className="text-xl italic text-stone-500">
                                Por {currentAsset.ebookData.author}
                              </p>
                            </header>

                            {currentAsset.ebookData.chapters.map((chapter, idx) => (
                              <section key={idx} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: `${idx * 200}ms` }}>
                                <div className="space-y-2">
                                  <span className="text-sm uppercase tracking-[0.2em] text-orange-600 font-sans font-bold">
                                    Capítulo {idx + 1}
                                  </span>
                                  <h2 className="text-3xl font-bold text-stone-800 border-l-4 border-orange-500 pl-6">
                                    {chapter.title}
                                  </h2>
                                </div>
                                
                                {chapter.imageUrl && (
                                  <div className="relative group">
                                    <img 
                                      src={chapter.imageUrl} 
                                      alt={chapter.title} 
                                      className="w-full aspect-video object-cover rounded-2xl shadow-2xl shadow-stone-900/10 transition-transform duration-700 group-hover:scale-[1.02]" 
                                    />
                                    <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-black/10" />
                                  </div>
                                )}

                                <div className="space-y-6 text-lg leading-relaxed text-stone-700 text-justify first-letter:text-5xl first-letter:font-bold first-letter:mr-3 first-letter:float-left first-letter:text-orange-600">
                                  {chapter.content.split('\n').map((para, pIdx) => (
                                    <p key={pIdx}>{para}</p>
                                  ))}
                                </div>
                                
                                {idx < currentAsset.ebookData!.chapters.length - 1 && (
                                  <div className="flex justify-center py-8">
                                    <div className="w-24 h-px bg-stone-200" />
                                  </div>
                                )}
                              </section>
                            ))}

                            <footer className="text-center pt-12 border-t border-stone-200 text-stone-400 text-sm font-sans">
                              Gerado por {ebookFooterName} • {new Date(currentAsset.timestamp).toLocaleDateString()}
                            </footer>
                          </div>
                        </div>
                      )}

                      {currentAsset.type === 'audio' && currentAsset.url && (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-8 bg-stone-900/40 p-12">
                          <div className="relative">
                            <div className="w-32 h-32 rounded-full bg-orange-500/20 flex items-center justify-center animate-pulse">
                              <Mic2 className="w-12 h-12 text-orange-400" />
                            </div>
                            <div className="absolute -inset-4 border border-orange-500/20 rounded-full animate-[ping_3s_linear_infinite]" />
                          </div>
                          <div className="w-full max-w-md space-y-4">
                            <div className="flex items-center justify-between text-[10px] text-stone-500 uppercase tracking-widest font-bold">
                              <span>Visualizador de Onda</span>
                              <span>AI Narrative Engine</span>
                            </div>
                            <div className="h-12 flex items-center gap-1">
                              {Array.from({ length: 40 }).map((_, i) => (
                                <motion.div
                                  key={i}
                                  animate={{ 
                                    height: [10, Math.random() * 40 + 10, 10],
                                  }}
                                  transition={{ 
                                    duration: 0.5 + Math.random(), 
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                  }}
                                  className="flex-1 bg-orange-500/40 rounded-full"
                                />
                              ))}
                            </div>
                            <audio src={currentAsset.url} controls className="w-full accent-orange-500" />
                          </div>
                        </div>
                      )}

                      {currentAsset.type === 'image' && currentAsset.url && (
                        <img src={currentAsset.url} alt={currentAsset.prompt} className="w-full h-full object-cover" />
                      )}

                      {currentAsset.type === 'sequence' && currentAsset.urls && (
                        <div className="relative w-full h-full">
                          <AnimatePresence mode="wait">
                            <motion.img
                              key={currentFrame}
                              src={currentAsset.urls[currentFrame]}
                              initial={{ opacity: 0, scale: 1.1 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              transition={{ duration: 1.5, ease: "easeInOut" }}
                              className="absolute inset-0 w-full h-full object-cover"
                            />
                          </AnimatePresence>
                          
                          {/* Sequence Controls */}
                          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-3 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setCurrentFrame((prev) => (prev - 1 + currentAsset.urls!.length) % currentAsset.urls!.length)}>
                              <SkipBack className="w-5 h-5 text-white hover:text-orange-400 transition-colors" />
                            </button>
                            <button onClick={() => setIsPlaying(!isPlaying)}>
                              {isPlaying ? <Pause className="w-6 h-6 text-white" /> : <Play className="w-6 h-6 text-white" />}
                            </button>
                            <button onClick={() => setCurrentFrame((prev) => (prev + 1) % currentAsset.urls!.length)}>
                              <SkipForward className="w-5 h-5 text-white hover:text-orange-400 transition-colors" />
                            </button>
                            <div className="w-px h-4 bg-white/20 mx-2" />
                            <span className="text-[10px] font-mono text-white/60">{currentFrame + 1} / {currentAsset.urls.length}</span>
                          </div>
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-8 pointer-events-none">
                        <div className="flex items-center justify-between pointer-events-auto">
                          <div className="space-y-1">
                            <p className="text-white font-medium line-clamp-1">{currentAsset.prompt}</p>
                            <p className="text-stone-400 text-xs uppercase tracking-widest">
                              {currentAsset.type === 'image' ? 'Imagem' : currentAsset.type === 'sequence' ? 'Sequência Animada' : currentAsset.type === 'ebook' ? 'E-book' : 'Narrativa'} • {currentAsset.type === 'audio' ? currentAsset.enhancedPrompt : (currentAsset.type === 'ebook' ? currentAsset.ebookData?.author : selectedStyle.name)}
                            </p>
                          </div>
                          <div className="flex gap-3">
                            <button 
                              onClick={() => {
                                setHistory(prev => prev.filter(h => h.timestamp !== currentAsset.timestamp));
                                setCurrentAsset(null);
                              }}
                              className="w-12 h-12 rounded-full bg-red-500/20 backdrop-blur-md border border-red-500/30 text-red-400 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"
                              title="Apagar"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => downloadAsset(currentAsset)}
                              className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform"
                            >
                              <Download className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center gap-4 text-stone-600"
                    >
                      {mode === 'image' ? <ImageIcon className="w-20 h-20 opacity-20" /> : mode === 'sequence' ? <Film className="w-20 h-20 opacity-20" /> : <Mic2 className="w-20 h-20 opacity-20" />}
                      <p className="text-sm uppercase tracking-[0.3em] font-light">Aguardando sua visão</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* History */}
              {history.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-[11px] uppercase tracking-widest font-semibold text-stone-500">Recentes</h3>
                  <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                    {history.map((asset, idx) => (
                      <motion.button
                        key={asset.timestamp}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        onClick={() => setCurrentAsset(asset)}
                        className={cn(
                          "relative w-32 aspect-square rounded-2xl overflow-hidden flex-shrink-0 border-2 transition-all",
                          currentAsset?.timestamp === asset.timestamp ? "border-orange-500 scale-95" : "border-transparent opacity-60 hover:opacity-100"
                        )}
                      >
                        {asset.type === 'image' && asset.url ? (
                          <img src={asset.url} className="w-full h-full object-cover" alt="" />
                        ) : asset.type === 'sequence' && asset.urls ? (
                          <img src={asset.urls[0]} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <div className="w-full h-full bg-stone-900 flex items-center justify-center">
                            <Volume2 className="w-6 h-6 text-stone-500" />
                          </div>
                        )}
                        {asset.type === 'sequence' && (
                          <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md p-1 rounded-md">
                            <Film className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      {/* Footer */}
      <footer className="relative z-10 py-12 border-t border-white/5 mt-20">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8 text-stone-600 text-xs uppercase tracking-widest">
          <div className="flex items-center gap-4">
            <span>Powered by Gemini 2.5 & Veo 3.1</span>
            <div className="w-1 h-1 rounded-full bg-stone-800" />
            <span>Visionary AI © 2026</span>
          </div>
          <div className="flex gap-8">
            <a href="#" className="hover:text-stone-400 transition-colors">Termos</a>
            <a href="#" className="hover:text-stone-400 transition-colors">Privacidade</a>
            <a href="#" className="hover:text-stone-400 transition-colors">API</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
