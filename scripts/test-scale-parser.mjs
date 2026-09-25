// Tests del parser de báscula como función pura, sin hardware ni framework.
// Uso: node scripts/test-scale-parser.mjs

import { parseScaleLine, validateWeightKg } from '../frontend/src/utils/scaleReader.js'

let pass = 0
let fail = 0

function approx(a, b, eps = 1e-6) {
  return typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= eps
}

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
    || (expected && actual && approx(actual.kg, expected.kg) && actual.unit === expected.unit
        && actual.stable === expected.stable && approx(actual.value, expected.value))
  if (ok) { pass++; console.log(`  ok  ${name}`) }
  else {
    fail++
    console.log(`FAIL  ${name}`)
    console.log('      esperado:', JSON.stringify(expected))
    console.log('      obtenido:', JSON.stringify(actual))
  }
}

console.log('parseScaleLine —')

check('kg con espacio', parseScaleLine('1.500 kg'), { raw: '1.500 kg', value: 1.5, unit: 'kg', kg: 1.5, stable: null })

check('gramos → kg (no debe cobrar 1500kg)', parseScaleLine('1500 g'), { raw: '1500 g', value: 1500, unit: 'g', kg: 1.5, stable: null })

check('trama NCI estable', parseScaleLine('ST,GS,+001.500kg'), { raw: 'ST,GS,+001.500kg', value: 1.5, unit: 'kg', kg: 1.5, stable: true })

check('trama NCI inestable', parseScaleLine('US,GS,+001.498kg'), { raw: 'US,GS,+001.498kg', value: 1.498, unit: 'kg', kg: 1.498, stable: false })

check('negativo (tara descalibrada)', parseScaleLine('-0.020 kg'), { raw: '-0.020 kg', value: -0.02, unit: 'kg', kg: -0.02, stable: null })

check('libras → kg', parseScaleLine('3.31 lb'), { raw: '3.31 lb', value: 3.31, unit: 'lb', kg: 3.31 * 0.45359237, stable: null })

check('sin unidad → no asume kg', parseScaleLine('1.500'), { raw: '1.500', value: 1.5, unit: null, kg: null, stable: null })

check('basura sin numero', parseScaleLine('ABC'), null)

check('linea vacia', parseScaleLine(''), null)

check('linea solo espacios', parseScaleLine('   '), null)

console.log('\nvalidateWeightKg —')

check('cero rechazado', validateWeightKg(0), 'El peso debe ser mayor a cero')
check('negativo rechazado', validateWeightKg(-1), 'El peso debe ser mayor a cero')
check('excede capacidad', validateWeightKg(45, 40), 'El peso excede la capacidad máxima configurada (40 kg)')
check('null rechazado', validateWeightKg(null), 'Lectura inválida')
check('peso valido', validateWeightKg(2.35), null)

console.log(`\n${pass} pasaron, ${fail} fallaron`)
process.exit(fail > 0 ? 1 : 0)
