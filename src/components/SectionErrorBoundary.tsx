import React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  title: string;
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error?: Error;
};

/**
 * Error boundary para isolar falhas de um bloco específico sem derrubar a rota inteira.
 * Útil para dados inconsistentes / permissões / componentes legados que podem renderizar valores inválidos.
 */
export class SectionErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Section crashed:", this.props.title, error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const message = this.state.error?.message ?? "Erro desconhecido";

    return (
      <Card>
        <CardHeader>
          <CardTitle>{this.props.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Este bloco falhou ao carregar, mas você pode continuar o atendimento normalmente.
          </p>
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-sm font-mono text-foreground break-words">{message}</p>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={this.handleRetry}>
              Tentar novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
}
