import { useState, useRef } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { MobileConversationItem } from './MobileConversationItem';
import { CheckCircle, UserCheck, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Conversation {
  id: string;
  phone_number: string;
  contact_name: string | null;
  contact_profile_pic: string | null;
  last_message_at: string | null;
  unread_count: number;
  lead_id: string | null;
  instance_id: string | null;
  status?: string;
  assigned_user_id?: string | null;
  designated_user_id?: string | null;
  is_group?: boolean;
  display_name?: string;
  group_subject?: string;
}

interface SwipeableConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
  instanceLabel?: string | null;
  assignedUserName?: string | null;
  currentUserId?: string;
  onClaim?: (conversationId: string) => Promise<void>;
  onClose?: (conversationId: string) => Promise<void>;
  canClaim?: boolean;
  canClose?: boolean;
}

const SWIPE_THRESHOLD = 80;

export function SwipeableConversationItem({
  conversation,
  isSelected,
  onClick,
  instanceLabel,
  assignedUserName,
  currentUserId,
  onClaim,
  onClose,
  canClaim = false,
  canClose = false,
}: SwipeableConversationItemProps) {
  const [isClaiming, setIsClaiming] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const constraintsRef = useRef(null);
  
  const x = useMotionValue(0);
  
  // Transform for right swipe (claim) - green background
  const rightBgOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const rightIconScale = useTransform(x, [0, SWIPE_THRESHOLD / 2, SWIPE_THRESHOLD], [0.5, 0.8, 1]);
  
  // Transform for left swipe (close) - gray background  
  const leftBgOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);
  const leftIconScale = useTransform(x, [-SWIPE_THRESHOLD, -SWIPE_THRESHOLD / 2, 0], [1, 0.8, 0.5]);

  const status = conversation.status || 'pending';
  const showClaimAction = canClaim && (status === 'pending' || status === 'autodistributed' || status === 'with_bot');
  const showCloseAction = canClose && status !== 'closed';

  const handleDragEnd = async (_: any, info: PanInfo) => {
    const offset = info.offset.x;
    
    // Right swipe - Claim
    if (offset > SWIPE_THRESHOLD && showClaimAction && onClaim && !isClaiming) {
      setIsClaiming(true);
      try {
        await onClaim(conversation.id);
      } finally {
        setIsClaiming(false);
      }
    }
    
    // Left swipe - Close
    if (offset < -SWIPE_THRESHOLD && showCloseAction && onClose && !isClosing) {
      setIsClosing(true);
      try {
        await onClose(conversation.id);
      } finally {
        setIsClosing(false);
      }
    }
  };

  const isProcessing = isClaiming || isClosing;

  return (
    <div ref={constraintsRef} className="relative overflow-hidden">
      {/* Right swipe background (Claim/Atender) */}
      {showClaimAction && (
        <motion.div 
          className="absolute inset-y-0 left-0 w-24 bg-green-500 flex items-center justify-center"
          style={{ opacity: rightBgOpacity }}
        >
          <motion.div style={{ scale: rightIconScale }}>
            {isClaiming ? (
              <Loader2 className="h-6 w-6 text-white animate-spin" />
            ) : (
              <div className="flex flex-col items-center gap-1">
                <UserCheck className="h-6 w-6 text-white" />
                <span className="text-[10px] font-medium text-white">ATENDER</span>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
      
      {/* Left swipe background (Close/Encerrar) */}
      {showCloseAction && (
        <motion.div 
          className="absolute inset-y-0 right-0 w-24 bg-gray-500 flex items-center justify-center"
          style={{ opacity: leftBgOpacity }}
        >
          <motion.div style={{ scale: leftIconScale }}>
            {isClosing ? (
              <Loader2 className="h-6 w-6 text-white animate-spin" />
            ) : (
              <div className="flex flex-col items-center gap-1">
                <CheckCircle className="h-6 w-6 text-white" />
                <span className="text-[10px] font-medium text-white">ENCERRAR</span>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
      
      {/* Swipeable content */}
      <motion.div
        drag={!isProcessing && (showClaimAction || showCloseAction) ? "x" : false}
        dragConstraints={{ left: showCloseAction ? -SWIPE_THRESHOLD - 20 : 0, right: showClaimAction ? SWIPE_THRESHOLD + 20 : 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className={cn(
          "relative bg-background",
          isProcessing && "pointer-events-none"
        )}
        whileTap={{ cursor: 'grabbing' }}
      >
        <MobileConversationItem
          conversation={conversation}
          isSelected={isSelected}
          onClick={onClick}
          instanceLabel={instanceLabel}
          assignedUserName={assignedUserName}
          currentUserId={currentUserId}
        />
      </motion.div>
    </div>
  );
}
