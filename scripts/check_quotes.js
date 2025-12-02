const fs = require('fs');
const path = 'app/dashboard/reservation/reservation-approval/page.js';
const s = fs.readFileSync(path, 'utf8');
function count(ch){return s.split(ch).length-1}
console.log('backticks', count('`'));
console.log('singleQuotes', count("'"));
console.log('doubleQuotes', count('"'));
