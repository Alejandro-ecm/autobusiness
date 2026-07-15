# Instala el AutoBusiness Print Bridge para que arranque con Windows
# (carpeta Inicio del usuario — no requiere permisos de administrador)

$bridgeScript = Join-Path $PSScriptRoot 'AutoBusinessPrintBridge.ps1'
if (-not (Test-Path $bridgeScript)) {
    Write-Host "ERROR: no se encontro AutoBusinessPrintBridge.ps1 junto a este instalador" -ForegroundColor Red
    exit 1
}

$startup = [Environment]::GetFolderPath('Startup')
$vbsPath = Join-Path $startup 'AutoBusinessPrintBridge.vbs'

# Lanzador VBS: corre PowerShell oculto (sin ventana negra molesta)
$vbs = @"
Set shell = CreateObject("WScript.Shell")
shell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""$bridgeScript""", 0, False
"@
Set-Content -Path $vbsPath -Value $vbs -Encoding ASCII

# Detener TODAS las instancias previas del bridge (por linea de comandos,
# no solo la que tiene el puerto — evita zombis con versiones viejas)
Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match 'AutoBusinessPrintBridge' -and $_.ProcessId -ne $PID } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 1

# Arrancar ahora mismo
Start-Process 'wscript.exe' -ArgumentList "`"$vbsPath`""
Start-Sleep -Seconds 4

# Verificar
try {
    $status = Invoke-RestMethod -Uri 'http://localhost:17891/status' -TimeoutSec 5
    Write-Host ""
    Write-Host "=========================================" -ForegroundColor Green
    Write-Host " Print Bridge instalado y corriendo" -ForegroundColor Green
    Write-Host " Impresora: $($status.printer)" -ForegroundColor Green
    Write-Host " Se iniciara solo cada vez que prendas la PC" -ForegroundColor Green
    Write-Host "=========================================" -ForegroundColor Green
} catch {
    Write-Host "El bridge se instalo pero no responde aun. Reinicia la PC o ejecuta:" -ForegroundColor Yellow
    Write-Host "  powershell -ExecutionPolicy Bypass -File `"$bridgeScript`"" -ForegroundColor Yellow
}
