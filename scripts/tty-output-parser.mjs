export const createTtyOutputParser = () => {
  let pendingOsc = null;

  const flushOsc = (titles, buffer) => {
    const match = buffer.match(/^(?:0|2);([\s\S]*)$/u);
    if (match) {
      titles.push(match[1] ?? "");
    }
  };

  return (chunk) => {
    let visibleData = "";
    const titles = [];
    let bellCount = 0;

    for (let index = 0; index < chunk.length; index += 1) {
      const char = chunk[index];
      const next = chunk[index + 1];

      if (pendingOsc !== null) {
        if (char === "\u0007") {
          flushOsc(titles, pendingOsc);
          pendingOsc = null;
          continue;
        }

        if (char === "\u001b" && next === "\\") {
          flushOsc(titles, pendingOsc);
          pendingOsc = null;
          index += 1;
          continue;
        }

        pendingOsc += char;
        continue;
      }

      if (char === "\u001b" && next === "]") {
        pendingOsc = "";
        index += 1;
        continue;
      }

      if (char === "\u0007") {
        bellCount += 1;
        continue;
      }

      visibleData += char;
    }

    return {
      data: visibleData,
      titles,
      bellCount
    };
  };
};
