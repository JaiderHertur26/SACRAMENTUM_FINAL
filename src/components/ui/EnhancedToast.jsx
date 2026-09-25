import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const EnhancedToast = ({ 
  id, 
  title, 
  description, 
  variant = 'default', 
  onDismiss, 
  duration = 5000 
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onDismiss(id), 300); // Allow animation to finish
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, id, onDismiss]);

  const variants = {
    default: {
      bg: 'bg-white',
      border: 'border-l-4 border-[#4B7BA7]',
      icon: <Info className="w-5 h-5 text-[#4B7BA7]" />,
      titleColor: 'text-slate-900',
      textColor: 'text-slate-600'
    },
    success: {
      bg: 'bg-green-50',
      border: 'border-l-4 border-green-600',
      icon: <CheckCircle className="w-5 h-5 text-green-600" />,
      titleColor: 'text-green-900',
      textColor: 'text-green-800'
    },
    destructive: {
      bg: 'bg-red-50',
      border: 'border-l-4 border-red-600',
      icon: <XCircle className="w-5 h-5 text-red-600" />,
      titleColor: 'text-red-900',
      textColor: 'text-red-800'
    },
    warning: {
      bg: 'bg-amber-50',
      border: 'border-l-4 border-amber-500',
      icon: <AlertTriangle className="w-5 h-5 text-amber-600" />,
      titleColor: 'text-amber-900',
      textColor: 'text-amber-800'
    }
  };

  const style = variants[variant] || variants.default;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 50, scale: 0.95 }}
          layout
          className={cn(
            "pointer-events-auto relative flex w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 shadow-xl shadow-slate-950/10 ring-1 ring-slate-950/5",
            style.bg,
            style.border
          )}
        >
          <div className="p-4 flex gap-3 w-full">
            <div className="flex-shrink-0 pt-0.5">
              {style.icon}
            </div>
            <div className="flex-1">
              {title && <h3 className={cn("text-sm font-bold mb-1", style.titleColor)}>{title}</h3>}
              {description && <p className={cn("text-sm leading-relaxed", style.textColor)}>{description}</p>}
            </div>
            <button
              onClick={() => {
                setIsVisible(false);
                setTimeout(() => onDismiss(id), 300);
              }}
              className="flex-shrink-0 ml-4 text-slate-400 hover:text-slate-900 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EnhancedToast;