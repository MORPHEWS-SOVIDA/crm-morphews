 import { useState, useRef } from 'react';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Badge } from '@/components/ui/badge';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { 
   Play, Pause, Check, Search, Volume2, 
   User, Globe, Sparkles, Loader2 
 } from 'lucide-react';
 import { cn } from '@/lib/utils';
 
 // Top ElevenLabs voices with metadata
 const ELEVENLABS_VOICES = [
   { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger', gender: 'male', accent: 'American', description: 'Confident, friendly male voice', preview: true },
   { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', gender: 'female', accent: 'American', description: 'Warm, professional female voice', preview: true },
   { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura', gender: 'female', accent: 'American', description: 'Gentle, conversational voice', preview: true },
   { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie', gender: 'male', accent: 'Australian', description: 'Friendly Australian accent', preview: true },
   { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', gender: 'male', accent: 'British', description: 'Deep, authoritative British voice', preview: true },
   { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum', gender: 'male', accent: 'Transatlantic', description: 'Smooth, versatile narrator', preview: true },
   { id: 'SAz9YHcvj6GT2YYXdXww', name: 'River', gender: 'non-binary', accent: 'American', description: 'Unique, expressive voice', preview: true },
   { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', gender: 'male', accent: 'American', description: 'Young, energetic voice', preview: true },
   { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', gender: 'female', accent: 'British', description: 'Elegant British female', preview: true },
   { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', gender: 'female', accent: 'American', description: 'Warm, friendly narrator', preview: true },
   { id: 'bIHbv24MWmeRgasZH58o', name: 'Will', gender: 'male', accent: 'American', description: 'Casual, approachable voice', preview: true },
   { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica', gender: 'female', accent: 'American', description: 'Clear, articulate voice', preview: true },
   { id: 'cjVigY5qzO86Huf0OWal', name: 'Eric', gender: 'male', accent: 'American', description: 'Mature, trustworthy voice', preview: true },
   { id: 'iP95p4xoKVk53GoZ742B', name: 'Chris', gender: 'male', accent: 'American', description: 'Energetic, youthful male', preview: true },
   { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian', gender: 'male', accent: 'American', description: 'Deep, resonant voice', preview: true },
   { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', gender: 'male', accent: 'British', description: 'Sophisticated British accent', preview: true },
   { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', gender: 'female', accent: 'British', description: 'Youthful British female', preview: true },
   { id: 'pqHfZKP75CvOlQylNhV4', name: 'Bill', gender: 'male', accent: 'American', description: 'Warm, fatherly voice', preview: true },
   // Brazilian Portuguese voices
   { id: 'ThT5KcBeYPX3keUQqHPh', name: 'Nicole', gender: 'female', accent: 'Brazilian', description: 'Voz feminina brasileira natural', preview: true },
   { id: 'GBv7mTt0atIp3Br8iCZE', name: 'Thomas', gender: 'male', accent: 'Brazilian', description: 'Voz masculina brasileira profissional', preview: true },
 ];
 
 interface VoiceLibraryProps {
   selectedVoiceId?: string | null;
   onSelectVoice: (voiceId: string, voiceName: string) => void;
 }
 
 export function VoiceLibrary({ selectedVoiceId, onSelectVoice }: VoiceLibraryProps) {
   const [searchQuery, setSearchQuery] = useState('');
   const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
   const [loadingVoiceId, setLoadingVoiceId] = useState<string | null>(null);
   const [genderFilter, setGenderFilter] = useState<string | null>(null);
   const audioRef = useRef<HTMLAudioElement | null>(null);
 
   const filteredVoices = ELEVENLABS_VOICES.filter(voice => {
     const matchesSearch = voice.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
       voice.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
       voice.accent.toLowerCase().includes(searchQuery.toLowerCase());
     const matchesGender = !genderFilter || voice.gender === genderFilter;
     return matchesSearch && matchesGender;
   });
 
   const playPreview = async (voiceId: string, voiceName: string) => {
     // Stop current audio if playing
     if (audioRef.current) {
       audioRef.current.pause();
       audioRef.current = null;
     }
 
     if (playingVoiceId === voiceId) {
       setPlayingVoiceId(null);
       return;
     }
 
     setLoadingVoiceId(voiceId);
 
     try {
       // Use ElevenLabs preview URL
       const previewUrl = `https://api.elevenlabs.io/v1/voices/${voiceId}/preview`;
       
       const audio = new Audio(previewUrl);
       audioRef.current = audio;
       
       audio.onended = () => {
         setPlayingVoiceId(null);
       };
       
       audio.oncanplaythrough = () => {
         setLoadingVoiceId(null);
         setPlayingVoiceId(voiceId);
         audio.play();
       };
 
       audio.onerror = () => {
         setLoadingVoiceId(null);
         // Fallback: just select without preview
         console.log('Preview not available for this voice');
       };
 
       audio.load();
     } catch (error) {
       setLoadingVoiceId(null);
       console.error('Error playing preview:', error);
     }
   };
 
   const stopPreview = () => {
     if (audioRef.current) {
       audioRef.current.pause();
       audioRef.current = null;
     }
     setPlayingVoiceId(null);
   };
 
   return (
     <Card>
       <CardHeader className="pb-3">
         <CardTitle className="text-base flex items-center gap-2">
           <Volume2 className="h-4 w-4" />
           Biblioteca de Vozes
         </CardTitle>
         <CardDescription>
           Escolha uma voz para seu agente de atendimento
         </CardDescription>
       </CardHeader>
       <CardContent className="space-y-4">
         {/* Search and Filters */}
         <div className="flex gap-2">
           <div className="relative flex-1">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
             <Input
               placeholder="Buscar por nome, sotaque..."
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="pl-9"
             />
           </div>
           <div className="flex gap-1">
             <Button
               variant={genderFilter === null ? 'default' : 'outline'}
               size="sm"
               onClick={() => setGenderFilter(null)}
             >
               Todos
             </Button>
             <Button
               variant={genderFilter === 'female' ? 'default' : 'outline'}
               size="sm"
               onClick={() => setGenderFilter('female')}
             >
               <User className="h-3 w-3 mr-1" />
               Feminino
             </Button>
             <Button
               variant={genderFilter === 'male' ? 'default' : 'outline'}
               size="sm"
               onClick={() => setGenderFilter('male')}
             >
               <User className="h-3 w-3 mr-1" />
               Masculino
             </Button>
           </div>
         </div>
 
         {/* Voice Grid */}
         <ScrollArea className="h-[400px] pr-4">
           <div className="grid gap-2 md:grid-cols-2">
             {filteredVoices.map((voice) => (
               <div
                 key={voice.id}
                 className={cn(
                   "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                   selectedVoiceId === voice.id 
                     ? "border-primary bg-primary/5 ring-1 ring-primary" 
                     : "hover:border-primary/50 hover:bg-muted/50"
                 )}
                 onClick={() => onSelectVoice(voice.id, voice.name)}
               >
                 {/* Play Button */}
                 <Button
                   variant="ghost"
                   size="icon"
                   className="shrink-0 h-10 w-10"
                   onClick={(e) => {
                     e.stopPropagation();
                     if (playingVoiceId === voice.id) {
                       stopPreview();
                     } else {
                       playPreview(voice.id, voice.name);
                     }
                   }}
                 >
                   {loadingVoiceId === voice.id ? (
                     <Loader2 className="h-4 w-4 animate-spin" />
                   ) : playingVoiceId === voice.id ? (
                     <Pause className="h-4 w-4" />
                   ) : (
                     <Play className="h-4 w-4" />
                   )}
                 </Button>
 
                 {/* Voice Info */}
                 <div className="flex-1 min-w-0">
                   <div className="flex items-center gap-2">
                     <span className="font-medium">{voice.name}</span>
                     {selectedVoiceId === voice.id && (
                       <Check className="h-4 w-4 text-primary" />
                     )}
                   </div>
                   <p className="text-xs text-muted-foreground truncate">
                     {voice.description}
                   </p>
                   <div className="flex items-center gap-2 mt-1">
                     <Badge variant="outline" className="text-xs px-1.5 py-0">
                       <Globe className="h-3 w-3 mr-1" />
                       {voice.accent}
                     </Badge>
                     <Badge variant="secondary" className="text-xs px-1.5 py-0 capitalize">
                       {voice.gender === 'male' ? 'Masculino' : voice.gender === 'female' ? 'Feminino' : 'Neutro'}
                     </Badge>
                   </div>
                 </div>
               </div>
             ))}
           </div>
         </ScrollArea>
 
         {/* Custom Voice */}
         <div className="pt-2 border-t">
           <p className="text-xs text-muted-foreground flex items-center gap-1">
             <Sparkles className="h-3 w-3" />
             Quer uma voz personalizada? Clone sua voz em{' '}
             <a 
               href="https://elevenlabs.io/voice-lab" 
               target="_blank" 
               rel="noopener noreferrer"
               className="text-primary hover:underline"
             >
               elevenlabs.io/voice-lab
             </a>
           </p>
         </div>
       </CardContent>
     </Card>
   );
 }