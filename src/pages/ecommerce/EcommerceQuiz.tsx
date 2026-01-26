import { EcommerceLayout } from '@/components/ecommerce/EcommerceLayout';
import { QuizManager } from '@/components/ecommerce/quiz';

export default function EcommerceQuiz() {
  return (
    <EcommerceLayout 
      title="Quiz" 
      description="Crie quizzes interativos para qualificar e converter leads"
    >
      <QuizManager />
    </EcommerceLayout>
  );
}
