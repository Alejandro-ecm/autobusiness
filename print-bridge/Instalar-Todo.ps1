# ═══════════════════════════════════════════════════════════════
#  AutoBusiness — Instalador de impresión (todo en uno)
#
#  Un solo paso para dejar la impresora térmica de un negocio lista:
#   1) Detecta e instala la impresora conectada por USB (si hace falta)
#   2) Pide el correo/contraseña del dueño y conecta la cola en la nube
#      (para que iPhone y Android impriman a través de esta PC)
#   3) Deja el arranque automático con Windows
#   4) Imprime un ticket de prueba para confirmar
#
#  Se ejecuta con doble clic en INSTALAR.bat (junto a este archivo).
# ═══════════════════════════════════════════════════════════════

$ErrorActionPreference = 'Stop'
$Server = 'https://autobusiness.skytechnologieslatam.com'
$BridgeScript = Join-Path $PSScriptRoot 'AutoBusinessPrintBridge.ps1'

function Section($titulo) {
    Write-Host ""
    Write-Host "-- $titulo " -ForegroundColor Cyan -NoNewline
    Write-Host ("-" * [Math]::Max(1, 50 - $titulo.Length)) -ForegroundColor Cyan
}

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Magenta
Write-Host "   AutoBusiness — Instalador de impresión de tickets" -ForegroundColor Magenta
Write-Host "=======================================================" -ForegroundColor Magenta

if (-not (Test-Path $BridgeScript)) {
    Write-Host ""
    Write-Host "ERROR: falta AutoBusinessPrintBridge.ps1 junto a este instalador." -ForegroundColor Red
    Write-Host "Copia toda la carpeta print-bridge completa, no solo este archivo." -ForegroundColor Red
    Read-Host "Presiona Enter para salir"
    exit 1
}

# ── Paso 1: impresora ─────────────────────────────────────────────
Section "Paso 1 de 3 — Impresora"

$yaInstalada = Get-Printer -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match 'POS|58|80|[Tt]hermal|[Tt]icket' } | Select-Object -First 1

if ($yaInstalada) {
    Write-Host "Ya hay una impresora de tickets instalada: $($yaInstalada.Name)" -ForegroundColor Green
} else {
    Write-Host "Buscando la impresora térmica conectada por USB..."
    $puerto = $null
    for ($intento = 1; $intento -le 1; $intento++) {
        $puerto = Get-PrinterPort -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -match '^USB\d+$' } |
            Sort-Object Name | Select-Object -First 1
        if ($puerto) { break }
    }

    if (-not $puerto) {
        Write-Host ""
        Write-Host "No se detectó ninguna impresora conectada por USB." -ForegroundColor Yellow
        Write-Host "Conecta la impresora térmica a un puerto USB, enciéndela," -ForegroundColor Yellow
        Write-Host "y presiona Enter para volver a buscar (o escribe 'saltar' para continuar sin instalarla ahora)."
        $resp = Read-Host ">"
        if ($resp -ne 'saltar') {
            $puerto = Get-PrinterPort -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -match '^USB\d+$' } | Sort-Object Name | Select-Object -First 1
        }
    }

    if ($puerto) {
        if (-not (Get-PrinterDriver -Name "Generic / Text Only" -ErrorAction SilentlyContinue)) {
            Add-PrinterDriver -Name "Generic / Text Only"
        }
        Add-Printer -Name "POS-58" -DriverName "Generic / Text Only" -PortName $puerto.Name
        Write-Host "Impresora instalada como 'POS-58' en el puerto $($puerto.Name)." -ForegroundColor Green
    } else {
        Write-Host "Continuando sin instalar la impresora — vuelve a ejecutar este instalador cuando esté conectada." -ForegroundColor Yellow
    }
}

# ── Paso 2: cuenta del negocio (cola en la nube) ──────────────────
Section "Paso 2 de 3 — Cuenta del negocio"

Write-Host "Para que los celulares (iPhone incluido) impriman a través de esta PC,"
Write-Host "escribe la cuenta del DUEÑO o ADMIN del negocio en AutoBusiness."
Write-Host ""

$conectado = $false
$intentos = 0
while (-not $conectado -and $intentos -lt 3) {
    $intentos++
    $email = Read-Host "Correo"
    $passSecure = Read-Host "Contraseña" -AsSecureString
    $pass = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($passSecure))

    try {
        $login = Invoke-RestMethod -Method Post -Uri "$Server/api/auth/login" `
            -ContentType 'application/json' `
            -Body (@{ email = $email; password = $pass } | ConvertTo-Json)
    } catch {
        Write-Host "Correo o contraseña incorrectos. Intenta de nuevo." -ForegroundColor Red
        continue
    }

    try {
        $keyResp = Invoke-RestMethod -Uri "$Server/api/print-jobs/bridge-key" `
            -Headers @{ Authorization = "Bearer $($login.token)" }
    } catch {
        Write-Host "Esta cuenta no es dueño/administrador del negocio. Usa esa cuenta." -ForegroundColor Red
        continue
    }

    @{ printKey = $keyResp.printKey; server = $Server } | ConvertTo-Json |
        Set-Content -Path (Join-Path $PSScriptRoot 'config.json') -Encoding utf8
    Write-Host "Cuenta conectada: $($login.user.businessName)" -ForegroundColor Green
    $conectado = $true
}

if (-not $conectado) {
    Write-Host ""
    Write-Host "No se pudo conectar la cuenta — la impresora seguirá funcionando" -ForegroundColor Yellow
    Write-Host "solo para ventas cobradas EN ESTA PC. Vuelve a ejecutar el instalador" -ForegroundColor Yellow
    Write-Host "para activar la impresión desde celulares." -ForegroundColor Yellow
}

# ── Paso 3: arranque automático + prueba ──────────────────────────
Section "Paso 3 de 3 — Arranque automático y prueba"

$startup = [Environment]::GetFolderPath('Startup')
$vbsPath = Join-Path $startup 'AutoBusinessPrintBridge.vbs'
$vbs = @"
Set shell = CreateObject("WScript.Shell")
shell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""$BridgeScript""", 0, False
"@
Set-Content -Path $vbsPath -Value $vbs -Encoding ASCII

# Detener instancias previas (evita puertos ocupados / versiones viejas)
Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match 'AutoBusinessPrintBridge' -and $_.ProcessId -ne $PID } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 1

Start-Process 'wscript.exe' -ArgumentList "`"$vbsPath`""
Write-Host "Iniciando..." -NoNewline
$listo = $false
for ($i = 0; $i -lt 8; $i++) {
    Start-Sleep -Seconds 1
    Write-Host "." -NoNewline
    try {
        $status = Invoke-RestMethod -Uri 'http://localhost:17891/status' -TimeoutSec 3
        $listo = $true
        break
    } catch { }
}
Write-Host ""

if (-not $listo) {
    Write-Host ""
    Write-Host "El programa no respondió a tiempo. Reinicia la PC e intenta de nuevo," -ForegroundColor Red
    Write-Host "o avisa a soporte." -ForegroundColor Red
    Read-Host "Presiona Enter para salir"
    exit 1
}

Write-Host "Programa activo. Impresora detectada: $($status.printer)" -ForegroundColor Green

if ($status.printer) {
    Write-Host ""
    Write-Host "Imprimiendo ticket de prueba..."
    try {
        Invoke-RestMethod -Method Post -Uri 'http://localhost:17891/test' -TimeoutSec 10 | Out-Null
        Write-Host "Ticket de prueba enviado — revisa la impresora." -ForegroundColor Green
    } catch {
        Write-Host "No se pudo imprimir la prueba: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Green
Write-Host " LISTO — esta PC ya imprime los tickets de AutoBusiness." -ForegroundColor Green
Write-Host " Se iniciará solo cada vez que se encienda la computadora." -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
Read-Host "Presiona Enter para cerrar"
