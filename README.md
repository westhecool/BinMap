# BinMap (BinaryMap)

Binary format for storing JavaScript Objects and Arrays.

## Supported types

- Number
- BigInt*
- String
- NULL
- Boolean
- Binary** (nodejs Buffer, ArrayBuffer, ArrayBufferView)

\* If the BigInt can be safely stored within a Number it will be converted.

\*\* All types will get converted to Buffer (if in nodejs) and UInt8Array (if in a browser)

## Usage

Installing:
```sh
npm i binmapjs
```

Example:
```js
import BinMap from 'binmapjs';

const map = new BinMap();

const obj = {
    a: 1,
    b: 'Hello World',
    c: true,
    d: null,
    e: undefined, // undefined values will be omited
    f: new Uint8Array([72, 101, 108, 108, 111]), // "hello"
    g: (new TextEncoder('utf-8')).encode('Hello World'),
    h: [1, 2, 3, 4, 5],
    i: {
        a: 1,
        b: 'Hello World',
        c: true
    }
};

console.log('original object:', obj);

const buffer = map.serialize(obj);
console.log('serialized buffer:', buffer);
// you can save the buffer to a file if you want
// fs.writeFileSync('test.bin', buffer);

// const buffer = fs.readFileSync('test.bin');
const deserialized = map.deserialize(buffer);
console.log('deserialized object:', deserialized);
```