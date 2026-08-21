' ============================================================
'  Daily Quest launcher   (ASCII only - do not add Chinese here,
'  cscript reads this file with the system ANSI codepage)
'
'  If site-url.txt contains a real https:// address, open that
'  address in Chrome/Edge app-mode, so the desktop shares the
'  same cloud-synced data as the phone.
'  Otherwise fall back to the local index.html file.
' ============================================================

Option Explicit

Dim fso, ws, baseDir, htmlPath, target, isRemote
Dim candidates, i, exePath, chosen

Set fso = CreateObject("Scripting.FileSystemObject")
Set ws  = CreateObject("WScript.Shell")

baseDir  = fso.GetParentFolderName(WScript.ScriptFullName)
htmlPath = fso.BuildPath(baseDir, "index.html")

isRemote = False
target   = ""

' --- try site-url.txt, then the older Chinese-named file ---
target = ReadUrl(fso.BuildPath(baseDir, "site-url.txt"))
If target = "" Then
    ' ChrW(&H7DB2) & ChrW(&H5740) = the two Chinese characters for "URL"
    target = ReadUrl(fso.BuildPath(baseDir, ChrW(&H7DB2) & ChrW(&H5740) & ".txt"))
End If
If target <> "" Then isRemote = True

If Not isRemote Then
    If Not fso.FileExists(htmlPath) Then
        MsgBox "index.html not found in:" & vbCrLf & baseDir, 16, "Daily Quest"
        WScript.Quit
    End If
    target = "file:///" & Replace(htmlPath, "\", "/")
    target = Replace(target, " ", "%20")
    target = Replace(target, "#", "%23")
End If

candidates = Array( _
    ws.ExpandEnvironmentStrings("%ProgramFiles%")      & "\Google\Chrome\Application\chrome.exe", _
    ws.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Google\Chrome\Application\chrome.exe", _
    ws.ExpandEnvironmentStrings("%LocalAppData%")      & "\Google\Chrome\Application\chrome.exe", _
    ws.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Microsoft\Edge\Application\msedge.exe", _
    ws.ExpandEnvironmentStrings("%ProgramFiles%")      & "\Microsoft\Edge\Application\msedge.exe", _
    ws.ExpandEnvironmentStrings("%LocalAppData%")      & "\Microsoft\Edge\Application\msedge.exe" )

chosen = ""
For i = 0 To UBound(candidates)
    exePath = candidates(i)
    If chosen = "" Then
        If fso.FileExists(exePath) Then chosen = exePath
    End If
Next

On Error Resume Next

If chosen <> "" Then
    ws.Run """" & chosen & """ --app=""" & target & """ --window-size=1120,900", 1, False
End If

If chosen = "" Or Err.Number <> 0 Then
    Err.Clear
    If isRemote Then
        ws.Run target, 1, False
    Else
        ws.Run """" & htmlPath & """", 1, False
    End If
End If

On Error GoTo 0


Function ReadUrl(path)
    Dim f, line, out
    out = ""
    If Not fso.FileExists(path) Then
        ReadUrl = ""
        Exit Function
    End If
    On Error Resume Next
    Set f = fso.OpenTextFile(path, 1)
    If Err.Number <> 0 Then
        Err.Clear
        ReadUrl = ""
        Exit Function
    End If
    Do While Not f.AtEndOfStream
        line = Trim(f.ReadLine)
        If Left(LCase(line), 8) = "https://" And Len(line) > 12 Then
            out = line
            Exit Do
        End If
    Loop
    f.Close
    On Error GoTo 0
    ReadUrl = out
End Function
