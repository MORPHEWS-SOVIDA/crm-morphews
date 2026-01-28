import { useCallback, useRef, useEffect } from 'react';

// Hook para tocar som de notificação
export function useNotificationSound() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastPlayedRef = useRef<number>(0);
  
  // Inicializa o AudioContext quando o usuário interage (necessário para browsers modernos)
  useEffect(() => {
    const initAudio = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
    };

    // Inicializa após primeira interação do usuário
    document.addEventListener('click', initAudio, { once: true });
    document.addEventListener('keydown', initAudio, { once: true });

    return () => {
      document.removeEventListener('click', initAudio);
      document.removeEventListener('keydown', initAudio);
    };
  }, []);

  const playNotificationSound = useCallback(() => {
    const now = Date.now();
    // Evita tocar som muito frequentemente (mínimo 2 segundos entre sons)
    if (now - lastPlayedRef.current < 2000) {
      console.log('[Sound] Throttled - too soon since last notification');
      return;
    }
    
    try {
      // Cria AudioContext se não existe
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const ctx = audioContextRef.current;
      
      // Resume context se estiver suspenso (necessário em alguns browsers)
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // Cria um som de notificação suave usando Web Audio API
      // Toca duas notas curtas (ding-dong)
      const playTone = (frequency: number, startTime: number, duration: number) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.frequency.setValueAtTime(frequency, startTime);
        oscillator.type = 'sine';

        // Fade in
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
        // Fade out
        gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };

      const currentTime = ctx.currentTime;
      
      // Som de duas notas: ding-dong (mais perceptível)
      playTone(880, currentTime, 0.15); // A5 - primeira nota
      playTone(660, currentTime + 0.15, 0.2); // E5 - segunda nota
      
      lastPlayedRef.current = now;
      console.log('[Sound] 🔔 Notification sound played');
    } catch (error) {
      console.log('[Sound] Error playing notification sound:', error);
    }
  }, []);

  return { playNotificationSound };
}
