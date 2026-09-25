// frontend/src/components/pos/CategoryChips.jsx
import './CategoryChips.css'

// Filtro visual por categoría para la parrilla de Caja — mismo patrón de UX que
// los chips de Inventory.jsx (Todas + una por categoría), pero con clases CSS
// propias (`pos-cat-chip`) para no compartir estilos globales con esa página.
export default function CategoryChips({ categories, activeId, onSelect }) {
  if (!categories || categories.length === 0) return null

  return (
    <div className="pos-cat-chips">
      <button
        type="button"
        className={`pos-cat-chip${!activeId ? ' active' : ''}`}
        onClick={() => onSelect('')}
      >
        Todas
      </button>
      {categories.map(c => (
        <button
          type="button"
          key={c.id}
          className={`pos-cat-chip${activeId === c.id ? ' active' : ''}`}
          style={activeId === c.id ? {} : { borderColor: c.color, color: c.color }}
          onClick={() => onSelect(activeId === c.id ? '' : c.id)}
        >
          {c.name}
        </button>
      ))}
    </div>
  )
}
