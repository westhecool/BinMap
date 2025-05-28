export default class BinMap {
    constructor({ stringEncoding } = {}) {
        this.stringEncoding = stringEncoding || 'utf-8';
        this.textEncoder = new TextEncoder(this.stringEncoding);
        this.textDecoder = new TextDecoder(this.stringEncoding);
    }
    TYPES = {
        NULL: 0,
        STRING: 1,
        NUMBER: 2,
        BOOLEAN: 3,
        BINARY: 4,
        OBJECT: 5,
        ARRAY: 6
    }
    _concatBuffers(buffers) {
        if (typeof Buffer === 'undefined') {
            const totalLength = buffers.reduce((sum, arr) => sum + arr.length, 0);
            const result = new Uint8Array(totalLength);
            let offset = 0;
            buffers.forEach(arr => {
                if (!(arr instanceof Uint8Array)) throw new Error('Buffer must be Uint8Array.');
                result.set(arr, offset);
                offset += arr.length;
            });
            return result;
        } else {
            return Buffer.concat(buffers);
        }
    }
    _isBinary(object) {
        return (
            object instanceof ArrayBuffer ||
            ArrayBuffer.isView(object) || // TypedArrays and DataView
            object?.buffer instanceof ArrayBuffer // slices of a TypedArray
        );
    }
    _create(type, key, value = new Uint8Array(0)) {
        if (typeof key === 'string') key = this.textEncoder.encode(key);
        if (!(value instanceof Uint8Array)) throw new Error('Value must be Uint8Array.');
        const headerSize = 1 + 4 + key.length + 4;
        const buferSize = headerSize + value.length;
        let header = new Uint8Array(headerSize);
        header.set(key, 5);
        header = new DataView(header.buffer);
        header.setUint8(0, type);
        header.setUint32(1, key.length, true);
        header.setUint32(5 + key.length, value.length, true);
        return this._concatBuffers([new Uint8Array(header.buffer), value]);
    }
    _serializeObject(object) {
        const buffers = [];
        for (const key in object) { // using "in" will always enumerate the keys of the object as a string (regardless if it is a array or not)
            switch (typeof object[key]) {
                case 'object': {
                    if (object[key] === null) {
                        buffers.push(this._create(this.TYPES.NULL, key));
                    } else if (this._isBinary(object[key])) {
                        let value;
                        if (ArrayBuffer.isView(object[key])) { // TypedArrays and DataView (nodejs Buffer included)
                            value = object[key].buffer.slice(object[key].byteOffset || 0, (object[key].byteOffset || 0) + object[key].byteLength);
                        } else {
                            value = object[key].buffer || object[key]; // possable bad handling of slices if object[key] is a uncommon TypedArray but not detected
                        }
                        buffers.push(this._create(this.TYPES.BINARY, key, new Uint8Array(value)));
                    } else {
                        buffers.push(this._create(Array.isArray(object[key]) ? this.TYPES.ARRAY : this.TYPES.OBJECT, key, this._serializeObject(object[key])));
                    }
                    break;
                }
                case 'string': {
                    buffers.push(this._create(this.TYPES.STRING, key, this.textEncoder.encode(object[key])));
                    break;
                }
                case 'number': {
                    const view = new DataView(new ArrayBuffer(8));
                    view.setBigUint64(0, BigInt(object[key]), true);
                    buffers.push(this._create(this.TYPES.NUMBER, key, new Uint8Array(view.buffer)));
                    break;
                }
                case 'bigint': {
                    const view = new DataView(new ArrayBuffer(8));
                    view.setBigUint64(0, object[key], true);
                    buffers.push(this._create(this.TYPES.NUMBER, key, new Uint8Array(view.buffer)));
                    break;
                }
                case 'boolean': {
                    let view = new DataView(new ArrayBuffer(1));
                    view.setUint8(0, object[key] ? 1 : 0);
                    buffers.push(this._create(this.TYPES.BOOLEAN, key, new Uint8Array(view.buffer)));
                    break;
                }
                case 'undefined': { // skip over undefined values
                    continue;
                    break;
                }
                default: {
                    throw new Error('Unsupported type: ' + typeof object[key]);
                    break;
                }
            }
        }
        return this._concatBuffers(buffers);
    }
    serialize(object) {
        if (!(object instanceof Object)) throw new Error('Object must be a Object.');
        const rootType = Array.isArray(object) ? this.TYPES.ARRAY : this.TYPES.OBJECT; // type of the root/base object
        return this._concatBuffers([new Uint8Array([rootType]), this._serializeObject(object)]);
    }
    _deserializeObject(type, buffer) {
        const view = new DataView(buffer.buffer);
        let object = {};
        let position = 0;
        while (position < buffer.byteLength) {
            const type = view.getUint8(position);
            position += 1;
            const keyLength = view.getUint32(position, true);
            position += 4;
            const key = this.textDecoder.decode(buffer.slice(position, position + keyLength));
            position += keyLength;
            const valueLength = view.getUint32(position, true);
            position += 4;
            const value = buffer.slice(position, position + valueLength);
            position += valueLength;
            switch (type) {
                case this.TYPES.NULL: {
                    object[key] = null;
                    break;
                }
                case this.TYPES.STRING: {
                    object[key] = this.textDecoder.decode(value);
                    break;
                }
                case this.TYPES.NUMBER: {
                    const view = new DataView(value.buffer);
                    const number = view.getBigUint64(0, true);
                    if (number <= Number.MAX_SAFE_INTEGER) object[key] = Number(number);
                    else object[key] = number;
                    break;
                }
                case this.TYPES.BOOLEAN: {
                    object[key] = value[0] == 1;
                    break;
                }
                case this.TYPES.BINARY: {
                    object[key] = (typeof Buffer !== 'undefined') ? Buffer.from(value) : value;
                    break;
                }
                case this.TYPES.OBJECT: {
                    object[key] = this._deserializeObject(this.TYPES.OBJECT, value);
                    break;
                }
                case this.TYPES.ARRAY: {
                    object[key] = this._deserializeObject(this.TYPES.ARRAY, value);
                    break;
                }
                default: {
                    throw new Error('Unsupported type: ' + type);
                    break;
                }
            }
        }
        if (type == this.TYPES.ARRAY) {
            const array = [];
            for (const key in object) array[parseInt(key)] = object[key];
            return array;
        } else return object;
    }
    deserialize(buffer) {
        if ((typeof Buffer !== 'undefined') && buffer instanceof Buffer) buffer = new Uint8Array(buffer); // convert nodejs's Buffer class to Uint8Array automatically
        if (!(buffer instanceof Uint8Array)) throw new Error('Buffer must be Uint8Array.');
        const rootType = buffer[0];
        return this._deserializeObject(rootType, buffer.slice(1));
    }
}