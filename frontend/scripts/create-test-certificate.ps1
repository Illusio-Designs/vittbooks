# PowerShell script to create a self-signed certificate for code signing
# This is for TESTING purposes only - users will still see security warnings

Write-Host "Creating self-signed certificate for Fintranzact Client..." -ForegroundColor Green

# Certificate details
$certName = "Fintranzact Solutions Test Certificate"
$certSubject = "CN=Fintranzact Solutions, O=Fintranzact Solutions, C=US"
$certStore = "Cert:\CurrentUser\My"
$exportPath = ".\electron\assets\finvera-test-cert.pfx"
$password = "finvera123"

try {
    # Create self-signed certificate
    Write-Host "Creating certificate..." -ForegroundColor Yellow
    $cert = New-SelfSignedCertificate -Subject $certSubject -Type CodeSigning -KeyUsage DigitalSignature -FriendlyName $certName -CertStoreLocation $certStore -KeyExportPolicy Exportable -KeyLength 2048 -KeyAlgorithm RSA -HashAlgorithm SHA256 -NotAfter (Get-Date).AddYears(1)
    
    Write-Host "Certificate created with thumbprint: $($cert.Thumbprint)" -ForegroundColor Green
    
    # Export certificate to PFX file
    Write-Host "Exporting certificate to PFX file..." -ForegroundColor Yellow
    $securePassword = ConvertTo-SecureString -String $password -Force -AsPlainText
    Export-PfxCertificate -Cert $cert -FilePath $exportPath -Password $securePassword -Force
    
    Write-Host "Certificate exported to: $exportPath" -ForegroundColor Green
    
    # Add certificate to Trusted Root (optional - reduces some warnings)
    Write-Host "Adding certificate to Trusted Root store..." -ForegroundColor Yellow
    $rootStore = Get-Item "Cert:\CurrentUser\Root"
    $rootStore.Open("ReadWrite")
    $rootStore.Add($cert)
    $rootStore.Close()
    
    Write-Host "Certificate setup complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Certificate Details:" -ForegroundColor Cyan
    Write-Host "  Subject: $($cert.Subject)"
    Write-Host "  Thumbprint: $($cert.Thumbprint)"
    Write-Host "  Valid Until: $($cert.NotAfter)"
    Write-Host "  PFX File: $exportPath"
    Write-Host "  Password: $password"
    Write-Host ""
    Write-Host "IMPORTANT NOTES:" -ForegroundColor Red
    Write-Host "- This is a TEST certificate only"
    Write-Host "- Users will still see security warnings"
    Write-Host "- Do NOT use for production distribution"
    Write-Host "- For production, purchase a certificate from a trusted CA"
    
} catch {
    Write-Host "Error creating certificate: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "You may need to run PowerShell as Administrator" -ForegroundColor Yellow
}