import React from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { toSafeReactNode } from "@/lib/error-message";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const safeTitle = toSafeReactNode(title);
        const safeDescription = toSafeReactNode(description);

        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {safeTitle ? <ToastTitle>{safeTitle}</ToastTitle> : null}
              {safeDescription ? <ToastDescription>{safeDescription}</ToastDescription> : null}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}

