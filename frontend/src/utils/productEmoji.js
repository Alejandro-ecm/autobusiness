// Ilustración por producto sin generar imágenes: usa el set de emoji del
// sistema (diseñado por Apple/Google/Microsoft/etc., NO generado por IA) para
// darle a cada fruta/verdura/carne/etc. un ícono reconocible cuando el
// negocio no subió foto propia. Es puramente aditivo — un producto que no
// hace match sigue mostrando el 📦 genérico de siempre, así que no cambia
// nada para catálogos que no son de frutas/verduras (ej. una papelería).
//
// El orden de las entradas importa: se revisan de arriba a abajo y gana la
// primera que aparezca como substring del nombre — por eso las palabras más
// específicas van antes que las genéricas (ej. "pechuga" antes que "pollo").

const KEYWORD_EMOJI = [
  // Frutas
  ['manzana', '🍎'], ['platano', '🍌'], ['plátano', '🍌'], ['banana', '🍌'],
  ['naranja', '🍊'], ['mandarina', '🍊'], ['limon', '🍋'], ['limón', '🍋'],
  ['uva', '🍇'], ['sandia', '🍉'], ['sandía', '🍉'], ['melon', '🍈'], ['melón', '🍈'],
  ['fresa', '🍓'], ['pina', '🍍'], ['piña', '🍍'], ['durazno', '🍑'], ['melocoton', '🍑'],
  ['pera', '🍐'], ['mango', '🥭'], ['coco', '🥥'], ['kiwi', '🥝'], ['cereza', '🍒'],
  ['papaya', '🍈'], ['guayaba', '🍈'], ['granada', '🍎'],

  // Verduras
  ['aguacate', '🥑'], ['jitomate', '🍅'], ['tomate', '🍅'], ['zanahoria', '🥕'],
  ['papa', '🥔'], ['patata', '🥔'], ['camote', '🍠'], ['cebolla', '🧅'], ['ajo', '🧄'],
  ['brocoli', '🥦'], ['brócoli', '🥦'], ['lechuga', '🥬'], ['espinaca', '🥬'],
  ['repollo', '🥬'], ['col morada', '🥬'], ['col blanca', '🥬'], ['col de bruselas', '🥬'],
  // "col" a secas NO se incluye — colisiona con "coca-COLa" y otras palabras comunes.
  ['chile', '🌶️'], ['pimiento', '🫑'], ['pepino', '🥒'], ['calabacita', '🥒'],
  ['elote', '🌽'], ['maiz', '🌽'], ['maíz', '🌽'], ['calabaza', '🎃'],
  ['champinon', '🍄'], ['champiñón', '🍄'], ['hongo', '🍄'], ['nopal', '🌵'],

  // Carnes, pollo, pescado, huevo
  ['pechuga', '🍗'], ['muslo', '🍗'], ['ala de pollo', '🍗'], ['pollo', '🍗'],
  ['puerco', '🥓'], ['cerdo', '🥓'], ['tocino', '🥓'], ['jamon', '🍖'], ['jamón', '🍖'],
  ['res', '🥩'], ['bistec', '🥩'], ['carne', '🥩'], ['costilla', '🍖'],
  ['pescado', '🐟'], ['camaron', '🍤'], ['camarón', '🍤'], ['huevo', '🥚'],

  // Lácteos y panadería
  ['leche', '🥛'], ['queso', '🧀'], ['mantequilla', '🧈'], ['yogurt', '🥛'],
  ['pan', '🍞'], ['tortilla', '🫓'],

  // Bebidas
  ['refresco', '🥤'], ['soda', '🥤'], ['agua', '💧'], ['cerveza', '🍺'],
  ['cafe', '☕'], ['café', '☕'], ['jugo', '🧃'],

  // Papelería / abarrotes generales (para no dejar la papelería sin cobertura)
  ['cuaderno', '📓'], ['libreta', '📓'], ['lapiz', '✏️'], ['lápiz', '✏️'],
  ['pluma', '🖊️'], ['boligrafo', '🖊️'], ['bolígrafo', '🖊️'], ['libro', '📖'],
  ['tijera', '✂️'], ['calculadora', '🧮'], ['papel', '📄'],
]

// Fallback por categoría cuando el nombre del producto no matchea nada, pero
// la categoría sí sugiere el tipo de negocio.
const CATEGORY_EMOJI = [
  ['fruta', '🍎'], ['verdura', '🥬'], ['carne', '🥩'], ['carniceria', '🥩'], ['carnicería', '🥩'],
  ['polleria', '🍗'], ['pollería', '🍗'], ['pescaderia', '🐟'], ['pescadería', '🐟'],
  ['lacteo', '🥛'], ['lácteo', '🥛'], ['bebida', '🥤'], ['panaderia', '🍞'], ['panadería', '🍞'],
  ['papeleria', '📓'], ['papelería', '📓'],
]

function normalize(s) {
  return String(s || '').toLowerCase().trim()
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Letras que cuentan como "parte de una palabra" en español, para el límite
// de palabra por la izquierda de abajo.
const WORD_CHARS = 'a-záéíóúñü'

// "ajo" no debe matchear dentro de "trabajo", ni "col" dentro de "Coca-Cola":
// se exige que la palabra clave empiece justo despues de un espacio, guion,
// puntuacion, numero o el inicio del texto. El lado derecho queda libre a
// proposito para que sigan matcheando plurales ("ajos", "manzanas").
function matchesKeyword(text, keyword) {
  const re = new RegExp(`(?:^|[^${WORD_CHARS}])${escapeRegExp(keyword)}`, 'i')
  return re.test(text)
}

// Devuelve un emoji si el nombre (o categoría) del producto matchea alguna
// palabra clave conocida, o null si no hay match — en ese caso el llamador
// debe seguir usando su placeholder genérico (📦) de siempre.
export function getProductEmoji(name, categoryName) {
  const n = normalize(name)
  if (n) {
    for (const [kw, emoji] of KEYWORD_EMOJI) {
      if (matchesKeyword(n, kw)) return emoji
    }
  }
  const c = normalize(categoryName)
  if (c) {
    for (const [kw, emoji] of CATEGORY_EMOJI) {
      if (matchesKeyword(c, kw)) return emoji
    }
  }
  return null
}
