export const fonts = [
  ['Manrope', 'manrope', 'woff2'], ['Lato', 'lato', 'ttf'], ['Oswald', 'oswald', 'ttf'],
  ['Libre Baskerville', 'librebaskerville', 'ttf'], ['Inconsolata', 'inconsolata', 'ttf'], ['Dancing Script', 'dancingscript', 'ttf'],
].map(([name, id, extension]) => ({ name, id, weightRange: ({lato:'400', manrope:'200 800', oswald:'200 700', librebaskerville:'400 700', inconsolata:'200 900', dancingscript:'400 700'})[id], url: `/fonts/${id}.${extension}`, license: `/fonts/${id}-OFL.txt`, source: `https://fonts.google.com/specimen/${name.replaceAll(' ', '+')}` }));
