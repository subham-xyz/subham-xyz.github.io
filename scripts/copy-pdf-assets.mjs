import {cp,mkdir} from 'node:fs/promises';
for(const directory of ['cmaps','standard_fonts','wasm']){await mkdir('public/pdf-assets',{recursive:true});await cp(`node_modules/pdfjs-dist/${directory}`,`public/pdf-assets/${directory}`,{recursive:true});}
