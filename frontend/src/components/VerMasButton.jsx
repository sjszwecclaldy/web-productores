// Botón para desplegar/colapsar filas de una tabla (usado con useColapsable).
export default function VerMasButton({ abierto, restantes, onToggle }) {
  if (restantes <= 0) return null;
  return (
    <div className="ver-mas">
      <button type="button" className="btn btn-vermas" onClick={onToggle}>
        {abierto ? 'Ver menos' : `Ver todos (${restantes} más)`}
      </button>
    </div>
  );
}
