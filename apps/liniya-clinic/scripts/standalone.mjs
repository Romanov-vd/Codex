import{readFile,writeFile,readdir,mkdir}from'node:fs/promises';
import{resolve}from'node:path';
import{services,doctors}from'../server/catalog.mjs';
const dist=resolve('dist');let html=await readFile(resolve(dist,'index.html'),'utf8');
const assets=await readdir(resolve(dist,'assets'));const js=await readFile(resolve(dist,'assets',assets.find(f=>f.endsWith('.js'))),'utf8');const css=await readFile(resolve(dist,'assets',assets.find(f=>f.endsWith('.css'))),'utf8');
const images={};for(const file of await readdir('public/images'))images[file]='data:image/svg+xml;base64,'+(await readFile('public/images/'+file)).toString('base64');
const adapter=await readFile('standalone/local-api.js','utf8');
const setup='window.CLINIC_LOCAL_DEMO=true;window.CLINIC_LOCAL_CATALOG='+JSON.stringify({services,doctors})+';window.CLINIC_LOCAL_IMAGES='+JSON.stringify(images)+';\n'+adapter;
html=html.replace(/<script[^>]*src="[^\"]+"[^>]*><\/script>/,'').replace(/<link[^>]*rel="stylesheet"[^>]*>/,'');
html=html.replace(/<link[^>]*rel="icon"[^>]*>/,'<link rel="icon" type="image/svg+xml" href="'+ 'data:image/svg+xml;base64,'+(await readFile('public/favicon.svg')).toString('base64')+'">');
html=html.replace('</head>','<style>'+css+'</style></head>');
// HTML Preview rewrites every literal <script token, even inside JS strings.
// Encode tag openings in the payload without changing their runtime value.
const script=value=>'<script>'+value.replace(/<\/?script\b/gi,tag=>'\\x3c'+tag.slice(1))+'</script>';
html=html.replace('</body>',script(setup)+script(js)+'</body>');
html=html.replace('<title>Линия — забота, которая рядом</title>','<title>Линия — локальная демонстрация</title>');
await mkdir('standalone',{recursive:true});await writeFile('standalone/liniya-clinic.html',html.replace(/[ \t]+$/gm,''));console.log('Created standalone/liniya-clinic.html ('+Buffer.byteLength(html)+' bytes): scripts, styles, illustrations and local database adapter embedded.');
