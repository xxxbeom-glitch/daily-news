import { useEffect } from "react";
import { X } from "lucide-react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-label="닫기"
      />
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] max-h-[90vh] flex flex-col bg-[#0a0a0f] rounded-t-[16px] border-t border-white/10 shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between shrink-0 px-4 py-3 border-b border-white/10">
          {title ? (
            <span style={{ fontSize: 16, fontWeight: 600 }} className="text-white">
              {title}
            </span>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-2 -mr-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="닫기"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
