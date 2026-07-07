# ═══════════════════════════════════════════════════════════════
#  AutoBusiness Print Bridge v1.0
#  Servicio local que recibe tickets de AutoBusiness AI (web) y los
#  imprime en impresoras termicas ESC/POS (probado con 58-LL / POS-58,
#  384 dots = 32 columnas).
#
#  Endpoints (http://localhost:17891):
#    GET  /status  → estado del bridge y nombre de la impresora
#    POST /test    → imprime ticket de prueba
#    POST /print   → imprime ticket de venta (JSON)
# ═══════════════════════════════════════════════════════════════

$Port       = 17891
$CodePage   = 16      # ESC t n — 16 = Windows-1252 en la mayoria de POS-58
$TextCodec  = 1252    # codificacion .NET usada para los acentos
$LineWidth  = 32      # 384 dots / 12 = 32 columnas en fuente A

# Autodeteccion: primero una impresora que parezca termica, si no la default
function Find-Printer {
    $printers = Get-Printer -ErrorAction SilentlyContinue
    $thermal = $printers | Where-Object { $_.Name -match 'POS|58|80|[Tt]hermal|[Tt]icket' } | Select-Object -First 1
    if ($thermal) { return $thermal.Name }
    $default = $printers | Where-Object { $_.Name -notmatch 'PDF|OneNote|XPS|Fax' } | Select-Object -First 1
    if ($default) { return $default.Name }
    return $null
}

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class RawPrinter {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi)]
    public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);
    [DllImport("winspool.Drv", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In] DOCINFOA di);
    [DllImport("winspool.Drv", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);

    public static bool SendBytes(string printerName, byte[] bytes) {
        IntPtr h;
        if (!OpenPrinter(printerName, out h, IntPtr.Zero)) return false;
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "AutoBusiness Ticket";
        di.pDataType = "RAW";
        bool ok = false;
        if (StartDocPrinter(h, 1, di)) {
            if (StartPagePrinter(h)) {
                int written;
                ok = WritePrinter(h, bytes, bytes.Length, out written);
                EndPagePrinter(h);
            }
            EndDocPrinter(h);
        }
        ClosePrinter(h);
        return ok;
    }
}
"@

# ── Constructor de bytes ESC/POS ─────────────────────────────────
$script:Enc = [System.Text.Encoding]::GetEncoding($TextCodec)

function New-Ticket { ,(New-Object System.Collections.Generic.List[byte]) }
function T-Bytes($t, [byte[]]$b) { $t.AddRange($b) }
function T-Text($t, [string]$s)  { $t.AddRange($script:Enc.GetBytes($s)) }
function T-Line($t, [string]$s = '') { T-Text $t ($s + "`n") }
function T-Init($t)     { T-Bytes $t @(27,64); T-Bytes $t @(27,116,$CodePage) }  # ESC @ + ESC t
function T-Center($t)   { T-Bytes $t @(27,97,1) }
function T-Left($t)     { T-Bytes $t @(27,97,0) }
function T-Big($t)      { T-Bytes $t @(29,33,17) }   # doble alto y ancho
function T-Tall($t)     { T-Bytes $t @(29,33,16) }   # doble alto
function T-Normal($t)   { T-Bytes $t @(29,33,0) }
function T-Bold($t,$on) { T-Bytes $t @(27,69,$(if($on){1}else{0})) }
function T-Sep($t)      { T-Line $t ('-' * $LineWidth) }
function T-Feed($t,$n)  { T-Bytes $t @(27,100,$n) }
function T-Cut($t)      { T-Bytes $t @(29,86,66,0) } # corte parcial; ignorado si no hay cortador

# Linea "izquierda ... derecha" en 32 columnas
function T-Row($t, [string]$left, [string]$right) {
    $space = $LineWidth - $left.Length - $right.Length
    if ($space -lt 1) {
        $left = $left.Substring(0, [Math]::Max(0, $LineWidth - $right.Length - 1))
        $space = 1
    }
    T-Line $t ($left + (' ' * $space) + $right)
}

# Partir texto largo en lineas de ancho maximo
function Split-Wrap([string]$s, [int]$max) {
    $out = @()
    while ($s.Length -gt $max) { $out += $s.Substring(0, $max); $s = $s.Substring($max) }
    if ($s.Length -gt 0) { $out += $s }
    return $out
}

# QR nativo ESC/POS (GS ( k) — la 58-LL lo soporta segun su self-test
function T-QR($t, [string]$data) {
    $d = [System.Text.Encoding]::ASCII.GetBytes($data)
    $len = $d.Length + 3
    $pL = $len -band 0xFF; $pH = ($len -shr 8) -band 0xFF
    T-Bytes $t @(29,40,107,4,0,49,65,50,0)        # modelo 2
    T-Bytes $t @(29,40,107,3,0,49,67,5)           # tamano de modulo 5
    T-Bytes $t @(29,40,107,3,0,49,69,48)          # correccion L
    T-Bytes $t (@(29,40,107,$pL,$pH,49,80,48) + $d)  # guardar datos
    T-Bytes $t @(29,40,107,3,0,49,81,48)          # imprimir
}

function Format-Money($n) { '$' + ([decimal]$n).ToString('N2') }

# ── Ticket de venta desde el JSON del POS ────────────────────────
function Build-SaleTicket($j) {
    $t = New-Ticket
    T-Init $t
    T-Center $t

    T-Big $t
    T-Line $t ([string]$j.business).ToUpper()
    T-Normal $t
    if ($j.storeUrl) { T-Line $t "Pedidos en linea:"; T-Line $t ([string]$j.storeUrl) }
    T-Left $t
    T-Sep $t

    $fecha = if ($j.date) { [string]$j.date } else { (Get-Date).ToString('dd/MM/yyyy HH:mm') }
    T-Row $t ("Folio: " + [string]$j.folio) $fecha
    if ($j.cashier)   { T-Line $t ("Le atendio: " + [string]$j.cashier) }
    if ($j.payMethod) { T-Line $t ("Pago: " + [string]$j.payMethod + $(if ($j.offline) {' (offline)'} else {''})) }
    T-Sep $t

    $piezas = 0
    foreach ($item in $j.items) {
        $qty = [decimal]$item.quantity
        $piezas += $qty
        $qtyStr = if ($qty -eq [Math]::Truncate($qty)) { [string][int]$qty } else { $qty.ToString('0.###') }
        foreach ($line in (Split-Wrap ("$qtyStr x " + [string]$item.name) $LineWidth)) { T-Line $t $line }
        $unit = if ($qty -ne 1) { (Format-Money $item.price) + ' c/u' } else { '' }
        T-Row $t ('  ' + $unit) (Format-Money $item.subtotal)
    }
    T-Sep $t

    T-Row $t ("Articulos: " + $piezas.ToString('0.###')) ''
    T-Row $t 'Subtotal' (Format-Money $j.subtotal)
    if ($j.discountAmount -and [decimal]$j.discountAmount -gt 0) {
        T-Row $t 'Descuento' ('-' + (Format-Money $j.discountAmount))
    }
    T-Bold $t $true
    T-Tall $t
    T-Row $t 'TOTAL' (Format-Money $j.total)
    T-Normal $t
    T-Bold $t $false
    if ($j.received -and [decimal]$j.received -gt 0) { T-Row $t 'Efectivo' (Format-Money $j.received) }
    if ($j.change -and [decimal]$j.change -gt 0)     { T-Row $t 'Su cambio' (Format-Money $j.change) }
    T-Sep $t

    T-Center $t
    T-Bold $t $true
    T-Line $t '* Gracias por su compra *'
    T-Bold $t $false
    T-Line $t 'Te esperamos pronto'
    if ($j.storeUrl) {
        T-Feed $t 1
        T-QR $t ('https://' + ([string]$j.storeUrl -replace '^https?://',''))
        T-Line $t 'Escanea para pedir en linea'
    }
    T-Feed $t 4
    T-Cut $t
    return $t.ToArray()
}

function Build-TestTicket($printerName) {
    $t = New-Ticket
    T-Init $t
    T-Center $t
    T-Big $t;  T-Line $t 'AUTOBUSINESS AI'; T-Normal $t
    T-Line $t 'Print Bridge funcionando'
    T-Sep $t
    T-Left $t
    T-Line $t ("Impresora: " + $printerName)
    T-Line $t ("Fecha: " + (Get-Date).ToString('dd/MM/yyyy HH:mm'))
    T-Line $t 'Acentos: a e i o u -> á é í ó ú ñ'
    T-Line $t 'Simbolos: ¿ ¡ $ 100.50'
    T-Sep $t
    T-Center $t
    T-QR $t 'https://autobusiness.skytechnologieslatam.com'
    T-Line $t 'QR de prueba'
    T-Feed $t 4
    T-Cut $t
    return $t.ToArray()
}

# ── Servidor HTTP ────────────────────────────────────────────────
function Send-Json($ctx, [int]$code, $obj) {
    $body = [System.Text.Encoding]::UTF8.GetBytes(($obj | ConvertTo-Json -Compress))
    $r = $ctx.Response
    $r.StatusCode = $code
    $r.ContentType = 'application/json'
    $r.Headers.Add('Access-Control-Allow-Origin', '*')
    $r.ContentLength64 = $body.Length
    $r.OutputStream.Write($body, 0, $body.Length)
    $r.Close()
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Start()
Write-Host "AutoBusiness Print Bridge escuchando en http://localhost:$Port"
Write-Host "Impresora detectada: $(Find-Printer)"

while ($listener.IsListening) {
    try {
        $ctx = $listener.GetContext()
        $req = $ctx.Request
        $path = $req.Url.AbsolutePath.TrimEnd('/')

        # CORS preflight
        if ($req.HttpMethod -eq 'OPTIONS') {
            $r = $ctx.Response
            $r.Headers.Add('Access-Control-Allow-Origin', '*')
            $r.Headers.Add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            $r.Headers.Add('Access-Control-Allow-Headers', 'Content-Type')
            # Chrome Private Network Access: requerido para que un sitio HTTPS
            # pueda llamar a localhost
            $r.Headers.Add('Access-Control-Allow-Private-Network', 'true')
            $r.StatusCode = 204
            $r.Close()
            continue
        }

        $printer = Find-Printer

        switch -Regex ("$($req.HttpMethod) $path") {
            '^GET /status$' {
                Send-Json $ctx 200 @{ ok = $true; version = '1.0'; printer = $printer }
            }
            '^POST /test$' {
                if (-not $printer) { Send-Json $ctx 503 @{ ok = $false; error = 'No hay impresora instalada' }; break }
                $ok = [RawPrinter]::SendBytes($printer, (Build-TestTicket $printer))
                Send-Json $ctx $(if ($ok) {200} else {500}) @{ ok = $ok; printer = $printer }
            }
            '^POST /print$' {
                if (-not $printer) { Send-Json $ctx 503 @{ ok = $false; error = 'No hay impresora instalada' }; break }
                $reader = New-Object System.IO.StreamReader($req.InputStream, $req.ContentEncoding)
                $json = $reader.ReadToEnd() | ConvertFrom-Json
                $ok = [RawPrinter]::SendBytes($printer, (Build-SaleTicket $json))
                Send-Json $ctx $(if ($ok) {200} else {500}) @{ ok = $ok; printer = $printer }
            }
            default {
                Send-Json $ctx 404 @{ ok = $false; error = 'Ruta no encontrada' }
            }
        }
    } catch {
        # Nunca tirar el servidor por un request malformado
        try { Send-Json $ctx 400 @{ ok = $false; error = $_.Exception.Message } } catch {}
    }
}
