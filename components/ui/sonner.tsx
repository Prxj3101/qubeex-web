"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { Octagon, Check, X, InfoIcon, TriangleAlertIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      closeButton
      icons={{
        success: (
          <span className="relative inline-flex items-center justify-center">
            <Octagon className="size-5 cn-badge-shape" strokeWidth={2} />
            <Check className="absolute size-2.5 cn-badge-mark" strokeWidth={3} />
          </span>
        ),
        info: (
          <InfoIcon className="size-5" strokeWidth={2} />
        ),
        warning: (
          <TriangleAlertIcon className="size-5" strokeWidth={2} />
        ),
        error: (
          <span className="relative inline-flex items-center justify-center">
            <Octagon className="size-5 cn-badge-shape" strokeWidth={2} />
            <X className="absolute size-2.5 cn-badge-mark" strokeWidth={3} />
          </span>
        ),
        loading: (
          <Loader2Icon className="size-5 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "#DA7756",
          "--normal-text": "#FFFFFF",
          "--normal-border": "#C06040",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      duration={3000}
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
