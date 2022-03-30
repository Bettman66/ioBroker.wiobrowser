![Logo](../admin/wiobrowser.png)
# ioBroker.wiobrowser

Dieser Adapter verbindet sich über tcp.socket mit dem wioBrowser, um ihn zu steuern. Es gibt 3 unterschiedliche wioBrowser Apps:

+ wioBrowser WebView2 Framework
+ wioBrowser Chromium Framework
+ wioNoweb (Gleiche Funktionen ohne Web)

wioBrowser ist ein Windows Fullscreen Browser der sich über ioBroker steuern lässt, er zeigt einzelne Webseiten an oder eine Webseiten Slideshow die man im Adapter einstellen kann. Es werden auch Infos an den Adapter übertragen:

+ CPU Last
+ freier Speicher
+ aktuelle Batterieentladung bei Tablet oder Notebook
+ Hostname
+ IP

Er kann auch steuern:

+ Bildschirm an/aus
+ App beenden
+ Lautstärke +/-
+ Stumm an/aus
+ Helligkeit +/-
+ Programme mit Schaltern ausführen z.B C:\ClickMonitorDDC\ClickMonitorDDC_7_2.exe b 100
+ Text Nachrichten
+ Sprach Nachrichten

## Links
