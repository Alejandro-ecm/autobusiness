# scripts/predeploy.ps1 - Verificacion obligatoria antes de subir a produccion.
# Vercel despliega automaticamente cada push a main. Uso: pwsh -File .\scripts\predeploy.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$branch = git rev-parse --abbrev-ref HEAD

git fetch origin --quiet
if (git status --porcelain) { throw "Hay cambios sin commit. Haz commit primero." }

if ((git merge-base HEAD origin/main) -ne (git rev-parse origin/main)) {
  throw "La rama '$branch' no parte del origin/main actual. Haz: git rebase origin/main"
}

$changed = git diff --name-only origin/main..HEAD
if (-not $changed) { throw "No hay nada nuevo contra origin/main." }

$fueraDeFrontend = $changed | Where-Object { $_ -notlike 'frontend/*' -and $_ -notlike 'docs/*' -and $_ -notlike 'scripts/*' }
if ($fueraDeFrontend) {
  Write-Host "`nArchivos fuera de frontend (necesitan Railway o instalacion manual):" -ForegroundColor Red
  $fueraDeFrontend | ForEach-Object { Write-Host "  $_" }
  throw "DEPLOY BLOQUEADO: solo cambios de frontend pueden ir a Vercel."
}

Write-Host "`nCommits que se subirian:" -ForegroundColor Cyan
git log --oneline origin/main..HEAD

Set-Location "$root\frontend"
npm run lint;  if ($LASTEXITCODE -ne 0) { throw "LINT FALLO" }
npm run build; if ($LASTEXITCODE -ne 0) { throw "BUILD FALLO" }

Write-Host "`nTODO OK. Para desplegar:" -ForegroundColor Green
Write-Host "  git push origin ${branch}:main"
Write-Host "Despues: confirma 'Listo' en Vercel y haz una venta de prueba con Imprimir."
