$ErrorActionPreference = 'Stop'
$hostName = 'com.jaystarbliss.hubmind'
$extensionId = 'baifedjcpcnkjjoikbafnkiombiaooai'
$extensionOrigin = "chrome-extension://$extensionId/"
$resourceRoot = $PSScriptRoot
$extensionSource = Join-Path $resourceRoot 'jess-chrome-extension'
$nativeHostExe = Join-Path $resourceRoot 'JessChromeNativeHost.exe'
$targetRoot = Join-Path $env:LOCALAPPDATA 'Jaystarbliss\Hub-Mind\JessChromeBridge'
$extensionTarget = Join-Path $targetRoot 'chrome-extension'
$manifestPath = Join-Path $targetRoot "$hostName.json"
$tokenPath = Join-Path $targetRoot 'bridge-token'

if (-not (Test-Path -LiteralPath $nativeHostExe -PathType Leaf)) { throw "Native host executable not found: $nativeHostExe. Reinstall Hub-Mind with the Windows native host package." }
if (-not (Test-Path -LiteralPath (Join-Path $extensionSource 'manifest.json') -PathType Leaf)) { throw "Chrome extension files not found: $extensionSource." }
New-Item -ItemType Directory -Path $targetRoot -Force | Out-Null
if (Test-Path -LiteralPath $extensionTarget) { Remove-Item -LiteralPath $extensionTarget -Recurse -Force }
Copy-Item -LiteralPath $extensionSource -Destination $extensionTarget -Recurse -Force

$nativeManifest = @{
  name = $hostName
  description = 'Hub-Mind Jess Chrome bridge'
  path = $nativeHostExe
  type = 'stdio'
  allowed_origins = @($extensionOrigin)
}
$manifestJson = $nativeManifest | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText($manifestPath, $manifestJson, [System.Text.UTF8Encoding]::new($false))

$random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try {
  $tokenBytes = New-Object byte[] 32
  $random.GetBytes($tokenBytes)
  $bridgeToken = [Convert]::ToBase64String($tokenBytes)
} finally { $random.Dispose() }
[System.IO.File]::WriteAllText($tokenPath, $bridgeToken, [System.Text.UTF8Encoding]::new($false))
$tokenAcl = New-Object System.Security.AccessControl.FileSecurity
$currentSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
$tokenAcl.SetOwner($currentSid)
$tokenAcl.SetAccessRuleProtection($true, $false)
$tokenRule = New-Object System.Security.AccessControl.FileSystemAccessRule -ArgumentList @($currentSid, 'FullControl', 'Allow')
$tokenAcl.AddAccessRule($tokenRule)
Set-Acl -LiteralPath $tokenPath -AclObject $tokenAcl

$registryPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$hostName"
New-Item -Path $registryPath -Force | Out-Null
Set-Item -Path $registryPath -Value $manifestPath
Write-Output 'Jess Chrome native host registered for the current Windows user with a per-user authenticated local bridge.'
Write-Output "1. Open chrome://extensions in Chrome."
Write-Output '2. Enable Developer mode.'
Write-Output "3. Select Load unpacked and choose: $extensionTarget"
Write-Output '4. Keep Hub-Mind running, then start a Full Control Session before asking Jess to control Chrome.'
Write-Output 'Chrome tab/page access is active only while the installed desktop app and extension are connected.'
