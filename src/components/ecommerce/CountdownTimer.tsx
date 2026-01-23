import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  endDate: string;
  label?: string;
  primaryColor?: string;
  onExpired?: () => void;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function CountdownTimer({ 
  endDate, 
  label = 'Oferta expira em:', 
  primaryColor = '#000000',
  onExpired 
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = new Date(endDate).getTime() - new Date().getTime();
      
      if (difference <= 0) {
        setIsExpired(true);
        onExpired?.();
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [endDate, onExpired]);

  if (isExpired) {
    return null;
  }

  const TimeBlock = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center">
      <div 
        className="text-2xl md:text-4xl font-bold text-white px-3 py-2 rounded-lg min-w-[60px] md:min-w-[80px]"
        style={{ backgroundColor: primaryColor }}
      >
        {value.toString().padStart(2, '0')}
      </div>
      <span className="text-xs mt-1 text-muted-foreground uppercase">{label}</span>
    </div>
  );

  return (
    <div 
      className="py-4 text-center"
      style={{ backgroundColor: primaryColor + '10' }}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Clock className="h-5 w-5" style={{ color: primaryColor }} />
          <span className="font-semibold" style={{ color: primaryColor }}>
            {label}
          </span>
        </div>
        <div className="flex items-center justify-center gap-2 md:gap-4">
          {timeLeft.days > 0 && (
            <>
              <TimeBlock value={timeLeft.days} label="Dias" />
              <span className="text-2xl font-bold text-muted-foreground">:</span>
            </>
          )}
          <TimeBlock value={timeLeft.hours} label="Horas" />
          <span className="text-2xl font-bold text-muted-foreground">:</span>
          <TimeBlock value={timeLeft.minutes} label="Min" />
          <span className="text-2xl font-bold text-muted-foreground">:</span>
          <TimeBlock value={timeLeft.seconds} label="Seg" />
        </div>
      </div>
    </div>
  );
}
