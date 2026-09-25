import React from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

const MODAL_SIZE_CLASSES = Object.freeze({
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-6xl',
});

const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className={`bg-white rounded-2xl shadow-xl w-full ${MODAL_SIZE_CLASSES[size] || MODAL_SIZE_CLASSES.md} max-h-[calc(100vh-2rem)] overflow-hidden border border-slate-200`}
        >
          <div className="flex items-start justify-between gap-4 px-4 py-4 sm:px-6 border-b border-slate-200 bg-slate-50">
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">{title}</h3>
            <button 
                onClick={onClose} 
                className="text-slate-600 hover:text-slate-900 transition-colors bg-slate-200 hover:bg-slate-300 rounded-full p-1"
                aria-label="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4 sm:p-6 max-h-[calc(100vh-7rem)] overflow-y-auto overflow-x-hidden">
            {children}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};

export { Modal };
export default Modal;