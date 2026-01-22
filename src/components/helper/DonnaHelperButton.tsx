import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import donnaAvatar from "@/assets/donna-avatar.png";
import { DonnaHelperPanel } from "./DonnaHelperPanel";
import { cn } from "@/lib/utils";

export function DonnaHelperButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Botão Flutuante da Donna */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-4 right-4 z-50 w-16 h-16 rounded-full shadow-lg",
          "bg-gradient-to-br from-green-400 to-emerald-500",
          "hover:from-green-500 hover:to-emerald-600",
          "transition-all duration-300 hover:scale-105",
          "flex items-center justify-center overflow-hidden",
          "ring-4 ring-green-300/30"
        )}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <X className="w-6 h-6 text-white" />
            </motion.div>
          ) : (
            <motion.img
              key="avatar"
              src={donnaAvatar}
              alt="Donna - Assistente Virtual"
              className="w-full h-full object-cover"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
          )}
        </AnimatePresence>

        {/* Indicador de disponível */}
        {!isOpen && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white animate-pulse" />
        )}
      </motion.button>

      {/* Tooltip quando fechado */}
      {!isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1, duration: 0.3 }}
          className="fixed bottom-6 right-24 z-40 bg-white dark:bg-zinc-800 rounded-lg shadow-lg px-4 py-2 max-w-[200px]"
        >
          <p className="text-sm font-medium text-zinc-900 dark:text-white">
            Precisa de ajuda? 🤔
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Clique para aprender a usar o sistema
          </p>
          <div className="absolute right-[-8px] top-1/2 -translate-y-1/2 w-0 h-0 border-t-8 border-b-8 border-l-8 border-transparent border-l-white dark:border-l-zinc-800" />
        </motion.div>
      )}

      {/* Painel do Helper */}
      <AnimatePresence>
        {isOpen && (
          <DonnaHelperPanel onClose={() => setIsOpen(false)} />
        )}
      </AnimatePresence>
    </>
  );
}
