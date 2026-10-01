// Giros de negocio disponibles. Compartido entre el onboarding inicial
// (OnboardingWizard) y el cambio posterior desde Configuración (StoreAdmin).
export const PROFILES = [
  { id: 'tienda',     icon: '🏪', label: 'Tienda / Miscelánea',    desc: 'Abarrotes, dulces, limpieza' },
  { id: 'abarrotes',  icon: '🛒', label: 'Abarrotes / Super',      desc: 'Productos al mayoreo y menudeo' },
  { id: 'recauderia', icon: '⚖️', label: 'Recaudería / Frutería',  desc: 'Frutas y verduras, ventas por kg' },
  { id: 'papeleria',  icon: '📄', label: 'Papelería / Copias',     desc: 'Copias, útiles, productos por pieza' },
  { id: 'ropa',       icon: '👕', label: 'Ropa / Boutique',         desc: 'Prendas, tallas, colores' },
  { id: 'zapateria',  icon: '👟', label: 'Zapatería',               desc: 'Calzado, tallas, modelos' },
  { id: 'abastos',    icon: '⚖️', label: 'Abastos / Mayorista',     desc: 'Ventas por kg, costal, tonelada' },
  { id: 'otro',       icon: '🏢', label: 'Otro negocio',            desc: 'Cualquier otro tipo' },
]

// Solo 'papeleria' oculta las funciones de venta por peso — cualquier otro
// giro (incluyendo null/'otro'/valores antiguos) mantiene el comportamiento
// de siempre. Así ningún negocio ya registrado puede verse afectado: nadie
// tiene hoy profileType = 'papeleria'.
export const sellsByWeight = (profileType) => profileType !== 'papeleria'
