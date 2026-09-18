import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
const printer=ts.createPrinter({newLine:ts.NewLineKind.LineFeed});
function walk(dir){for(const name of fs.readdirSync(dir)){const file=path.join(dir,name);if(fs.statSync(file).isDirectory())walk(file);else if(/\.tsx?$/.test(name)&&!name.endsWith('.d.ts')){const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,name.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);fs.writeFileSync(file,printer.printFile(source))}}}
for(const dir of ['app','lib','db'])walk(dir);
