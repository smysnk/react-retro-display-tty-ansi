const stringToBytes = (value) =>
  new Uint8Array(Array.from(value, (char) => char.charCodeAt(0) & 0xff));

const chunksToBytes = (chunks) => stringToBytes(chunks.join(""));

export const shellSessionTraceByteFixture = {
  name: "shell-session-trace",
  rows: 6,
  cols: 32,
  bytes: chunksToBytes([
    "\u001b[1;32moperator@retro\u001b[0m \u001b[34m~/play/react-retro-display\u001b[0m\r\n",
    "$ yarn test:conformance\r\n",
    "\u001b[2mcollecting oracle fixtures...\u001b[0m\r\n",
    "\u001b[38;5;45mPASS\u001b[0m random chunk parity\r\n"
  ])
};

export const statusPaneTraceByteFixture = {
  name: "status-pane-trace",
  rows: 6,
  cols: 28,
  bytes: chunksToBytes([
    "\u001b[2;6r",
    "\u001b[1;1H\u001b[44;37m SESSION conformance        \u001b[0m",
    "\u001b[2;1Horacle ready\r\nchunk fuzzer ready\r\npalette mapper ready",
    "\u001b[6;1H\u001b[L\u001b[38;2;255;180;120mrecorded regression fixture\u001b[0m"
  ])
};
