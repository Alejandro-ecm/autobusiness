# AutoBusiness Print Bridge

Servicio local para Windows que conecta AutoBusiness AI (web) con impresoras
térmicas de tickets ESC/POS (58mm, tipo POS-58 / 58-LL).

```
AutoBusiness AI (navegador)
        ↓  POST http://localhost:17891/print
AutoBusiness Print Bridge (esta carpeta)
        ↓  bytes ESC/POS RAW via spooler de Windows
Impresora térmica USB
```

## Requisitos

1. Windows 10/11.
2. La impresora conectada por USB e instalada como impresora de Windows.
   Si Windows no la instala sola, basta el driver **"Generic / Text Only"**
   apuntando al puerto `USB001` (no se necesita driver del fabricante):

   ```powershell
   Add-PrinterDriver -Name "Generic / Text Only"
   Add-Printer -Name "POS-58" -DriverName "Generic / Text Only" -PortName "USB001"
   ```

## Instalación

Clic derecho en `instalar.ps1` → **Ejecutar con PowerShell**, o en una terminal:

```powershell
powershell -ExecutionPolicy Bypass -File .\instalar.ps1
```

Esto arranca el bridge de inmediato y lo deja en la carpeta Inicio para que
corra automáticamente (oculto) cada vez que se prende la PC. No requiere
permisos de administrador.

## Endpoints

| Método | Ruta      | Descripción                          |
|--------|-----------|--------------------------------------|
| GET    | `/status` | `{ok, version, printer}`             |
| POST   | `/test`   | Imprime un ticket de prueba          |
| POST   | `/print`  | Imprime un ticket de venta (JSON)    |

### Formato de `/print`

```json
{
  "business": "Abarrotes Alex",
  "folio": "A1B2C3D4",
  "date": "07/07/2026 14:33",
  "cashier": "Alejandro",
  "payMethod": "Efectivo",
  "items": [
    { "name": "Coca Cola 600ml", "quantity": 2, "price": 22, "subtotal": 44 }
  ],
  "subtotal": 44,
  "discountAmount": 0,
  "total": 44,
  "received": 50,
  "change": 6,
  "storeUrl": "autobusiness.skytechnologieslatam.com/tienda/mi-tienda",
  "offline": false
}
```

Si `storeUrl` viene, el ticket imprime un **código QR** de la tienda online.

## Cómo lo usa la Caja (POS)

Al cobrar, la Caja intenta imprimir en este orden:

1. **Print Bridge local** (esta PC, USB) — silencioso, funciona sin internet.
2. **Bluetooth** (Android/Chrome) — el celular le imprime directo a la térmica.
3. **Cola en la nube** — el ticket viaja al servidor y lo imprime el bridge
   de la PC o la Estación de Impresión del negocio (así imprimen los iPhone).
4. Diálogo de impresión del navegador (último recurso).

## Impresión desde celulares (cola en la nube)

Para que los celulares del negocio (incluidos **iPhone**) impriman en la
térmica conectada a esta PC:

```powershell
powershell -ExecutionPolicy Bypass -File .\configurar.ps1
```

Pide el correo y contraseña del dueño/admin, guarda la llave secreta del
negocio en `config.json` (no se sube a git) y reinicia el bridge. A partir
de ahí el bridge revisa la cola cada 5 segundos e imprime lo que cobren
los celulares.

### Negocios sin PC

No necesitan este bridge: cualquier teléfono/tablet **Android** con Chrome
sirve como impresora del negocio abriendo la página `/impresora`
(Estación de Impresión), conectándola por Bluetooth a la térmica y dejándola
encendida junto a la impresora. Los iPhone cobran y la estación imprime.

## Detección de impresora

El bridge busca una impresora instalada cuyo nombre contenga
`POS`, `58`, `80`, `Thermal` o `Ticket`; si no hay, usa la primera impresora
real (ignora PDF/OneNote/XPS/Fax).

## Solución de problemas

- **No imprime nada:** revisa que la impresora aparezca en
  `Configuración → Bluetooth y dispositivos → Impresoras y escáneres` y que
  imprima el `/test`:
  ```powershell
  Invoke-RestMethod -Method Post -Uri http://localhost:17891/test
  ```
- **Acentos mal impresos (Ã©, etc.):** cambia `$CodePage`/`$TextCodec` al
  inicio de `AutoBusinessPrintBridge.ps1` (prueba `0` / `437`).
- **El bridge no responde:** verifica que esté corriendo:
  ```powershell
  Invoke-RestMethod http://localhost:17891/status
  ```
