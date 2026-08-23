Set oWS = WScript.CreateObject("WScript.Shell")
Set oLink = oWS.CreateShortcut(oWS.SpecialFolders("Desktop") & "\Daily Quest.lnk")
oLink.TargetPath = "https://xindong-13.github.io/daily-quest/"
oLink.IconLocation = "shell32.dll,14"
oLink.Description = "Daily Quest"
oLink.Save
WScript.Echo "Shortcut created on Desktop!"
