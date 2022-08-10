import esMain from 'es-main';

const banner = [
  '\x1b[38;5;63m \x1b[39m\x1b[38;5;63m \x1b[39m\x1b[38;5;33m \x1b[39m\x1b[38;5;39m \x1b[39m\x1b[38;5;39m_\x1b[39m\x1b[38;5;44m_\x1b[39m\x1b[38;5;44m_\x1b[39m\x1b[38;5;49m_\x1b[39m\x1b[38;5;49m \x1b[39m\x1b[38;5;48m \x1b[39m\x1b[38;5;83m \x1b[39m\x1b[38;5;83m \x1b[39m\x1b[38;5;118m \x1b[39m\x1b[38;5;118m \x1b[39m\x1b[38;5;154m \x1b[39m\x1b[38;5;148m \x1b[39m\x1b[38;5;184m \x1b[39m\x1b[38;5;178m \x1b[39m\x1b[38;5;214m \x1b[39m\x1b[38;5;208m \x1b[39m\x1b[38;5;208m \x1b[39m\x1b[38;5;203m \x1b[39m\x1b[38;5;203m \x1b[39m\x1b[38;5;198m \x1b[39m\x1b[38;5;199m \x1b[39m\x1b[38;5;199m \x1b[39m\x1b[38;5;164m \x1b[39m\x1b[38;5;164m \x1b[39m\x1b[38;5;129m\x1b[39m',
  '\x1b[38;5;63m \x1b[39m\x1b[38;5;33m \x1b[39m\x1b[38;5;33m \x1b[39m\x1b[38;5;39m/\x1b[39m\x1b[38;5;38m \x1b[39m\x1b[38;5;44m_\x1b[39m\x1b[38;5;43m_\x1b[39m\x1b[38;5;49m/\x1b[39m\x1b[38;5;48m_\x1b[39m\x1b[38;5;48m_\x1b[39m\x1b[38;5;83m_\x1b[39m\x1b[38;5;83m_\x1b[39m\x1b[38;5;118m_\x1b[39m\x1b[38;5;154m_\x1b[39m\x1b[38;5;154m_\x1b[39m\x1b[38;5;184m \x1b[39m\x1b[38;5;184m \x1b[39m\x1b[38;5;214m_\x1b[39m\x1b[38;5;214m_\x1b[39m\x1b[38;5;208m \x1b[39m\x1b[38;5;203m \x1b[39m\x1b[38;5;203m_\x1b[39m\x1b[38;5;198m_\x1b[39m\x1b[38;5;198m_\x1b[39m\x1b[38;5;199m_\x1b[39m\x1b[38;5;163m_\x1b[39m\x1b[38;5;164m_\x1b[39m\x1b[38;5;128m_\x1b[39m\x1b[38;5;129m\x1b[39m',
  '\x1b[38;5;63m \x1b[39m\x1b[38;5;33m \x1b[39m\x1b[38;5;39m/\x1b[39m\x1b[38;5;39m \x1b[39m\x1b[38;5;44m/\x1b[39m\x1b[38;5;44m_\x1b[39m\x1b[38;5;49m/\x1b[39m\x1b[38;5;49m \x1b[39m\x1b[38;5;48m_\x1b[39m\x1b[38;5;83m_\x1b[39m\x1b[38;5;83m_\x1b[39m\x1b[38;5;118m/\x1b[39m\x1b[38;5;118m \x1b[39m\x1b[38;5;154m_\x1b[39m\x1b[38;5;148m \x1b[39m\x1b[38;5;184m\\\x1b[39m\x1b[38;5;178m/\x1b[39m\x1b[38;5;214m \x1b[39m\x1b[38;5;208m/\x1b[39m\x1b[38;5;208m \x1b[39m\x1b[38;5;203m/\x1b[39m\x1b[38;5;203m \x1b[39m\x1b[38;5;198m/\x1b[39m\x1b[38;5;199m \x1b[39m\x1b[38;5;199m_\x1b[39m\x1b[38;5;164m_\x1b[39m\x1b[38;5;164m_\x1b[39m\x1b[38;5;129m/\x1b[39m\x1b[38;5;129m\x1b[39m',
  '\x1b[38;5;33m \x1b[39m\x1b[38;5;33m/\x1b[39m\x1b[38;5;39m \x1b[39m\x1b[38;5;38m_\x1b[39m\x1b[38;5;44m_\x1b[39m\x1b[38;5;43m/\x1b[39m\x1b[38;5;49m \x1b[39m\x1b[38;5;48m/\x1b[39m\x1b[38;5;48m \x1b[39m\x1b[38;5;83m \x1b[39m\x1b[38;5;83m/\x1b[39m\x1b[38;5;118m \x1b[39m\x1b[38;5;154m \x1b[39m\x1b[38;5;154m_\x1b[39m\x1b[38;5;184m_\x1b[39m\x1b[38;5;184m/\x1b[39m\x1b[38;5;214m \x1b[39m\x1b[38;5;214m/\x1b[39m\x1b[38;5;208m_\x1b[39m\x1b[38;5;203m/\x1b[39m\x1b[38;5;203m \x1b[39m\x1b[38;5;198m/\x1b[39m\x1b[38;5;198m \x1b[39m\x1b[38;5;199m/\x1b[39m\x1b[38;5;163m \x1b[39m\x1b[38;5;164m \x1b[39m\x1b[38;5;128m \x1b[39m\x1b[38;5;129m \x1b[39m\x1b[38;5;93m\x1b[39m',
  '\x1b[38;5;33m/\x1b[39m\x1b[38;5;39m_\x1b[39m\x1b[38;5;39m/\x1b[39m\x1b[38;5;44m \x1b[39m\x1b[38;5;44m/\x1b[39m\x1b[38;5;49m_\x1b[39m\x1b[38;5;49m/\x1b[39m\x1b[38;5;48m \x1b[39m\x1b[38;5;83m \x1b[39m\x1b[38;5;83m \x1b[39m\x1b[38;5;118m\\\x1b[39m\x1b[38;5;118m_\x1b[39m\x1b[38;5;154m_\x1b[39m\x1b[38;5;148m_\x1b[39m\x1b[38;5;184m/\x1b[39m\x1b[38;5;178m\\\x1b[39m\x1b[38;5;214m_\x1b[39m\x1b[38;5;208m_\x1b[39m\x1b[38;5;208m,\x1b[39m\x1b[38;5;203m \x1b[39m\x1b[38;5;203m/\x1b[39m\x1b[38;5;198m_\x1b[39m\x1b[38;5;199m/\x1b[39m\x1b[38;5;199m \x1b[39m\x1b[38;5;164m \x1b[39m\x1b[38;5;164m \x1b[39m\x1b[38;5;129m \x1b[39m\x1b[38;5;129m \x1b[39m\x1b[38;5;93m\x1b[39m',
  '\x1b[38;5;33m \x1b[39m\x1b[38;5;39m \x1b[39m\x1b[38;5;38m \x1b[39m\x1b[38;5;44m \x1b[39m\x1b[38;5;43m \x1b[39m\x1b[38;5;49m \x1b[39m\x1b[38;5;48m \x1b[39m\x1b[38;5;48m \x1b[39m\x1b[38;5;83m \x1b[39m\x1b[38;5;83m \x1b[39m\x1b[38;5;118m \x1b[39m\x1b[38;5;154m \x1b[39m\x1b[38;5;154m \x1b[39m\x1b[38;5;184m \x1b[39m\x1b[38;5;184m/\x1b[39m\x1b[38;5;214m_\x1b[39m\x1b[38;5;214m_\x1b[39m\x1b[38;5;208m_\x1b[39m\x1b[38;5;203m_\x1b[39m\x1b[38;5;203m/\x1b[39m\x1b[38;5;198m\x1b[39m',
];

export default banner;

if (esMain(import.meta)) console.log(banner.join('\n'));

/*
To generate the banner:
  $ unset COLORTERM
  $ figlet -fslant freyr \
     | lolcat -p 0.5 -S 35 -f \
     | sed 's/\\/\\\\/g;s/\x1b/\\x1b/g'

To record logo:
  $ GIFSICLE_OPTS=--lossy=80 asciicast2gif \
    -t tango -s 2 -w 28 -h 6 logo.cast logo.gif
*/
