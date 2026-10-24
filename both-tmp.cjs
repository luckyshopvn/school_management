const fs=require('fs');
for (const f of process.argv.slice(2)) {
  const out=[];let st=0;
  for (const l of fs.readFileSync(f,'utf8').split('\n')) {
    if (l.startsWith('<<<<<<< ')) {st=1;continue;}
    if (st===1 && l==='=======') {st=2;continue;}
    if (st===2 && l.startsWith('>>>>>>> ')) {st=0;continue;}
    out.push(l);
  }
  fs.writeFileSync(f,out.join('\n'));
}
