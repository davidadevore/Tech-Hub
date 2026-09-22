#ifndef AppVersion
  #define AppVersion "0.2.0"
#endif
[Setup]
AppId={{A184D150-AB12-45D2-8C91-E6B77CE40510}
AppName=Tech Hub
AppVersion={#AppVersion}
AppPublisher=Streamline
AppPublisherURL=https://github.com/horner516/Tech-Hub
DefaultDirName={localappdata}\Programs\Tech Hub
DefaultGroupName=Tech Hub
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0.17763
AppMutex=Local\StreamlineTechHub
UninstallDisplayIcon={app}\Tech Hub.exe
OutputDir=..\dist
OutputBaseFilename=Tech-Hub-Windows-x64-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
SetupIconFile=..\assets\TechHub.ico
CloseApplications=no
[Files]
Source: "..\dist\windows\Tech Hub\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
[Icons]
Name: "{group}\Tech Hub"; Filename: "{app}\Tech Hub.exe"
[Run]
Filename: "{app}\Tech Hub.exe"; Description: "Start Tech Hub in the system tray"; Flags: nowait postinstall skipifsilent
