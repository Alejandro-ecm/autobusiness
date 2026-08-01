import React, { useState, useEffect, useRef, useCallback } from 'react'
import { inventory as inventoryApi, categories as categoriesApi, upload as uploadApi } from '../api'
import { useToast } from '../store/ToastContext'
import { useAuth } from '../store/AuthContext'
import { useLocation, useNavigate } from 'react-router-dom'
import './Inventory.css'

const API = import.meta.env.VITE_API_URL || '/api'

// ── EAN-13 generator (rango 2xxxxxxxx reservado GS1 para uso interno) ────────
let _ean13Counter = 0
function generateEAN13() {
  // Counter + random suffix evita colisiones en generación masiva
  const ts    = String(Date.now()).slice(-8)
  const count = String(++_ean13Counter % 100).padStart(2, '0')
  const rnd   = String(Math.floor(Math.random() * 10))
  const base  = '2' + ts + count + rnd             // 12 dígitos
  const digits = base.split('').map(Number)
  const sum   = digits.reduce((s, d, i) => s + d * (i % 2 === 0 ? 1 : 3), 0)
  return base + ((10 - (sum % 10)) % 10)           // + dígito verificador
}

// ── Dibuja un barcode: EAN-13 si es válido, si no CODE128 (acepta todo) ───────
function drawBarcode(JsBarcode, el, code, opts) {
  const c = String(code).trim()
  try {
    JsBarcode(el, c, { ...opts, format: 'EAN13' })
  } catch {
    JsBarcode(el, c, { ...opts, format: 'CODE128' })
  }
}

// ── Renderiza un código de barras en un elemento SVG ─────────────────────────
async function renderBarcode(svgEl, code) {
  const JsBarcode = (await import('jsbarcode')).default
  drawBarcode(JsBarcode, svgEl, code, {
    width:        1.8,
    height:       50,
    displayValue: true,
    fontSize:     11,
    margin:       4,
    textMargin:   2,
  })
}

// ── Componente barcode inline para la tabla ───────────────────────────────────
function BarcodeImg({ code, small = false }) {
  const ref = React.useRef()
  React.useEffect(() => {
    if (!ref.current || !code) return
    import('jsbarcode').then(({ default: JsBarcode }) => {
      try {
        drawBarcode(JsBarcode, ref.current, code, {
          width:        small ? 1.1 : 1.6,
          height:       small ? 28 : 42,
          displayValue: true,
          fontSize:     small ? 7 : 10,
          margin:       small ? 2 : 3,
          textMargin:   1,
        })
      } catch { /* código inválido */ }
    })
  }, [code, small])
  if (!code) return null
  return <svg ref={ref} style={{ display: 'block', maxWidth: '100%' }} />
}

// Column names accepted from Excel (Spanish and English variants)
const COL_MAP = {
  name:        ['nombre', 'name', 'producto'],
  price:       ['precio', 'price', 'precio venta', 'precio de venta'],
  cost:        ['costo', 'cost', 'precio costo'],
  stock:       ['stock', 'existencia', 'cantidad', 'inventory'],
  minStock:    ['stock minimo', 'stock mínimo', 'min stock', 'minstock', 'minimo'],
  sku:         ['sku', 'codigo', 'código', 'reference'],
  barcode:     ['barcode', 'codigo barras', 'código barras', 'codigo de barras', 'ean', 'upc'],
  description: ['descripcion', 'descripción', 'description', 'detalle'],
  isOnline:    ['online', 'tienda online', 'en linea', 'en línea', 'web'],
  // Nuevas columnas de modo de venta
  saleMode:    ['tipoventa', 'tipo venta', 'salemode', 'sale mode', 'tipo'],
  baseUnit:    ['unidad', 'baseunit', 'base unit', 'unidad base', 'unit'],
  pricePerKg:  ['precioporkg', 'precio por kg', 'priceperkg', 'precio/kg', 'precio kg'],
  variants:    ['variantes', 'variants', 'empaques', 'packaging'],
}

function normalizeKey(header) {
  const h = header.toLowerCase().trim()
  for (const [key, variants] of Object.entries(COL_MAP)) {
    if (variants.includes(h)) return key
  }
  return null
}

function parseRows(sheet, XLSX) {
  const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
  if (json.length < 2) return []
  const headers = json[0].map(String)
  const keyMap  = headers.map(normalizeKey)
  return json.slice(1)
    .filter(row => row.some(c => c !== ''))
    .map(row => {
      const obj = {}
      keyMap.forEach((key, i) => { if (key) obj[key] = row[i] })
      return obj
    })
    .filter(r => r.name)
}

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const emptyForm = { name: '', price: '', cost: '', stock: '', minStock: '5', sku: '', barcode: '', imageUrl: '', isOnline: false, categoryId: '', saleMode: 'UNIT', baseUnit: 'unit', pricePerKg: '', variants: '' }

export default function Inventory() {
  const { show } = useToast()
  const { isOwner } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [categories, setCategories] = useState([])
  const [filterCat, setFilterCat] = useState('')
  const [showCatModal, setShowCatModal] = useState(false)
  const [catForm, setCatForm] = useState({ name: '', color: '#6366f1' })
  const [catSaving, setCatSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const [lastUpdated, setLastUpdated] = useState(null)
  const [editProduct, setEditProduct] = useState(null)
  const [editForm, setEditForm]       = useState({})
  const [editSaving, setEditSaving] = useState(false)
  const [sortBy, setSortBy] = useState('name')
  const [filterStock, setFilterStock] = useState('all')
  const [showStats,   setShowStats]   = useState(true)
  const [catEarnings, setCatEarnings] = useState([])
  const [showEarnings, setShowEarnings] = useState(false)
  const [showImport,    setShowImport]    = useState(false)
  const [importRows,    setImportRows]    = useState([])
  const [importing,     setImporting]     = useState(false)
  const [dragOver,      setDragOver]      = useState(false)
  const [adjustProduct, setAdjustProduct] = useState(null)
  const [adjustQty,     setAdjustQty]     = useState('')
  const [adjusting,     setAdjusting]     = useState(false)
  const [genLoading,    setGenLoading]    = useState(null)   // productId generando
  const [printSelected, setPrintSelected] = useState(new Set())
  const [bulkGenerating, setBulkGenerating] = useState(false)
  const [bulkProgress,   setBulkProgress]   = useState({ done: 0, total: 0 })
  const fileInputRef      = useRef()
  const imgInputCreateRef = useRef()
  const imgInputEditRef   = useRef()

  const load = () => inventoryApi.list().then(data => {
    setProducts(data)
    setLastUpdated(new Date())
  }).finally(() => setLoading(false))

  const loadCategories = () => categoriesApi.list().then(setCategories).catch(() => {})

  const loadEarnings = () => categoriesApi.earnings().then(setCatEarnings).catch(() => {})

  const toggleEarnings = () => {
    const next = !showEarnings
    setShowEarnings(next)
    if (next) loadEarnings()
  }

  useEffect(() => {
    load()
    loadCategories()
    const iv = setInterval(load, 15_000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('new') !== '1') return
    setForm(emptyForm)
    setShowModal(true)
    params.delete('new')
    const nextSearch = params.toString()
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : '',
      },
      { replace: true },
    )
  }, [location.pathname, location.search, navigate])

  const filtered = products
    .filter(p => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.sku || '').toLowerCase().includes(search.toLowerCase())
      const matchStock = filterStock === 'all' ? true
        : filterStock === 'out' ? p.stock === 0
        : filterStock === 'low' ? (p.stock > 0 && p.stock <= p.minStock)
        : filterStock === 'online' ? p.isOnline : true
      const matchCat = !filterCat || p.categoryId === filterCat
      return matchSearch && matchStock && matchCat
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'price_desc') return b.price - a.price
      if (sortBy === 'price_asc') return a.price - b.price
      if (sortBy === 'stock_asc') return a.stock - b.stock
      if (sortBy === 'stock_desc') return b.stock - a.stock
      if (sortBy === 'margin') {
        const ma = a.price > 0 ? (a.price - a.cost) / a.price : 0
        const mb = b.price > 0 ? (b.price - b.cost) / b.price : 0
        return mb - ma
      }
      return 0
    })

  const totalValue = products.reduce((s, p) => s + (p.cost || 0) * p.stock, 0)
  const totalRetailValue = products.reduce((s, p) => s + p.price * p.stock, 0)
  const outOfStock = products.filter(p => p.stock === 0).length
  const lowStockCount = products.filter(p => p.stock > 0 && p.stock <= p.minStock).length

  const printInventory = () => {
    const rows = filtered.map(p => {
      const margin = p.price > 0 ? ((p.price - p.cost) / p.price * 100).toFixed(1) : '0'
      return `<tr><td>${esc(p.name)}</td><td>${esc(p.sku) || '—'}</td><td>$${p.price.toFixed(2)}</td><td>$${(p.cost || 0).toFixed(2)}</td><td>${margin}%</td><td>${p.stock}</td></tr>`
    }).join('')
    const w = window.open('', '_blank')
    if (!w) { show('El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes.', 'error'); return }
    w.document.write(`<html><head><title>Inventario</title><style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      h2 { color: #6366f1; } table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th { background: #f1f5f9; padding: 8px 12px; text-align: left; font-size: 12px; }
      td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
      .footer { margin-top: 20px; font-size: 11px; color: #1e293b; }
    </style></head><body>
      <h2>Inventario — ${new Date().toLocaleDateString('es-MX')}</h2>
      <p style="color:#1e293b">${filtered.length} productos · Valor a costo: $${totalValue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
      <table><thead><tr><th>Producto</th><th>SKU</th><th>Precio</th><th>Costo</th><th>Margen</th><th>Stock</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <p class="footer">Generado por AutoBusiness AI · ${new Date().toLocaleString('es-MX')}</p>
    </body></html>`)
    w.document.close()
    w.print()
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    const price = parseFloat(form.price)
    if (!form.name.trim()) { show('El nombre es requerido', 'error'); return }
    if (isNaN(price) || price < 0) { show('El precio debe ser un número válido', 'error'); return }
    setSaving(true)
    try {
      await inventoryApi.create({
        name:       form.name.trim(),
        price,
        cost:       parseFloat(form.cost) || 0,
        stock:      parseFloat(form.stock) || 0,
        minStock:   parseFloat(form.minStock) || 5,
        sku:        form.sku.trim() || undefined,
        barcode:    form.barcode.trim() || undefined,
        imageUrl:   form.imageUrl.trim() || undefined,
        isOnline:   form.isOnline,
        categoryId: form.categoryId || undefined,
        saleMode:   form.saleMode || 'UNIT',
        baseUnit:   form.baseUnit || 'unit',
        allowsDecimal: form.saleMode === 'WEIGHT' || form.saleMode === 'MIXED',
        pricePerKg: form.pricePerKg ? parseFloat(form.pricePerKg) : undefined,
        variants:   form.variants.trim() || undefined,
      })
      show('Producto creado', 'success')
      setShowModal(false)
      setForm(emptyForm)
      load()
    } catch (err) {
      show(err?.error || 'Error al crear producto', 'error')
    } finally { setSaving(false) }
  }

  const openEdit = (p) => {
    setEditProduct(p)
    setEditForm({
      name:     p.name,
      price:    p.price,
      cost:     p.cost || 0,
      minStock: p.minStock || 5,
      sku:      p.sku || '',
      barcode:  p.barcode || '',
      imageUrl: p.imageUrl || '',
      isOnline: !!p.isOnline,
      categoryId: p.categoryId || '',
      saleMode: p.saleMode || 'UNIT',
      baseUnit: p.baseUnit || 'unit',
      pricePerKg: p.pricePerKg || '',
      variants:   p.variants  || '',
    })
  }

  const handleEdit = async (e) => {
    e.preventDefault()
    const price = parseFloat(editForm.price)
    if (isNaN(price) || price < 0) { show('El precio debe ser un número válido', 'error'); return }
    setEditSaving(true)
    try {
      await inventoryApi.update(editProduct.id, {
        name:       editForm.name.trim(),
        price,
        cost:       parseFloat(editForm.cost) || 0,
        minStock:   parseFloat(editForm.minStock) || 5,
        sku:        editForm.sku?.trim() || undefined,
        imageUrl:   editForm.imageUrl?.trim() || undefined,
        isOnline:   editForm.isOnline,
        categoryId: editForm.categoryId || undefined,
        saleMode:   editForm.saleMode || 'UNIT',
        baseUnit:   editForm.baseUnit || 'unit',
        allowsDecimal: editForm.saleMode === 'WEIGHT' || editForm.saleMode === 'MIXED',
        pricePerKg: editForm.pricePerKg ? parseFloat(editForm.pricePerKg) : undefined,
        variants:   editForm.variants?.trim() || undefined,
      })
      const newBarcode = editForm.barcode?.trim() || null
      if (newBarcode !== (editProduct.barcode || null)) {
        await inventoryApi.setBarcode(editProduct.id, newBarcode)
      }
      show('Producto actualizado', 'success')
      setEditProduct(null)
      load()
    } catch (err) {
      show(err?.error || 'Error al actualizar', 'error')
    } finally { setEditSaving(false) }
  }

  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const doDeleteProduct = async () => {
    const p = confirmDelete
    if (!p) return
    setDeleting(true)
    try {
      await inventoryApi.remove(p.id)
      show('Producto eliminado', 'success')
      setConfirmDelete(null)
      load()
    } catch (err) {
      show(err?.error || 'Error al eliminar producto', 'error')
    } finally { setDeleting(false) }
  }

  const handleCreateCategory = async (e) => {
    e.preventDefault()
    if (!catForm.name.trim()) return
    setCatSaving(true)
    try {
      await categoriesApi.create({ name: catForm.name.trim(), color: catForm.color })
      show('Categoría creada', 'success')
      setShowCatModal(false)
      setCatForm({ name: '', color: '#6366f1' })
      loadCategories()
    } catch (err) {
      show(err?.error || 'Error al crear categoría', 'error')
    } finally { setCatSaving(false) }
  }

  const deleteCategory = async (id) => {
    if (!window.confirm('¿Eliminar esta categoría?')) return
    try {
      await categoriesApi.delete(id)
      loadCategories()
      if (filterCat === id) setFilterCat('')
    } catch { show('Error al eliminar', 'error') }
  }

  // ── Excel template download (.xlsx con formato y ejemplos) ───────────────
  const downloadTemplate = async () => {
    const XLSX = await import('xlsx')

    // ── Hoja 1: Plantilla ──────────────────────────────────────────────────
    const headers = ['Nombre','Precio','Costo','Stock','Stock Minimo','SKU','Codigo Barras','Descripcion','Online','TipoVenta','Unidad','PrecioPorKg','Variantes']
    const examples = [
      // Productos normales (UNIT)
      ['Coca-Cola 600ml',    18,   12,   50,  5, 'CC600',   '7501055301008', 'Refresco 600ml', 'Si',  'UNIT', 'unit', '',    ''],
      ['Agua Bonafont 1L',   12,    7,  100, 10, 'AB1L',    '7501007010022', 'Agua 1 litro',   'Si',  'UNIT', 'unit', '',    ''],
      ['Sabritas Original',  22,   14,   80,  8, 'SAB-OR',  '7501011100063', 'Papas original', 'Si',  'UNIT', 'unit', '',    ''],
      // Productos por peso (WEIGHT)
      ['Azúcar blanca',      25,   18, 1000, 50, 'AZU-BL',  '',              'Azúcar a granel','No',  'WEIGHT','kg',  '25',  'Costal:50,Tonelada:1000'],
      ['Frijol negro',       32,   24,  500, 20, 'FRJ-NG',  '',              'Frijol a granel','No',  'WEIGHT','kg',  '32',  'Costal:50,Caja:25'],
      ['Arroz extra largo',  28,   20,  800, 30, 'ARR-EL',  '',              'Arroz a granel', 'No',  'WEIGHT','kg',  '28',  'Costal:50'],
      // Mixto
      ['Jabón Dove 90g',     35,   22,   40,  5, 'DOV-90',  '7891150062978', 'Jabón tocador',  'No',  'UNIT', 'unit', '',    ''],
      ['Leche Lala 1L',      26,   18,   70,  8, 'LAL-1L',  '7501020503025', 'Leche entera',   'Si',  'UNIT', 'unit', '',    ''],
    ]

    const wsData = [headers, ...examples]
    const ws     = XLSX.utils.aoa_to_sheet(wsData)

    ws['!cols'] = [
      { wch: 28 }, // Nombre
      { wch: 10 }, // Precio
      { wch: 10 }, // Costo
      { wch: 10 }, // Stock
      { wch: 12 }, // Stock Min
      { wch: 12 }, // SKU
      { wch: 16 }, // Barcode
      { wch: 30 }, // Descripcion
      { wch: 8  }, // Online
      { wch: 10 }, // TipoVenta
      { wch: 8  }, // Unidad
      { wch: 12 }, // PrecioPorKg
      { wch: 28 }, // Variantes
    ]

    headers.forEach((_, ci) => {
      const cell = XLSX.utils.encode_cell({ r: 0, c: ci })
      if (!ws[cell]) return
      ws[cell].s = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '6366F1' } } }
    })

    // ── Hoja 2: Instrucciones ──────────────────────────────────────────────
    const instrData = [
      ['INSTRUCCIONES PARA LLENAR LA PLANTILLA'],
      [''],
      ['COLUMNA',        'OBLIGATORIO', 'DESCRIPCIÓN',                                           'EJEMPLO'],
      ['Nombre',         'SÍ',          'Nombre completo del producto',                          'Azúcar blanca'],
      ['Precio',         'SÍ',          'Precio de venta (sin $ ni comas)',                      '25'],
      ['Costo',          'No',          'Costo de compra del producto',                          '18'],
      ['Stock',          'No',          'Cantidad actual (puede ser decimal para kg)',            '1000'],
      ['Stock Minimo',   'No',          'Mínimo antes de alerta de stock bajo',                  '50'],
      ['SKU',            'No',          'Código interno de tu negocio',                          'AZU-BL'],
      ['Codigo Barras',  'No',          'Código de barras (EAN-13, UPC, etc.)',                  '7501055301008'],
      ['Descripcion',    'No',          'Descripción para tienda online',                        'Azúcar a granel'],
      ['Online',         'No',          'Disponible en tienda online: Si o No',                  'Si'],
      ['TipoVenta',      'No',          'UNIT = por pieza | WEIGHT = por peso | MIXED = ambos', 'WEIGHT'],
      ['Unidad',         'No',          'Unidad base: kg, g, L, mL, ton, unit',                 'kg'],
      ['PrecioPorKg',    'No',          'Precio por kg (solo para WEIGHT/MIXED)',                '25'],
      ['Variantes',      'No',          'Empaques: Nombre:multiplicador separados por coma',     'Costal:50,Tonelada:1000'],
      [''],
      ['EJEMPLOS DE VARIANTES:'],
      ['• Costal:50           → vende costales de 50 kg al precio de 50×pricePerKg'],
      ['• Tonelada:1000       → vende toneladas de 1000 kg'],
      ['• Costal:50:1100      → costal a precio fijo $1100 (ignora precio/kg)'],
      ['• Caja:25,Costal:50   → dos variantes en el mismo producto'],
    ]

    const ws2    = XLSX.utils.aoa_to_sheet(instrData)
    ws2['!cols'] = [{ wch: 16 }, { wch: 13 }, { wch: 55 }, { wch: 30 }]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws,  'Productos')
    XLSX.utils.book_append_sheet(wb, ws2, 'Instrucciones')
    XLSX.writeFile(wb, 'plantilla_inventario_autobusiness.xlsx')
  }

  // ── Parse file (Excel or CSV) ─────────────────────────────────────────────
  const handleFile = useCallback(async (file) => {
    if (!file) return
    const XLSX = await import('xlsx')
    const buf  = await file.arrayBuffer()
    const wb   = XLSX.read(buf, { type: 'array' })
    const ws   = wb.Sheets[wb.SheetNames[0]]
    const rows = parseRows(ws, XLSX)
    if (!rows.length) { show('No se encontraron productos en el archivo. Usa la plantilla.', 'error'); return }
    setImportRows(rows)
    setShowImport(true)
  }, [show])

  const handleDrop = useCallback(e => {
    e.preventDefault(); setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }, [handleFile])

  // ── Send to backend ───────────────────────────────────────────────────────
  const doImport = async () => {
    setImporting(true)
    try {
      const data = await inventoryApi.import(importRows)
      show(`✓ ${data.created} productos importados${data.errors?.length ? ` · ${data.errors.length} errores` : ''}`, 'success')
      setShowImport(false)
      setImportRows([])
      load()
    } catch (err) {
      show(err?.error || err?.message || 'Error al importar', 'error')
    } finally { setImporting(false) }
  }

  // ── Generar y guardar barcode para un producto ────────────────────────────
  const generateBarcode = async (product) => {
    setGenLoading(product.id)
    const code  = generateEAN13()
    const token = localStorage.getItem('ab_token')
    try {
      await fetch(`${API}/inventory/products/${product.id}/barcode`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ barcode: code }),
      })
      show(`Código generado: ${code}`, 'success')
      load()
    } catch {
      show('Error al guardar el código', 'error')
    } finally {
      setGenLoading(null)
    }
  }

  // ── Generar códigos para TODOS los productos sin barcode ─────────────────
  const generateAllBarcodes = async () => {
    const noCode = products.filter(p => !p.barcode)
    if (!noCode.length) { show('Todos los productos ya tienen código de barras', 'success'); return }
    if (!window.confirm(`¿Generar códigos de barras para ${noCode.length} productos sin código?`)) return

    setBulkGenerating(true)
    setBulkProgress({ done: 0, total: noCode.length })
    const token = localStorage.getItem('ab_token')
    let done = 0

    // Process in batches of 10 to avoid overwhelming the backend
    for (let i = 0; i < noCode.length; i += 10) {
      const batch = noCode.slice(i, i + 10)
      await Promise.allSettled(batch.map(async p => {
        const code = generateEAN13()
        try {
          await fetch(`${API}/inventory/products/${p.id}/barcode`, {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body:    JSON.stringify({ barcode: code }),
          })
        } catch { /* skip failed ones */ }
        done++
        setBulkProgress({ done, total: noCode.length })
      }))
    }

    setBulkGenerating(false)
    show(`✓ Códigos generados para ${noCode.length} productos`, 'success')
    load()
  }

  // ── Imprimir etiquetas (recibe lista directa o usa printSelected) ─────────
  const printLabels = async (overrideList) => {
    const toPrint = overrideList
      ? overrideList.filter(p => p.barcode)
      : products.filter(p => printSelected.has(p.id) && p.barcode)
    if (!toPrint.length) { show('No hay productos con código para imprimir', 'error'); return }

    // Renderizar SVGs en memoria
    const svgList = await Promise.all(toPrint.map(async (p) => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      await renderBarcode(svg, p.barcode)
      return { name: p.name, price: p.price, svg: svg.outerHTML }
    }))

    const labels = svgList.map(({ name, price, svg }) => `
      <div class="label">
        <div class="label-name">${esc(name)}</div>
        <div class="label-svg">${svg}</div>
        <div class="label-price">$${Number(price).toFixed(2)}</div>
      </div>`).join('')

    const w = window.open('', '_blank')
    if (!w) { show('El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes.', 'error'); return }
    w.document.write(`<!DOCTYPE html><html><head><title>Etiquetas</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Arial, sans-serif; background: #fff; }
      .grid { display: grid; grid-template-columns: repeat(3, 6.35cm); gap: 0; }
      .label {
        width: 6.35cm; height: 3.81cm;
        border: 0.3pt solid #ccc;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        padding: 2mm; overflow: hidden;
      }
      .label-name { font-size: 7.5pt; font-weight: bold; text-align: center; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 1mm; }
      .label-svg svg { width: auto; height: 22mm; }
      .label-price { font-size: 8pt; font-weight: bold; color: #333; margin-top: 1mm; }
      @media print { @page { margin: 1.27cm 0.5cm; } }
    </style></head>
    <body><div class="grid">${labels}</div>
    <script>window.onload = () => { window.print(); }<\/script>
    </body></html>`)
    w.document.close()
  }

  // ── Imprimir 20 copias del código de un producto (para pegar en cada pieza) ──
  const printProductLabels = async (p) => {
    if (!p.barcode) { show('Este producto no tiene código de barras. Agrégalo desde "Editar".', 'error'); return }
    await printLabels(Array.from({ length: 20 }, () => p))
  }

  const exportCsv = () => {
    const rows = ['Nombre,SKU,Precio,Costo,Margen%,Stock,Online']
    products.forEach(p => {
      const margin = p.price > 0 ? ((p.price - p.cost) / p.price * 100).toFixed(1) : '0'
      rows.push(`"${p.name}","${p.sku || ''}",${p.price},${p.cost || 0},${margin},${p.stock},${p.isOnline ? 'Si' : 'No'}`)
    })
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(rows.join('\n'))
    a.download = 'inventario.csv'
    a.click()
  }

  // ── Subida de foto a Cloudinary ───────────────────────────────────────────
  const handleImageUpload = useCallback(async (file, target) => {
    if (!file || !file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) { show('Imagen demasiado grande (máx 5 MB)', 'error'); return }
    try {
      show('Subiendo imagen...', 'info')
      const result = await uploadApi.image(file, 'products')
      if (target === 'create') setForm(f => ({ ...f, imageUrl: result.url }))
      else                     setEditForm(f => ({ ...f, imageUrl: result.url }))
    } catch {
      show('Error al subir imagen', 'error')
    }
  }, [show])

  const setEdit = (k) => (e) => setEditForm(f => ({
    ...f,
    [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value
  }))

  const openAdjust = (product) => {
    setAdjustProduct(product)
    setAdjustQty('')
  }

  const doAdjust = async (delta) => {
    const qty = parseFloat(adjustQty)
    if (!qty || qty <= 0) { show('Ingresa una cantidad válida mayor a 0', 'error'); return }
    setAdjusting(true)
    try {
      await inventoryApi.adjustStock(adjustProduct.id, delta > 0 ? qty : -qty, 'Ajuste manual')
      show(delta > 0 ? `+${qty} unidades agregadas` : `-${qty} unidades quitadas`, 'success')
      setAdjustProduct(null)
      load()
    } catch (err) {
      show(err?.error || 'Error al ajustar', 'error')
    } finally { setAdjusting(false) }
  }

  const set = (k) => (e) => setForm(f => ({
    ...f,
    [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value
  }))

  if (loading) return <div className="page-loading"><div className="spinner" style={{ width: 32, height: 32 }} /></div>

  return (
    <div className="inventory-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventario</h1>
          <p className="page-subtitle">{products.length} productos — {lastUpdated && `🔄 ${lastUpdated.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-outline" onClick={printInventory}>🖨️ Imprimir</button>
          <button className="btn btn-outline" onClick={exportCsv}>⬇ CSV</button>
          {isOwner && (
            <>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv"
                style={{ display:'none' }} onChange={e => handleFile(e.target.files[0])} />
              <button className="btn btn-outline" onClick={downloadTemplate} title="Descargar plantilla Excel">
                📋 Descargar plantilla
              </button>
              <button className="btn btn-outline" onClick={() => fileInputRef.current.click()}>
                📥 Importar Excel
              </button>
              {products.some(p => !p.barcode) && (
                <button className="btn btn-outline" onClick={generateAllBarcodes} disabled={bulkGenerating}
                  title="Genera códigos EAN-13 para todos los productos que no tienen uno">
                  {bulkGenerating
                    ? `Generando ${bulkProgress.done}/${bulkProgress.total}…`
                    : `🏷️ Generar a todos (${products.filter(p => !p.barcode).length})`}
                </button>
              )}
              {products.some(p => p.barcode) && (
                <button className="btn btn-outline"
                  onClick={() => printLabels(products.filter(p => p.barcode))}
                  title="Imprime etiquetas con código de barras para todos los productos que tienen código">
                  🖨️ Imprimir etiquetas ({products.filter(p => p.barcode).length})
                </button>
              )}
              {printSelected.size > 0 && (
                <button className="btn btn-outline" onClick={() => printLabels()}>
                  🏷️ Imprimir selección ({printSelected.size})
                </button>
              )}
              <button className="btn btn-primary" onClick={() => { setForm(emptyForm); setShowModal(true) }}>+ Agregar producto</button>
            </>
          )}
        </div>
      </div>

      {/* Stats cards */}
      {showStats && (
        <div className="inv-stats-bar">
          <div className="inv-stat"><span className="inv-stat-val">{products.length}</span><span className="inv-stat-label">Total productos</span></div>
          <div className="inv-stat"><span className="inv-stat-val" style={{ color: '#1d4ed8' }}>${totalValue.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</span><span className="inv-stat-label">Valor a costo</span></div>
          <div className="inv-stat"><span className="inv-stat-val" style={{ color: '#15803d' }}>${totalRetailValue.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</span><span className="inv-stat-label">Valor a precio venta</span></div>
          <div className="inv-stat"><span className="inv-stat-val" style={{ color: outOfStock > 0 ? '#b91c1c' : '#15803d' }}>{outOfStock}</span><span className="inv-stat-label">Agotados</span></div>
          <div className="inv-stat"><span className="inv-stat-val" style={{ color: lowStockCount > 0 ? '#b45309' : '#15803d' }}>{lowStockCount}</span><span className="inv-stat-label">Stock bajo</span></div>
        </div>
      )}

      <div className="inventory-bar">
        <input
          className="input"
          placeholder="Buscar por nombre o SKU..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 280 }}
        />
        <select className="input" value={filterStock} onChange={e => setFilterStock(e.target.value)} style={{ maxWidth: 180 }}>
          <option value="all">Todos los productos</option>
          <option value="out">Agotados</option>
          <option value="low">Stock bajo</option>
          <option value="online">En tienda online</option>
        </select>
        <select className="input" value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="name">Orden A–Z</option>
          <option value="price_desc">Precio mayor</option>
          <option value="price_asc">Precio menor</option>
          <option value="stock_asc">Menos stock</option>
          <option value="stock_desc">Más stock</option>
          <option value="margin">Mayor margen</option>
        </select>
      </div>

      {/* Category chips */}
      {categories.length > 0 && (
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
          <button
            className={`cat-chip${!filterCat ? ' active' : ''}`}
            onClick={() => setFilterCat('')}>
            Todas
          </button>
          {categories.map(c => (
            <div key={c.id} style={{ display:'flex', alignItems:'center', gap:2 }}>
              <button
                className={`cat-chip${filterCat === c.id ? ' active' : ''}`}
                style={filterCat === c.id ? {} : { borderColor: c.color, color: c.color }}
                onClick={() => setFilterCat(filterCat === c.id ? '' : c.id)}>
                {c.name}
              </button>
              {isOwner && (
                <button style={{ background:'none', border:'none', cursor:'pointer', color:'#1e293b', fontSize:12, padding:'0 2px' }}
                  onClick={() => deleteCategory(c.id)} title="Eliminar categoría">×</button>
              )}
            </div>
          ))}
          {isOwner && (
            <button className="btn btn-sm btn-outline" onClick={() => setShowCatModal(true)}>+ Categoría</button>
          )}
          <button className="btn btn-sm btn-outline" onClick={toggleEarnings}>
            {showEarnings ? 'Ocultar ganancias' : '💰 Ganancias por categoría'}
          </button>
        </div>
      )}
      {categories.length === 0 && isOwner && (
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span className="text-soft text-sm">Sin categorías.</span>
          <button className="btn btn-sm btn-outline" onClick={() => setShowCatModal(true)}>+ Agregar categoría</button>
        </div>
      )}

      {showEarnings && (
        <div className="cat-earnings">
          {catEarnings.length === 0 && (
            <p className="cat-earnings-empty">Aún no hay ventas registradas por categoría.</p>
          )}
          {catEarnings.map(c => (
            <div className="cat-earn-row" key={c.categoryId || 'sin-cat'}>
              <span className="cat-earn-dot" style={{ background: c.color }} />
              <span className="cat-earn-name">{c.name}</span>
              <span className="cat-earn-units">{Number(c.units || 0).toLocaleString('es-MX')} uds</span>
              <span className="cat-earn-rev">{fmt(c.revenue)} <small>ingresos</small></span>
              <span className="cat-earn-profit">{fmt(c.profit)} <small>ganancia</small></span>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="inv-table">
          <thead>
            <tr>
              <th style={{ width: 32 }}>
                <input type="checkbox"
                  checked={printSelected.size === filtered.length && filtered.length > 0}
                  onChange={e => setPrintSelected(e.target.checked ? new Set(filtered.map(p => p.id)) : new Set())}
                  title="Seleccionar todos"
                />
              </th>
              <th style={{ width: 44 }}></th>
              <th>Producto</th>
              <th>Código de barras</th>
              <th>Precio</th>
              <th>Costo</th>
              <th>Margen</th>
              <th>Stock</th>
              <th>Online</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const margin = p.price > 0 ? ((p.price - p.cost) / p.price * 100) : 0
              const isLow = p.stock <= p.minStock
              return (
                <tr key={p.id}>
                  <td style={{ paddingLeft: 12 }}>
                    <input type="checkbox"
                      checked={printSelected.has(p.id)}
                      onChange={e => {
                        const next = new Set(printSelected)
                        e.target.checked ? next.add(p.id) : next.delete(p.id)
                        setPrintSelected(next)
                      }}
                    />
                  </td>
                  <td style={{ padding: '8px 8px 8px 8px' }}>
                    {p.imageUrl
                      ? <img src={p.imageUrl} alt={p.name} style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', display: 'block' }} />
                      : <div style={{ width: 36, height: 36, background: '#f1f5f9', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📦</div>
                    }
                  </td>
                  <td className="inv-name">{p.name}</td>
                  <td style={{ minWidth: 140 }}>
                    {p.barcode ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span className="barcode-chip">{p.barcode}</span>
                        <BarcodeImg code={p.barcode} small />
                      </div>
                    ) : isOwner && (
                      <button className="btn btn-sm barcode-gen-btn"
                        onClick={() => generateBarcode(p)}
                        disabled={genLoading === p.id}>
                        {genLoading === p.id ? '...' : '+ Generar'}
                      </button>
                    )}
                  </td>
                  <td className="font-semibold">{fmt(p.price)}</td>
                  <td className="text-soft">{fmt(p.cost)}</td>
                  <td>
                    <span className={`badge ${margin < 20 ? 'badge-yellow' : margin > 40 ? 'badge-green' : 'badge-blue'}`}>
                      {margin.toFixed(0)}%
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${p.stock === 0 ? 'badge-red' : isLow ? 'badge-yellow' : 'badge-green'}`}>
                      {p.stock} uds
                    </span>
                  </td>
                  <td>
                    {p.isOnline
                      ? <span className="badge badge-green">Sí</span>
                      : <span className="badge badge-gray">No</span>}
                  </td>
                  <td>
                    <div className="inv-actions">
                      {isOwner && (
                        <button className="btn btn-sm btn-outline" onClick={() => openEdit(p)}>
                          Editar
                        </button>
                      )}
                      {isOwner && (
                        <button className="btn btn-sm btn-outline"
                          onClick={() => openAdjust(p)}>
                          Ajustar inventario
                        </button>
                      )}
                      {isOwner && p.barcode && (
                        <button className="btn btn-sm btn-outline"
                          onClick={() => printProductLabels(p)}
                          title="Imprime 20 etiquetas con el código de este producto para pegar en cada pieza">
                          🖨️ x20
                        </button>
                      )}
                      {isOwner && (
                        <button className="btn btn-sm"
                          style={{ background: '#dc2626', color: '#fff', border: 'none' }}
                          onClick={() => setConfirmDelete(p)}>
                          Eliminar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="empty-state" style={{ padding: 40, textAlign: 'center' }}>
            <p className="text-soft">No se encontraron productos</p>
          </div>
        )}
      </div>

      {editProduct && (
        <div className="modal-overlay" onClick={() => setEditProduct(null)}>
          <div className="modal-box card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Editar producto</h3>
              <button className="modal-close" onClick={() => setEditProduct(null)}>×</button>
            </div>
            <form onSubmit={handleEdit} className="modal-form"
              onKeyDown={e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') e.preventDefault() }}>
              <div className="form-row">
                <div className="input-group">
                  <label>Nombre *</label>
                  <input className="input" value={editForm.name} onChange={setEdit('name')} required />
                </div>
                <div className="input-group">
                  <label>SKU</label>
                  <input className="input" value={editForm.sku} onChange={setEdit('sku')} />
                </div>
              </div>
              <div className="form-row">
                <div className="input-group">
                  <label>Precio de venta *</label>
                  <input className="input" type="number" step="0.01" value={editForm.price} onChange={setEdit('price')} required min="0" />
                </div>
                <div className="input-group">
                  <label>Costo</label>
                  <input className="input" type="number" step="0.01" value={editForm.cost} onChange={setEdit('cost')} min="0" />
                </div>
              </div>
              <div className="form-row">
                <div className="input-group">
                  <label>Stock mínimo</label>
                  <input className="input" type="number" value={editForm.minStock} onChange={setEdit('minStock')} min="0" />
                </div>
              </div>
              <div className="input-group">
                <label>Código de barras</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input className="input" value={editForm.barcode || ''} onChange={setEdit('barcode')}
                    placeholder="Escanea, escribe o genera automático"
                    style={{ fontFamily: 'monospace', flex: 1 }} />
                  <button type="button" className="btn btn-outline barcode-gen-btn"
                    style={{ whiteSpace: 'nowrap', fontSize: 13 }}
                    onClick={() => setEditForm(f => ({ ...f, barcode: generateEAN13() }))}>
                    Generar código
                  </button>
                </div>
                {editForm.barcode && (
                  <div style={{ marginTop: 8 }}>
                    <BarcodeImg code={editForm.barcode} />
                  </div>
                )}
              </div>
              {categories.length > 0 && (
                <div className="input-group">
                  <label>Categoría</label>
                  <select className="input" value={editForm.categoryId || ''} onChange={setEdit('categoryId')}>
                    <option value="">Sin categoría</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <div className="input-group">
                <label>Foto del producto</label>
                <input ref={imgInputEditRef} type="file" accept="image/*" style={{ display:'none' }}
                  onChange={e => handleImageUpload(e.target.files[0], 'edit')} />
                <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                  {editForm.imageUrl
                    ? <img src={editForm.imageUrl} alt="preview"
                        style={{ width:110, height:110, objectFit:'cover', borderRadius:10, border:'1px solid #e2e8f0' }} />
                    : <div style={{ width:110, height:110, background:'#f1f5f9', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:40, border:'1px solid #e2e8f0' }}>📦</div>
                  }
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    <button type="button" className="btn btn-sm btn-outline"
                      onClick={() => imgInputEditRef.current.click()}>
                      📷 {editForm.imageUrl ? 'Cambiar foto' : 'Subir foto'}
                    </button>
                    {editForm.imageUrl && (
                      <button type="button" className="btn btn-sm btn-outline"
                        style={{ color:'#ef4444', borderColor:'#fca5a5' }}
                        onClick={() => setEditForm(f => ({ ...f, imageUrl: '' }))}>
                        Quitar
                      </button>
                    )}
                  </div>
                </div>
                <input className="input" type="url" placeholder="…o pega el link de la imagen (https://...)"
                  value={editForm.imageUrl || ''} onChange={setEdit('imageUrl')}
                  style={{ marginTop:8, fontSize:13 }} />
              </div>
              <label className="checkbox-label">
                <input type="checkbox" checked={editForm.isOnline} onChange={setEdit('isOnline')} />
                Disponible en tienda online
              </label>

              {/* ── Modo de venta ── */}
              <div className="input-group" style={{ marginTop: 8 }}>
                <label>Modo de venta</label>
                <select className="input" value={editForm.saleMode || 'UNIT'} onChange={setEdit('saleMode')}>
                  <option value="UNIT">Por pieza / unidad</option>
                  <option value="WEIGHT">Por peso (kg, g…)</option>
                  <option value="MIXED">Mixto (pieza y peso)</option>
                </select>
              </div>
              {(editForm.saleMode === 'WEIGHT' || editForm.saleMode === 'MIXED') && (
                <div className="form-row">
                  <div className="input-group">
                    <label>Unidad base</label>
                    <select className="input" value={editForm.baseUnit || 'kg'} onChange={setEdit('baseUnit')}>
                      <option value="kg">kg</option>
                      <option value="g">g (gramos)</option>
                      <option value="L">L (litros)</option>
                      <option value="mL">mL</option>
                      <option value="ton">tonelada</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label>Precio por kg</label>
                    <input className="input" type="number" step="0.01" min="0"
                      value={editForm.pricePerKg || ''} onChange={setEdit('pricePerKg')}
                      placeholder="ej: 25.00" />
                  </div>
                </div>
              )}
              <div className="input-group">
                <label style={{ display:'flex', alignItems:'center', gap:6 }}>
                  Variantes (empaque)
                  <span style={{ fontSize:11, color:'#1e293b', fontWeight:400 }}>
                    ej: Costal:50,Tonelada:1000
                  </span>
                </label>
                <input className="input" value={editForm.variants || ''} onChange={setEdit('variants')}
                  placeholder="Nombre:multiplicador, ej: Costal:50,Caja:25" />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setEditProduct(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={editSaving}>
                  {editSaving ? <div className="spinner" /> : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Nuevo producto</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreate} className="modal-form"
              onKeyDown={e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') e.preventDefault() }}>
              <div className="form-row">
                <div className="input-group">
                  <label>Nombre *</label>
                  <input className="input" value={form.name} onChange={set('name')} required />
                </div>
                <div className="input-group">
                  <label>SKU</label>
                  <input className="input" value={form.sku} onChange={set('sku')} placeholder="Opcional" />
                </div>
              </div>
              <div className="form-row">
                <div className="input-group">
                  <label>Precio de venta *</label>
                  <input className="input" type="number" step="0.01" value={form.price} onChange={set('price')} required min="0" />
                </div>
                <div className="input-group">
                  <label>Costo</label>
                  <input className="input" type="number" step="0.01" value={form.cost} onChange={set('cost')} min="0" />
                </div>
              </div>
              <div className="form-row">
                <div className="input-group">
                  <label>Stock inicial</label>
                  <input className="input" type="number" value={form.stock} onChange={set('stock')} min="0" />
                </div>
                <div className="input-group">
                  <label>Stock mínimo</label>
                  <input className="input" type="number" value={form.minStock} onChange={set('minStock')} min="0" />
                </div>
              </div>
              <div className="input-group">
                <label>Código de barras</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input className="input" value={form.barcode} onChange={set('barcode')}
                    placeholder="Escanea, escribe o genera automático"
                    style={{ fontFamily: 'monospace', flex: 1 }} />
                  <button type="button" className="btn btn-outline barcode-gen-btn"
                    style={{ whiteSpace: 'nowrap', fontSize: 13 }}
                    onClick={() => setForm(f => ({ ...f, barcode: generateEAN13() }))}>
                    Generar código
                  </button>
                </div>
                {form.barcode && (
                  <div style={{ marginTop: 8 }}>
                    <BarcodeImg code={form.barcode} />
                  </div>
                )}
              </div>
              {categories.length > 0 && (
                <div className="input-group">
                  <label>Categoría</label>
                  <select className="input" value={form.categoryId} onChange={set('categoryId')}>
                    <option value="">Sin categoría</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <div className="input-group">
                <label>Foto del producto</label>
                <input ref={imgInputCreateRef} type="file" accept="image/*" style={{ display:'none' }}
                  onChange={e => handleImageUpload(e.target.files[0], 'create')} />
                <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                  {form.imageUrl
                    ? <img src={form.imageUrl} alt="preview"
                        style={{ width:110, height:110, objectFit:'cover', borderRadius:10, border:'1px solid #e2e8f0' }} />
                    : <div style={{ width:110, height:110, background:'#f1f5f9', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:40, border:'1px solid #e2e8f0' }}>📦</div>
                  }
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    <button type="button" className="btn btn-sm btn-outline"
                      onClick={() => imgInputCreateRef.current.click()}>
                      📷 {form.imageUrl ? 'Cambiar foto' : 'Subir foto'}
                    </button>
                    {form.imageUrl && (
                      <button type="button" className="btn btn-sm btn-outline"
                        style={{ color:'#ef4444', borderColor:'#fca5a5' }}
                        onClick={() => setForm(f => ({ ...f, imageUrl: '' }))}>
                        Quitar
                      </button>
                    )}
                  </div>
                </div>
                <input className="input" type="url" placeholder="…o pega el link de la imagen (https://...)"
                  value={form.imageUrl || ''} onChange={set('imageUrl')}
                  style={{ marginTop:8, fontSize:13 }} />
              </div>
              <label className="checkbox-label">
                <input type="checkbox" checked={form.isOnline} onChange={set('isOnline')} />
                Disponible en tienda online
              </label>

              {/* ── Modo de venta ── */}
              <div className="input-group" style={{ marginTop: 8 }}>
                <label>Modo de venta</label>
                <select className="input" value={form.saleMode} onChange={set('saleMode')}>
                  <option value="UNIT">Por pieza / unidad</option>
                  <option value="WEIGHT">Por peso (kg, g…)</option>
                  <option value="MIXED">Mixto (pieza y peso)</option>
                </select>
              </div>
              {(form.saleMode === 'WEIGHT' || form.saleMode === 'MIXED') && (
                <div className="form-row">
                  <div className="input-group">
                    <label>Unidad base</label>
                    <select className="input" value={form.baseUnit} onChange={set('baseUnit')}>
                      <option value="kg">kg</option>
                      <option value="g">g (gramos)</option>
                      <option value="L">L (litros)</option>
                      <option value="mL">mL</option>
                      <option value="ton">tonelada</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label>Precio por kg</label>
                    <input className="input" type="number" step="0.01" min="0"
                      value={form.pricePerKg} onChange={set('pricePerKg')}
                      placeholder="ej: 25.00" />
                  </div>
                </div>
              )}
              <div className="input-group">
                <label style={{ display:'flex', alignItems:'center', gap:6 }}>
                  Variantes (empaque)
                  <span style={{ fontSize:11, color:'#1e293b', fontWeight:400 }}>
                    ej: Costal:50,Tonelada:1000
                  </span>
                </label>
                <input className="input" value={form.variants} onChange={set('variants')}
                  placeholder="Nombre:multiplicador, ej: Costal:50,Caja:25" />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <div className="spinner" /> : 'Crear producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── Import modal ── */}
      {showImport && (
        <div className="modal-overlay" onClick={() => setShowImport(false)}>
          <div className="modal-box card import-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📥 Vista previa — {importRows.length} productos</h3>
              <button className="modal-close" onClick={() => setShowImport(false)}>×</button>
            </div>
            <p className="import-hint">
              Revisa que los datos sean correctos. Los productos se agregarán a tu inventario actual.
            </p>

            <div className="import-preview">
              <table className="inv-table">
                <thead>
                  <tr>
                    <th>Nombre</th><th>Precio</th><th>Costo</th><th>Stock</th><th>SKU</th><th>Barcode</th><th>Online</th>
                  </tr>
                </thead>
                <tbody>
                  {importRows.slice(0, 8).map((r, i) => (
                    <tr key={`${r.name}-${i}`}>
                      <td>{r.name}</td>
                      <td>${parseFloat(r.price || 0).toFixed(2)}</td>
                      <td>${parseFloat(r.cost || 0).toFixed(2)}</td>
                      <td>{r.stock || 0}</td>
                      <td className="text-soft text-sm">{r.sku || '—'}</td>
                      <td className="text-soft text-sm">{r.barcode || '—'}</td>
                      <td>{r.isOnline ? '✓' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {importRows.length > 8 && (
                <p className="import-more">…y {importRows.length - 8} productos más</p>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowImport(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={doImport} disabled={importing}>
                {importing ? <div className="spinner" /> : `Importar ${importRows.length} productos`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Drop zone (full page) ── */}
      {!showImport && (
        <div
          className={`import-dropzone${dragOver ? ' drag-over' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        />
      )}

      {dragOver && (
        <div className="import-drag-overlay">
          <div className="import-drag-message">
            <span>📥</span>
            <p>Suelta el archivo Excel aquí</p>
          </div>
        </div>
      )}

      {/* ── Modal Ajustar inventario ── */}
      {adjustProduct && (
        <div className="modal-overlay" onClick={() => setAdjustProduct(null)}>
          <div className="modal-box card" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Ajustar inventario</h3>
              <button className="modal-close" onClick={() => setAdjustProduct(null)}>×</button>
            </div>

            <div style={{ padding: '0 0 16px' }}>
              {/* Nombre + stock actual */}
              <div style={{
                background: '#f8fafc', borderRadius: 10, padding: '12px 14px',
                marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12,
              }}>
                {adjustProduct.imageUrl
                  ? <img src={adjustProduct.imageUrl} alt={adjustProduct.name}
                      style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                  : <div style={{ width: 44, height: 44, background: '#e2e8f0', borderRadius: 8,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>📦</div>
                }
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{adjustProduct.name}</div>
                  <div style={{ fontSize: 13, color: '#1e293b', marginTop: 2 }}>
                    Stock actual: <strong style={{ color: adjustProduct.stock === 0 ? '#ef4444' : '#0f172a' }}>
                      {adjustProduct.stock} uds
                    </strong>
                  </div>
                </div>
              </div>

              {/* Input de cantidad */}
              <div className="input-group" style={{ marginBottom: 16 }}>
                <label>Cantidad de unidades</label>
                <input
                  className="input"
                  type="number"
                  min="0.01"
                  step="any"
                  value={adjustQty}
                  onChange={e => setAdjustQty(e.target.value)}
                  placeholder="Ej: 10"
                  autoFocus
                  style={{ fontSize: 18, fontWeight: 700, textAlign: 'center' }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && parseFloat(adjustQty) > 0) doAdjust(1)
                  }}
                />
              </div>

              {/* Dos botones */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button
                  className="btn"
                  disabled={adjusting || !adjustQty}
                  onClick={() => doAdjust(1)}
                  style={{
                    background: 'linear-gradient(135deg,#16a34a,#15803d)',
                    color: '#fff', border: 'none', borderRadius: 12,
                    padding: '14px 10px', fontWeight: 700, fontSize: 14,
                    cursor: adjusting || !adjustQty ? 'not-allowed' : 'pointer',
                    opacity: adjusting || !adjustQty ? 0.6 : 1,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    boxShadow: '0 3px 10px rgba(22,163,74,.35)',
                  }}>
                  <span style={{ fontSize: 22 }}>➕</span>
                  Agregar al stock
                </button>
                <button
                  className="btn"
                  disabled={adjusting || !adjustQty}
                  onClick={() => doAdjust(-1)}
                  style={{
                    background: 'linear-gradient(135deg,#dc2626,#b91c1c)',
                    color: '#fff', border: 'none', borderRadius: 12,
                    padding: '14px 10px', fontWeight: 700, fontSize: 14,
                    cursor: adjusting || !adjustQty ? 'not-allowed' : 'pointer',
                    opacity: adjusting || !adjustQty ? 0.6 : 1,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    boxShadow: '0 3px 10px rgba(220,38,38,.35)',
                  }}>
                  <span style={{ fontSize: 22 }}>➖</span>
                  Quitar del stock
                </button>
              </div>

              {/* Preview del resultado */}
              {adjustQty && parseFloat(adjustQty) > 0 && (
                <div style={{
                  marginTop: 14, background: '#f0f9ff', borderRadius: 10, padding: '10px 14px',
                  border: '1px solid #bae6fd', display: 'flex', justifyContent: 'space-between',
                  fontSize: 13,
                }}>
                  <span style={{ color: '#0369a1' }}>Nuevo stock si agregas:</span>
                  <strong style={{ color: '#0369a1' }}>{adjustProduct.stock + parseFloat(adjustQty)} uds</strong>
                  <span style={{ color: '#dc2626', marginLeft: 16 }}>Si quitas:</span>
                  <strong style={{ color: adjustProduct.stock - parseFloat(adjustQty) < 0 ? '#dc2626' : '#dc2626' }}>
                    {Math.max(0, adjustProduct.stock - parseFloat(adjustQty))} uds
                  </strong>
                </div>
              )}

              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <button className="btn btn-outline" onClick={() => setAdjustProduct(null)}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal confirmar eliminación de producto ── */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => !deleting && setConfirmDelete(null)}>
          <div className="modal-box card" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Eliminar producto</h3>
              <button className="modal-close" onClick={() => setConfirmDelete(null)}>×</button>
            </div>
            <div style={{ padding: '0 0 16px' }}>
              <p style={{ fontSize: 14, color: '#0f172a', lineHeight: 1.5 }}>
                ¿Deseas eliminar <strong>"{confirmDelete.name}"</strong> del inventario?
                Esta acción no se puede deshacer y ya no aparecerá en el inventario, POS ni tienda online.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 20 }}>
                <button
                  disabled={deleting}
                  onClick={doDeleteProduct}
                  style={{
                    background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10,
                    padding: '12px 10px', fontWeight: 700, fontSize: 14,
                    cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.6 : 1,
                  }}>
                  {deleting ? <div className="spinner" /> : 'Sí, eliminar'}
                </button>
                <button
                  disabled={deleting}
                  onClick={() => setConfirmDelete(null)}
                  style={{
                    background: '#dc2626', color: '#fff', border: 'none', borderRadius: 10,
                    padding: '12px 10px', fontWeight: 700, fontSize: 14,
                    cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.6 : 1,
                  }}>
                  No
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create category modal */}
      {showCatModal && (
        <div className="modal-overlay" onClick={() => setShowCatModal(false)}>
          <div className="modal-box card" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Nueva categoría</h3>
              <button className="modal-close" onClick={() => setShowCatModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateCategory} className="modal-form">
              <div className="input-group">
                <label>Nombre *</label>
                <input className="input" value={catForm.name}
                  onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="input-group">
                <label>Color</label>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <input type="color" value={catForm.color}
                    onChange={e => setCatForm(f => ({ ...f, color: e.target.value }))}
                    style={{ width:36, height:36, border:'none', padding:0, cursor:'pointer', borderRadius:6 }} />
                  <span className="text-soft text-sm">{catForm.color}</span>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowCatModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={catSaving}>
                  {catSaving ? <div className="spinner" /> : 'Crear categoría'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
