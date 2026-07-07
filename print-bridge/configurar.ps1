# Configura la cola de impresión en la nube para este Print Bridge.
# Pide las credenciales del dueño/admin del negocio, obtiene la llave
# secreta de impresión y la guarda en config.json.
# Ejecutar manualmente: clic derecho → Ejecutar con PowerShell

$Server = 'https://autobusiness.skytechnologieslatam.com'

Write-Host ""
Write-Host "=== AutoBusiness Print Bridge — Configurar impresión desde celulares ===" -ForegroundColor Cyan
Write-Host "Inicia sesión con la cuenta del DUEÑO o ADMIN del negocio."
Write-Host ""

$email = Read-Host "Correo"
$passSecure = Read-Host "Contraseña" -AsSecureString
$pass = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($passSecure))

try {
    $login = Invoke-RestMethod -Method Post -Uri "$Server/api/auth/login" `
        -ContentType 'application/json' `
        -Body (@{ email = $email; password = $pass } | ConvertTo-Json)
} catch {
    Write-Host "No se pudo iniciar sesión — revisa correo y contraseña." -ForegroundColor Red
    exit 1
}

try {
    $keyResp = Invoke-RestMethod -Uri "$Server/api/print-jobs/bridge-key" `
        -Headers @{ Authorization = "Bearer $($login.token)" }
} catch {
    Write-Host "No se pudo obtener la llave (¿la cuenta es OWNER o ADMIN?)." -ForegroundColor Red
    exit 1
}

@{ printKey = $keyResp.printKey; server = $Server } | ConvertTo-Json |
    Set-Content -Path (Join-Path $PSScriptRoot 'config.json') -Encoding utf8

Write-Host ""
Write-Host "Llave guardada en config.json." -ForegroundColor Green

# Reiniciar el bridge para que tome la configuración
$prev = Get-NetTCPConnection -LocalPort 17891 -State Listen -ErrorAction SilentlyContinue
if ($prev) {
    $prev | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 1
}
$vbs = Join-Path ([Environment]::GetFolderPath('Startup')) 'AutoBusinessPrintBridge.vbs'
if (Test-Path $vbs) { Start-Process 'wscript.exe' -ArgumentList "`"$vbs`"" }
else { Write-Host "Ejecuta también instalar.ps1 para dejar el bridge en el arranque." -ForegroundColor Yellow }

Write-Host ""
Write-Host "=========================================================" -ForegroundColor Green
Write-Host " Listo: los celulares del negocio (iPhone incluido) ya" -ForegroundColor Green
Write-Host " imprimen en esta PC. Prueba cobrando desde el celular." -ForegroundColor Green
Write-Host "=========================================================" -ForegroundColor Green
