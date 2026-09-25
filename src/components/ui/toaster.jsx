import { useToast } from "@/components/ui/use-toast"
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast"
import EnhancedToast from "@/components/ui/EnhancedToast"

export function Toaster() {
  const { toasts, dismiss } = useToast()

  return (
    <div className="fixed top-0 right-0 z-[100] flex flex-col gap-2 p-4 w-full max-w-sm sm:max-w-md pointer-events-none">
      {toasts.map(function ({ id, title, description, action, ...props }) {
        // Map 'destructive' from old toast to 'destructive' in enhanced toast
        // Map custom variants if needed
        return (
          <EnhancedToast
            key={id}
            id={id}
            title={title}
            description={description}
            variant={props.variant || 'default'}
            onDismiss={() => {
              if (props.onDismiss) props.onDismiss()
              // Also call the hook's dismiss
              if (typeof props.dismiss === 'function') props.dismiss()
            }}
          />
        )
      })}
    </div>
  )
}