import fs from 'node:fs'
const src = fs.readFileSync('material.inc.php', 'utf8')
const consts = fs.readFileSync('modules/php/Constants.inc.php', 'utf8')
const cmap = {}
for (const m of consts.matchAll(/const (\w+) = (?:'([^']*)'|(\d+));/g)) cmap[m[1]] = m[2] ?? m[3]
function block(name) {
  const i = src.indexOf(`$this->${name} = [`)
  let depth = 0, j = i + `$this->${name} = `.length
  for (; j < src.length; j++) { if (src[j] === '[') depth++; else if (src[j] === ']') { depth--; if (depth === 0) break } }
  return src.slice(i + `$this->${name} = `.length, j + 1)
}
function toJson(php) {
  let s = php.replace(/\/\/.*$/gm, '')
  s = s.replace(/clienttranslate\(('(?:[^'\\]|\\.)*')\)/g, '$1')
  s = s.replace(/\b([A-Z][A-Z0-9_]+)\b/g, (m) => JSON.stringify(m in cmap ? cmap[m] : m))
  s = s.replace(/'((?:[^'\\]|\\.)*)'/g, (_, a) => JSON.stringify(a.replace(/\\'/g, "'")))
  s = s.replace(/=>/g, ':')
  // arrays with keys -> objects; arrays without -> lists. Detect by presence of ':' at top level of each [...]
  let out = '', stack = []
  for (let k = 0; k < s.length; k++) {
    const c = s[k]
    if (c === '[') {
      // lookahead to see if this bracket contains a ':' before its matching close at depth 0
      let d = 0, obj = false
      for (let q = k + 1; q < s.length; q++) { if (s[q] === '[') d++; else if (s[q] === ']') { if (d === 0) break; d-- } else if (s[q] === ':' && d === 0) { obj = true; break } }
      stack.push(obj); out += obj ? '{' : '['
    } else if (c === ']') { out += stack.pop() ? '}' : ']' } else out += c
  }
  out = out.replace(/,(\s*[}\]])/g, '$1').replace(/(\d+)\s*:/g, '"$1":')
  return JSON.parse(out)
}
const tracks = toJson(block('APPROACH_TRACKS'))
const scenarios = toJson(block('SCENARIOS'))
const altitude = toJson(block('ALTITUDE_TRACKS'))
const abilities = toJson(block('SPECIAL_ABILITIES'))
fs.writeFileSync('../bga-data.json', JSON.stringify({ tracks, scenarios, altitude, abilities }, null, 1))
console.log(Object.keys(tracks).length, 'tracks', Object.keys(scenarios).length, 'scenarios')
const base = Object.entries(scenarios).filter(([k, v]) => v.tags.includes('base'))
console.log(base.length, 'base scenarios:'); for (const [k, v] of base) console.log(k, tracks[k].name, tracks[k].size, JSON.stringify(v.modules), v.nrOfSpecialAbilities ?? 0, v.modifiedAltitude ?? '')
