import { useEffect, useState } from 'react';
import { BrowserRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { estadoBases } from '../api/endpoints';
import { LimiteDeError } from '../components/ui/LimiteDeError';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { GraphExplorerPage } from '../features/graph-explorer/GraphExplorerPage';
import { SearchPage } from '../features/search/SearchPage';
import { UploadPage } from '../features/upload/UploadPage';

/** Aviso en la parte superior cuando el servidor o alguna de las bases de datos no responde (se revisa cada 15 segundos). */
function AvisoConexion() {
  const [estado, setEstado] = useState<{ mongo: boolean; neo4j: boolean; servidor: boolean } | null>(null);
  useEffect(() => {
    let vivo = true;
    const revisar = () => void estadoBases().then((e) => vivo && setEstado(e));
    revisar();
    const t = setInterval(revisar, 15_000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, []);
  if (!estado || (estado.servidor && estado.mongo && estado.neo4j)) return null;
  const caidas = [!estado.mongo && 'MongoDB', !estado.neo4j && 'Neo4j'].filter(Boolean).join(' y ');
  return (
    <div className="aviso-conexion" role="alert">
      {!estado.servidor
        ? 'No hay conexión con el servidor (backend). Inícialo con «npm start» en la carpeta backend.'
        : `${caidas} no ${caidas.includes(' y ') ? 'están disponibles' : 'está disponible'}. Las secciones que dependen de ${caidas.includes(' y ') ? 'ellas' : 'esa base'} mostrarán un error hasta que vuelva.`}
    </div>
  );
}

function Contenido() {
  const { pathname } = useLocation();
  return (
    <LimiteDeError reiniciarCon={pathname}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/grafos" element={<GraphExplorerPage />} />
        <Route path="/buscador" element={<SearchPage />} />
        <Route path="/carga" element={<UploadPage />} />
        <Route path="*" element={<div className="pagina"><h1>Página no encontrada</h1></div>} />
      </Routes>
    </LimiteDeError>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AvisoConexion />
      <header className="barra">
        <div className="barra-contenido">
          <div className="marca">
            <span className="marca-logo" aria-hidden="true">
              AI
            </span>
            <div>
              <strong>Admisión Ingeniería USAC</strong>
              <span>Pruebas específicas · MongoDB y Neo4j</span>
            </div>
          </div>
          <nav aria-label="Principal">
            <NavLink to="/" end>
              Dashboard
            </NavLink>
            <NavLink to="/grafos">Grafos</NavLink>
            <NavLink to="/buscador">Buscador</NavLink>
            <NavLink to="/carga">Carga de archivos</NavLink>
          </nav>
        </div>
      </header>
      <main>
        <Contenido />
      </main>
    </BrowserRouter>
  );
}
