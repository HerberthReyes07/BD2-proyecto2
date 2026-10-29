import cytoscape, { Core, ElementDefinition } from 'cytoscape';
import { useEffect, useRef } from 'react';
import { Grafo } from '../../types/api';

export const COLORES_NODO: Record<string, string> = {
  Departamento: '#1e40af',
  Municipio: '#60a5fa',
  Carrera: '#f59e0b',
  Aspirante: '#0f172a',
  Postulacion: '#8b5cf6',
  TipoInstitucion: '#10b981',
  Materia: '#ec4899',
};

export interface Seleccion {
  clase: 'nodo' | 'arista';
  etiqueta: string;
  tipo: string;
  peso?: number;
  propiedades: Record<string, unknown>;
}

/**
 * Dibuja un subgrafo con Cytoscape.js. `modo` cambia solo cómo se estilizan las aristas:
 *  - "mapa": el grosor de cada arista y el tamaño de cada nodo dependen de su peso (cantidad de postulaciones).
 *  - "aspirante": las aristas EVALUADA_EN se colorean según el resultado (verde = aprobada, rojo = no aprobada).
 */
export function CytoscapeView({ grafo, modo, alSeleccionar }: { grafo: Grafo; modo: 'mapa' | 'aspirante'; alSeleccionar: (s: Seleccion | null) => void }) {
  const caja = useRef<HTMLDivElement>(null);
  const cy = useRef<Core | null>(null);
  const callback = useRef(alSeleccionar);
  callback.current = alSeleccionar;

  useEffect(() => {
    const maxNodo = Math.max(1, ...grafo.nodos.map((n) => n.peso ?? 0));
    const maxArista = Math.max(1, ...grafo.aristas.map((a) => a.peso ?? 0));

    const nodos: ElementDefinition[] = grafo.nodos.map((n) => {
      const escala = modo === 'mapa' ? Math.sqrt((n.peso ?? 0) / maxNodo) : 0;
      const base = n.tipo === 'Departamento' ? 26 : n.tipo === 'Carrera' ? 22 : 14;
      return {
        data: {
          id: n.id,
          label: n.etiqueta,
          tipo: n.tipo,
          peso: n.peso,
          props: n.propiedades,
          tam: modo === 'mapa' ? base + escala * 34 : n.tipo === 'Aspirante' ? 46 : n.tipo === 'Postulacion' ? 34 : 28,
          color: COLORES_NODO[n.tipo] ?? '#64748b',
        },
      };
    });
    const aristas: ElementDefinition[] = grafo.aristas.map((a) => {
      const evaluacion = a.tipo === 'EVALUADA_EN';
      const aprobada = a.propiedades.aprobada === true;
      return {
        data: {
          id: a.id,
          source: a.origen,
          target: a.destino,
          tipo: a.tipo,
          peso: a.peso,
          props: a.propiedades,
          ancho: modo === 'mapa' ? 1 + Math.sqrt((a.peso ?? 0) / maxArista) * 7 : 2,
          color: evaluacion ? (aprobada ? '#16a34a' : '#dc2626') : '#94a3b8',
          label: evaluacion ? `Op.${String(a.propiedades.oportunidad)} ${aprobada ? '✓' : '✗'}` : modo === 'aspirante' ? a.tipo : '',
        },
      };
    });

    const instancia = cytoscape({
      container: caja.current,
      elements: [...nodos, ...aristas],
      minZoom: 0.15,
      maxZoom: 3,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)', width: 'data(tam)', height: 'data(tam)', label: 'data(label)',
            'font-size': 10, color: '#0f172a', 'text-valign': 'bottom', 'text-margin-y': 4, 'text-wrap': 'wrap', 'text-max-width': '110px',
            'text-background-color': '#ffffff', 'text-background-opacity': 0.75, 'text-background-padding': '1px',
          },
        },
        { selector: 'node[tipo = "Carrera"]', style: { shape: 'diamond' } },
        { selector: 'node[tipo = "Departamento"]', style: { shape: 'round-rectangle' } },
        { selector: 'node[tipo = "Aspirante"]', style: { shape: 'hexagon' } },
        {
          selector: 'edge',
          style: {
            width: 'data(ancho)', 'line-color': 'data(color)', 'target-arrow-color': 'data(color)', 'target-arrow-shape': modo === 'aspirante' ? 'triangle' : 'none',
            'curve-style': 'bezier', opacity: 0.75, label: 'data(label)', 'font-size': 8, color: '#475569', 'text-rotation': 'autorotate',
            'text-background-color': '#ffffff', 'text-background-opacity': 0.85, 'text-background-padding': '1px',
          },
        },
        { selector: '.atenuado', style: { opacity: 0.12 } },
        { selector: 'node:selected', style: { 'border-width': 4, 'border-color': '#0f172a' } },
        { selector: 'edge:selected', style: { width: 6, opacity: 1 } },
      ],
      // Mapa: diseño de fuerzas. Aspirante: diseño jerárquico (aspirante → postulaciones → carreras, lugar, materias)
      layout:
        modo === 'mapa'
          ? { name: 'cose', animate: false, randomize: true, nodeRepulsion: () => 14000, idealEdgeLength: () => 90, numIter: 1200, padding: 30 }
          : { name: 'breadthfirst', directed: true, roots: grafo.nodos.filter((n) => n.tipo === 'Aspirante').map((n) => n.id), spacingFactor: 1.6, padding: 30, animate: false },
    });
    // Con pocos nodos el ajuste automático amplía demasiado: se limita el zoom inicial
    if (instancia.zoom() > 1.2) {
      instancia.zoom(1.2);
      instancia.center();
    }
    cy.current = instancia;

    instancia.on('tap', (evento) => {
      if (evento.target === instancia) {
        instancia.elements().removeClass('atenuado');
        callback.current(null);
        return;
      }
      const el = evento.target;
      const d = el.data();
      // Se atenúa todo lo que no esté conectado con el elemento elegido
      instancia.elements().addClass('atenuado');
      (el.isNode() ? el.closedNeighborhood() : el.connectedNodes().union(el)).removeClass('atenuado');
      callback.current({
        clase: el.isNode() ? 'nodo' : 'arista',
        etiqueta: el.isNode() ? d.label : d.tipo,
        tipo: d.tipo,
        peso: d.peso,
        propiedades: d.props ?? {},
      });
    });

    return () => {
      instancia.destroy();
      cy.current = null;
    };
  }, [grafo, modo]);

  return (
    <div className="grafo-caja">
      <div ref={caja} className="grafo-lienzo" role="img" aria-label="Grafo" />
      <div className="grafo-controles">
        <button className="btn btn-secundario btn-chico" onClick={() => cy.current?.fit(undefined, 30)}>
          Ajustar
        </button>
        <button
          className="btn btn-secundario btn-chico"
          onClick={() => {
            cy.current?.elements().removeClass('atenuado');
            callback.current(null);
          }}
        >
          Quitar resaltado
        </button>
      </div>
    </div>
  );
}
