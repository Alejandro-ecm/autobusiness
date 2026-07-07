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

La Caja de AutoBusiness intenta primero imprimir por el bridge (silencioso,
sin diálogos). Si el bridge no está corriendo en esa PC, cae al diálogo de
impresión normal del navegador. Funciona también con ventas offline —
el bridge es local y no necesita internet.

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
