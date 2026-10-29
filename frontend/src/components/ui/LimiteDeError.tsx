import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Cuando este valor cambia (por ejemplo, al cambiar de página) el error se descarta y se vuelve a intentar. */
  reiniciarCon?: string;
}

/**
 * Red de seguridad de la interfaz: si un componente falla al dibujarse (por ejemplo, por un dato inesperado), en lugar de
 * dejar la pantalla en blanco se muestra un mensaje claro y el resto de la aplicación (el menú) sigue funcionando.
 */
export class LimiteDeError extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error al mostrar la pantalla:', error, info.componentStack);
  }

  componentDidUpdate(anterior: Props) {
    if (this.state.error && anterior.reiniciarCon !== this.props.reiniciarCon) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="pagina">
        <div className="alerta alerta-error" role="alert">
          <strong>No se pudo mostrar esta pantalla</strong>
          <p>Ocurrió un error inesperado al dibujar el resultado. El resto de la aplicación sigue funcionando.</p>
          <details>
            <summary>Detalle técnico</summary>
            <pre>{this.state.error.message}</pre>
          </details>
          <button className="btn btn-secundario" onClick={() => this.setState({ error: null })}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }
}
