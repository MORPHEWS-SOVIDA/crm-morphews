import React from "react";
import { Button } from "@/components/ui/button";

type Props = {
  children: React.ReactNode;
  title?: string;
};

type State = {
  hasError: boolean;
  error?: Error;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Keep in console so we can diagnose from logs
    console.error("Route crashed:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const title = this.props.title ?? "Ops! Esta página falhou";
    const message = this.state.error?.message ?? "Erro desconhecido";

    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <section className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-sm">
          <header className="space-y-1">
            <h1 className="text-lg font-semibold text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground">
              Tente recarregar. Se persistir, avise o suporte com esta mensagem.
            </p>
          </header>

          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-sm font-mono text-foreground break-words">{message}</p>
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={this.handleGoHome}>
              Ir para o início
            </Button>
            <Button onClick={this.handleReload}>Recarregar</Button>
          </div>
        </section>
      </div>
    );
  }
}
