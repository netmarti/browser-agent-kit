# VHS tape for the browser-agent-kit showcase.
# Renders the terminal demo to a GIF + MP4.
#
#   brew install vhs        # one-time (pulls ttyd + ffmpeg)
#   npm install
#   vhs examples/demo.tape   # run from the repo root -> examples/demo.gif, examples/demo.mp4

Output examples/demo.gif
Output examples/demo.mp4

Set Shell "zsh"
Set FontSize 15
Set Width 1280
Set Height 820
Set Padding 20
Set Theme "Catppuccin Mocha"
Set TypingSpeed 55ms

Hide
Type "clear"
Enter
Show

Type "npm run demo"
Sleep 700ms
Enter
Sleep 22s
