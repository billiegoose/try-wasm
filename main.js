'use strict'
Binaryen = Binaryen()
const { saveAs } = require('save-as')
const inspecter = require('object-inspect')
const hex = require('browser-hex')
require('console-log-div')
window.tape = require('tape') // Note: use of 'let' here is intentional
window.hex = hex
window.appMembuf = null
window.m = null

// Feature detect
if (window.WebAssembly) {
  document.getElementById('feature-detect-msg').innerHTML = 'Great! Your browser supports WebAssembly natively.'
} else {
  document.getElementById('feature-detect-msg').innerHTML = 'Notice: Could not find window.WebAssembly. Your mileage may vary.'
}

// Abstract DOM interaction
function sourceWAST () {
  return document.getElementById('wast-textarea').value
}

function displayWASM (buf) {
  document.getElementById('wasm-output').value = hex(new Buffer(buf))
}

function outputLog (text) {
  document.getElementById('wasm-output').innerHTML = text
}

function runJS () {
  let text = document.getElementById('js-textarea').value
  let tape = require('tape')
  eval(`(function (test, m) {
    ${text}
  })(tape, m)`)
}
window.runJS = runJS

// * Actual functions * //

// compiles the input.
function compile (input) {
  return Binaryen.compileWast(input)
  // All this shit isn't really needed.
  console.log('input =', input)

  const module = new Binaryen.Module()
  module.print = alert
  const parser = new Binaryen.SExpressionParser(input)

  console.log('s-expr dump:')
  parser.get_root().dump()
  const s_module = parser.get_root().getChild(0)
  console.log('================')

  const builder = new Binaryen.SExpressionWasmBuilder(module, s_module)

  console.log('module:')
  Binaryen.WasmPrinter.prototype.printModule(module)
  console.log('================')

  // Create a new memory buffer
  let mem = new Binaryen.BufferWithRandomAccess(false)
  // Dump the contents of the module into the buffer
  let wbw = new Binaryen.WasmBinaryWriter(module, mem, false)
  wbw.write()
  // Convert it to something we can (sort of) use
  appMembuf = mem.toArrayBuffer()
  console.log('Uint8Array.from(mem) =', Uint8Array.from(mem))
  return appMembuf
}

window.saveWAST = function saveWAST () {
  saveAs(new Blob([sourceWAST()], {type: 'text/plain'}), 'application.wast')
}

window.compileWAST = function compileWAST () {
  appMembuf = Binaryen.compileWast(sourceWAST())
  displayWASM(appMembuf)
}

window.saveWASM = function saveWASM () {
  // Convert ArrayBuffer into a Blob
  console.log('Uint8Array(mem) =', new Uint8Array(mem))
  let memblob = new Blob([appMembuf], {type: 'application/octet-stream'})
  saveAs(memblob, 'application.wasm')
}

// Execute the module binary (requires bleeding edge browser)
window.runModuleNative = function runModuleNative () {
  let imports = {}
  WebAssembly.compile(appMembuf)
  .then(module => {
    console.log('module =', module)
    return new WebAssembly.Instance(module, imports)
  })
  .then(instance => {
    m = instance.exports
    console.log('m =', m)
    outputLog(inspecter(m, {depth: 5}))
  })
}

// Execute the module interpreter
function runModuleShim () {
    const interface_ = new Binaryen.ShellExternalInterface()
    const instance = new Binaryen.ModuleInstance(module, interface_)

    const name = new Binaryen.Name('add')
    console.log('name: ' + name.c_str())

    const args = new Binaryen.LiteralList()
    args.push_back(new Binaryen.Literal(40))
    args.push_back(new Binaryen.Literal(2))

    let answer = instance.callExport(name, args).getf64()
    console.log('answer is ' + answer + '.')
    document.getElementById('wasm-output').innerHTML = answer
}
