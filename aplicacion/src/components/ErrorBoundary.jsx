import React from 'react';
import {reportDiagnostic} from '../lib/services.js';
export default class ErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { console.error('Application error',error); reportDiagnostic('UI_RENDER'); }
  render() {
    if(this.state.failed) return <main className="min-h-screen bg-crema flex items-center justify-center p-6"><section className="ce-panel max-w-lg"><h1 className="text-xl font-bold">No pudimos mostrar esta pantalla</h1><p className="ce-description">Recarga para abrir de nuevo el negocio. Las operaciones confirmadas siguen guardadas.</p><button className="ce-button" onClick={()=>window.location.reload()}>Volver a abrir</button></section></main>;
    return this.props.children;
  }
}
