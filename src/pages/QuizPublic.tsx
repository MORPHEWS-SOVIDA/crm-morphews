import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { CheckCircle, ArrowRight, Loader2 } from 'lucide-react';
import {
  useQuizBySlug,
  useCreateQuizSession,
  useUpdateQuizSession,
  useTrackQuizEvent,
  useSaveQuizAnswer,
  type QuizStep,
  type QuizStepOption,
  type QuizSession,
} from '@/hooks/ecommerce/useQuizzes';

export default function QuizPublic() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  
  const { data: quiz, isLoading, error } = useQuizBySlug(slug);
  const createSession = useCreateQuizSession();
  const updateSession = useUpdateQuizSession();
  const trackEvent = useTrackQuizEvent();
  const saveAnswer = useSaveQuizAnswer();

  const [session, setSession] = useState<QuizSession | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [textInputs, setTextInputs] = useState<Record<string, string>>({});
  const [leadData, setLeadData] = useState({ name: '', email: '', whatsapp: '', cpf: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [totalScore, setTotalScore] = useState(0);

  const currentStep = quiz?.steps?.[currentStepIndex];
  const progress = quiz?.steps ? ((currentStepIndex + 1) / quiz.steps.length) * 100 : 0;

  // Initialize session
  useEffect(() => {
    if (quiz && !session) {
      const initSession = async () => {
        const newSession = await createSession.mutateAsync({
          quiz_id: quiz.id,
          organization_id: quiz.organization_id,
          utm_source: searchParams.get('utm_source') || undefined,
          utm_medium: searchParams.get('utm_medium') || undefined,
          utm_campaign: searchParams.get('utm_campaign') || undefined,
          utm_content: searchParams.get('utm_content') || undefined,
          utm_term: searchParams.get('utm_term') || undefined,
          fbclid: searchParams.get('fbclid') || undefined,
          gclid: searchParams.get('gclid') || undefined,
          ttclid: searchParams.get('ttclid') || undefined,
          referrer: document.referrer || undefined,
          user_agent: navigator.userAgent,
        });
        setSession(newSession);

        // Track quiz view
        await trackEvent.mutateAsync({
          quiz_id: quiz.id,
          organization_id: quiz.organization_id,
          session_id: newSession.id,
          event_type: 'quiz_view',
        });
      };
      initSession();
    }
  }, [quiz, session]);

  // Track step view
  useEffect(() => {
    if (session && currentStep) {
      trackEvent.mutate({
        quiz_id: quiz!.id,
        organization_id: quiz!.organization_id,
        session_id: session.id,
        step_id: currentStep.id,
        event_type: 'step_view',
      });
    }
  }, [currentStepIndex, session, currentStep]);

  const handleOptionSelect = (option: QuizStepOption) => {
    if (!currentStep) return;

    const stepId = currentStep.id;
    const isMultiple = currentStep.step_type === 'multiple_choice';

    setAnswers(prev => {
      const current = prev[stepId] || [];
      if (isMultiple) {
        const exists = current.includes(option.id);
        return {
          ...prev,
          [stepId]: exists ? current.filter(id => id !== option.id) : [...current, option.id],
        };
      }
      return { ...prev, [stepId]: [option.id] };
    });

    // Update score
    setTotalScore(prev => prev + option.score);
  };

  const handleNext = async () => {
    if (!session || !currentStep || !quiz) return;
    setIsSubmitting(true);

    try {
      // Save answer
      const selectedOptions = answers[currentStep.id] || [];
      if (currentStep.step_type === 'single_choice' || currentStep.step_type === 'multiple_choice') {
        await saveAnswer.mutateAsync({
          session_id: session.id,
          step_id: currentStep.id,
          organization_id: quiz.organization_id,
          selected_option_ids: selectedOptions,
        });
      } else if (currentStep.step_type === 'text_input' || currentStep.step_type === 'number_input') {
        await saveAnswer.mutateAsync({
          session_id: session.id,
          step_id: currentStep.id,
          organization_id: quiz.organization_id,
          text_value: textInputs[currentStep.id],
        });
      } else if (currentStep.step_type === 'lead_capture') {
        await updateSession.mutateAsync({
          id: session.id,
          captured_name: leadData.name || null,
          captured_email: leadData.email || null,
          captured_whatsapp: leadData.whatsapp || null,
          captured_cpf: leadData.cpf || null,
        });

        await trackEvent.mutateAsync({
          quiz_id: quiz.id,
          organization_id: quiz.organization_id,
          session_id: session.id,
          event_type: 'lead_captured',
          metadata: { name: leadData.name, whatsapp: leadData.whatsapp },
        });
      }

      // Track step complete
      await trackEvent.mutateAsync({
        quiz_id: quiz.id,
        organization_id: quiz.organization_id,
        session_id: session.id,
        step_id: currentStep.id,
        event_type: 'step_complete',
      });

      // Determine next step
      let nextStepId: string | null = null;

      // Check option branching first
      if (selectedOptions.length > 0) {
        const selectedOption = currentStep.options?.find(o => o.id === selectedOptions[0]);
        if (selectedOption?.next_step_id) {
          nextStepId = selectedOption.next_step_id;
        }
      }

      // Fallback to step's default next
      if (!nextStepId && currentStep.next_step_id) {
        nextStepId = currentStep.next_step_id;
      }

      // Navigate
      if (nextStepId) {
        const nextIndex = quiz.steps?.findIndex(s => s.id === nextStepId);
        if (nextIndex !== undefined && nextIndex >= 0) {
          setCurrentStepIndex(nextIndex);
        } else {
          goToNextLinear();
        }
      } else {
        goToNextLinear();
      }
    } catch (e) {
      console.error('Error in handleNext:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const goToNextLinear = () => {
    if (!quiz?.steps) return;
    
    if (currentStepIndex < quiz.steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      // Quiz complete
      if (session && quiz) {
        updateSession.mutate({
          id: session.id,
          is_completed: true,
          completed_at: new Date().toISOString(),
          total_score: totalScore,
        });
        trackEvent.mutate({
          quiz_id: quiz.id,
          organization_id: quiz.organization_id,
          session_id: session.id,
          event_type: 'quiz_complete',
        });
      }
    }
  };

  const handleCtaClick = async () => {
    if (!session || !quiz || !currentStep) return;

    await trackEvent.mutateAsync({
      quiz_id: quiz.id,
      organization_id: quiz.organization_id,
      session_id: session.id,
      event_type: 'cta_click',
    });

    if (currentStep.result_cta_type === 'url' && currentStep.result_cta_url) {
      window.location.href = currentStep.result_cta_url;
    } else if (currentStep.result_cta_type === 'whatsapp') {
      const message = encodeURIComponent(currentStep.result_whatsapp_message || '');
      window.location.href = `https://wa.me/?text=${message}`;
    }
  };

  const canProceed = useCallback(() => {
    if (!currentStep) return false;
    if (!currentStep.is_required) return true;

    switch (currentStep.step_type) {
      case 'single_choice':
        return (answers[currentStep.id]?.length || 0) > 0;
      case 'multiple_choice':
        return (answers[currentStep.id]?.length || 0) > 0;
      case 'text_input':
      case 'number_input':
        return !!textInputs[currentStep.id]?.trim();
      case 'lead_capture':
        const needsName = currentStep.capture_name && !leadData.name;
        const needsWhatsapp = currentStep.capture_whatsapp && !leadData.whatsapp;
        const needsEmail = currentStep.capture_email && !leadData.email;
        return !needsName && !needsWhatsapp && !needsEmail;
      case 'info':
      case 'result':
        return true;
      default:
        return true;
    }
  }, [currentStep, answers, textInputs, leadData]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f8f9fa' }}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f8f9fa' }}>
        <Card className="p-8 text-center">
          <h1 className="text-xl font-semibold mb-2">Quiz não encontrado</h1>
          <p className="text-muted-foreground">Este quiz não existe ou foi desativado.</p>
        </Card>
      </div>
    );
  }

  if (!currentStep) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: quiz.background_color }}>
        <Card className="p-8 text-center">
          <h1 className="text-xl font-semibold mb-2">Quiz sem etapas</h1>
          <p className="text-muted-foreground">Este quiz ainda não possui perguntas.</p>
        </Card>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: quiz.background_color }}
    >
      {/* Header */}
      {quiz.show_progress_bar && (
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b">
          <div className="max-w-2xl mx-auto px-4 py-3">
            <div className="flex items-center gap-4">
              {quiz.logo_url && (
                <img src={quiz.logo_url} alt="Logo" className="h-8 object-contain" />
              )}
              <Progress value={progress} className="flex-1 h-2" />
              <span className="text-sm text-muted-foreground">
                {currentStepIndex + 1}/{quiz.steps?.length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="p-8 shadow-lg">
                {/* Step Image/Video */}
                {currentStep.image_url && (
                  <div className="mb-6">
                    <img 
                      src={currentStep.image_url} 
                      alt="" 
                      className="w-full max-h-64 object-cover rounded-lg"
                    />
                  </div>
                )}

                {/* Title */}
                <h2 className="text-2xl font-bold mb-2" style={{ color: quiz.primary_color }}>
                  {currentStep.step_type === 'result' ? currentStep.result_title : currentStep.title}
                </h2>
                
                {/* Subtitle/Description */}
                {(currentStep.subtitle || (currentStep.step_type === 'result' && currentStep.result_description)) && (
                  <p className="text-muted-foreground mb-6">
                    {currentStep.step_type === 'result' ? currentStep.result_description : currentStep.subtitle}
                  </p>
                )}

                {/* Step Content */}
                <div className="space-y-4">
                  {/* Choice Options */}
                  {(currentStep.step_type === 'single_choice' || currentStep.step_type === 'multiple_choice') && (
                    <div className="space-y-3">
                      {currentStep.options?.map(option => {
                        const isSelected = answers[currentStep.id]?.includes(option.id);
                        return (
                          <button
                            key={option.id}
                            onClick={() => handleOptionSelect(option)}
                            className={cn(
                              "w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-all text-left",
                              isSelected 
                                ? "border-primary bg-primary/5" 
                                : "border-muted hover:border-primary/50"
                            )}
                            style={isSelected ? { borderColor: quiz.primary_color } : {}}
                          >
                            {option.emoji && (
                              <span className="text-2xl">{option.emoji}</span>
                            )}
                            {option.image_url && (
                              <img src={option.image_url} alt="" className="w-12 h-12 rounded object-cover" />
                            )}
                            <span className="flex-1 font-medium">{option.label}</span>
                            {isSelected && (
                              <CheckCircle className="h-5 w-5" style={{ color: quiz.primary_color }} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Text Input */}
                  {currentStep.step_type === 'text_input' && (
                    <Input
                      placeholder="Digite sua resposta..."
                      value={textInputs[currentStep.id] || ''}
                      onChange={(e) => setTextInputs(prev => ({ ...prev, [currentStep.id]: e.target.value }))}
                      className="text-lg py-6"
                    />
                  )}

                  {/* Number Input */}
                  {currentStep.step_type === 'number_input' && (
                    <Input
                      type="number"
                      placeholder="Digite um número..."
                      value={textInputs[currentStep.id] || ''}
                      onChange={(e) => setTextInputs(prev => ({ ...prev, [currentStep.id]: e.target.value }))}
                      className="text-lg py-6"
                    />
                  )}

                  {/* Lead Capture */}
                  {currentStep.step_type === 'lead_capture' && (
                    <div className="space-y-4">
                      {currentStep.capture_name && (
                        <div>
                          <label className="text-sm font-medium mb-1 block">Nome</label>
                          <Input
                            placeholder="Seu nome"
                            value={leadData.name}
                            onChange={(e) => setLeadData(prev => ({ ...prev, name: e.target.value }))}
                          />
                        </div>
                      )}
                      {currentStep.capture_whatsapp && (
                        <div>
                          <label className="text-sm font-medium mb-1 block">WhatsApp</label>
                          <Input
                            placeholder="(00) 00000-0000"
                            value={leadData.whatsapp}
                            onChange={(e) => setLeadData(prev => ({ ...prev, whatsapp: e.target.value }))}
                          />
                        </div>
                      )}
                      {currentStep.capture_email && (
                        <div>
                          <label className="text-sm font-medium mb-1 block">E-mail</label>
                          <Input
                            type="email"
                            placeholder="seu@email.com"
                            value={leadData.email}
                            onChange={(e) => setLeadData(prev => ({ ...prev, email: e.target.value }))}
                          />
                        </div>
                      )}
                      {currentStep.capture_cpf && (
                        <div>
                          <label className="text-sm font-medium mb-1 block">CPF</label>
                          <Input
                            placeholder="000.000.000-00"
                            value={leadData.cpf}
                            onChange={(e) => setLeadData(prev => ({ ...prev, cpf: e.target.value }))}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Button */}
                <div className="mt-8">
                  {currentStep.step_type === 'result' ? (
                    currentStep.result_cta_type && (
                      <Button
                        className="w-full py-6 text-lg"
                        style={{ backgroundColor: quiz.primary_color }}
                        onClick={handleCtaClick}
                      >
                        {currentStep.result_cta_text}
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </Button>
                    )
                  ) : (
                    <Button
                      className="w-full py-6 text-lg"
                      style={{ backgroundColor: quiz.primary_color }}
                      onClick={handleNext}
                      disabled={!canProceed() || isSubmitting}
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          Continuar
                          <ArrowRight className="ml-2 h-5 w-5" />
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </Card>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
