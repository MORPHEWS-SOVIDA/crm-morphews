import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        funnel: {
          prospect: "hsl(var(--funnel-prospect))",
          "prospect-foreground": "hsl(var(--funnel-prospect-foreground))",
          contacted: "hsl(var(--funnel-contacted))",
          "contacted-foreground": "hsl(var(--funnel-contacted-foreground))",
          convincing: "hsl(var(--funnel-convincing))",
          "convincing-foreground": "hsl(var(--funnel-convincing-foreground))",
          scheduled: "hsl(var(--funnel-scheduled))",
          "scheduled-foreground": "hsl(var(--funnel-scheduled-foreground))",
          positive: "hsl(var(--funnel-positive))",
          "positive-foreground": "hsl(var(--funnel-positive-foreground))",
          "waiting-payment": "hsl(var(--funnel-waiting-payment))",
          "waiting-payment-foreground": "hsl(var(--funnel-waiting-payment-foreground))",
          success: "hsl(var(--funnel-success))",
          "success-foreground": "hsl(var(--funnel-success-foreground))",
          trash: "hsl(var(--funnel-trash))",
          "trash-foreground": "hsl(var(--funnel-trash-foreground))",
          cloud: "hsl(var(--funnel-cloud))",
          "cloud-foreground": "hsl(var(--funnel-cloud-foreground))",
        },
        star: {
          filled: "hsl(var(--star-filled))",
          empty: "hsl(var(--star-empty))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(20px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
      },
      boxShadow: {
        "card": "0 4px 6px -1px hsl(var(--primary) / 0.1), 0 2px 4px -2px hsl(var(--primary) / 0.1)",
        "card-hover": "0 20px 25px -5px hsl(var(--primary) / 0.1), 0 8px 10px -6px hsl(var(--primary) / 0.1)",
        "funnel": "0 10px 40px -10px hsl(var(--primary) / 0.3)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
