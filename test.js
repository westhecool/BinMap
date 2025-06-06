import BinMap from './index.js';
const map = new BinMap();
const obj = {
    a: 1,
    b: 'Hello World',
    c: true,
    d: null,
    e: undefined, // undefined values will be omited
    f: Buffer.from('Hello World'),
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
const deserialized = map.deserialize(buffer);
console.log('deserialized object:', deserialized);