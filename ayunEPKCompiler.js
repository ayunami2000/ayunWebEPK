window.compileEPK = function() {
	let old = false;

	// https://stackoverflow.com/a/18639903/6917520

	const crc32 = (function() {
		let table = new Uint32Array(256);

		for (let i = 256; i--;) {
			let tmp = i;

			for (let k = 8; k--;) {
				tmp = tmp & 1 ? 3988292384 ^ tmp >>> 1 : tmp >>> 1;
			}

			table[i] = tmp;
		}

		return function(data) {
			let crc = -1;

			for (let i = 0, l = data.length; i < l; i++) {
				crc = crc >>> 8 ^ table[crc & 255 ^ data[i]];
			}

			return (crc ^ -1) >>> 0;
		};
	})();

	function concatTypedArrays(a, b) {
		const c = new (a.constructor)(a.length + b.length);
		c.set(a, 0);
		c.set(b, a.length);
		return c;
	}

	const textEncoder = new TextEncoder();
	function generateLongArray(num) {
		return Uint8Array.of((num >>> 56) & 0xFF, (num >>> 48) & 0xFF, (num >>> 40) & 0xFF, (num >>> 32) & 0xFF, (num >>> 24) & 0xFF, (num >>> 16) & 0xFF, (num >>> 8) & 0xFF, num & 0xFF);
	}
	function generateIntArray(num) {
		return Uint8Array.of((num >>> 24) & 0xFF, (num >>> 16) & 0xFF, (num >>> 8) & 0xFF, num & 0xFF);
	}
	function generateShortArray(num) {
		return Uint8Array.of((num >>> 8) & 0xFF, num & 0xFF);
	}
	function generateUTF(str) {
		return concatTypedArrays(generateShortArray(str.length), textEncoder.encode(str));
	}
	function generateUTFByte(str) {
		return concatTypedArrays(Uint8Array.of(str.length), textEncoder.encode(str));
	}

	let comment = '# eaglercraft package file - generated with ayunWebEPK by ayunami2000';

	let commentNew = '\n\n # Eagler EPK v2.0 (c) $$YEAR$$ Calder Young\n # generated with ayunWebEPK by ayunami2000';

	let baseEPK = textEncoder.encode('EAGPKG!!');

	baseEPK = concatTypedArrays(baseEPK, generateUTF(comment));

	let baseEPKNew = textEncoder.encode('EAGPKG$$');
	
	baseEPKNew = concatTypedArrays(baseEPKNew, generateUTFByte('ver2.0'));

	baseEPKNew = concatTypedArrays(baseEPKNew, generateUTFByte('my-cool.epk'));

	let currentEPK = null;

	function processFile(name, type, file) {
		if (old) {
			currentEPK = currentEPK == null ? generateUTF('<file>') : concatTypedArrays(currentEPK, generateUTF('<file>'));
			currentEPK = concatTypedArrays(currentEPK, generateUTF(name));
			currentEPK = concatTypedArrays(currentEPK, new Uint8Array(sha1.arrayBuffer(file.buffer)));
			currentEPK = concatTypedArrays(currentEPK, generateIntArray(file.byteLength));
			currentEPK = concatTypedArrays(currentEPK, file);
			currentEPK = concatTypedArrays(currentEPK, generateUTF('</file>'));
		} else {
			currentEPK = concatTypedArrays(currentEPK, textEncoder.encode(type));
			currentEPK = concatTypedArrays(currentEPK, generateUTFByte(name));
			currentEPK = concatTypedArrays(currentEPK, generateIntArray(file.byteLength + 5));
			currentEPK = concatTypedArrays(currentEPK, generateIntArray(crc32(file)));
			currentEPK = concatTypedArrays(currentEPK, file);
			currentEPK = concatTypedArrays(currentEPK, textEncoder.encode(':>'));
		}
	}
	
	function wrapItUp(size) {
		if (old) {
			currentEPK = concatTypedArrays(currentEPK, generateUTF(' end'));
			currentEPK = concatTypedArrays(baseEPK, new Uint8Array(pako.deflate(currentEPK, { level: 9 })));
		} else {
			let currBaseEPK = baseEPKNew;
			currBaseEPK = concatTypedArrays(currBaseEPK, generateUTF(commentNew.replace('$$YEAR$$', new Date().getFullYear())));
			currBaseEPK = concatTypedArrays(currBaseEPK, generateLongArray(Date.now()));
			currBaseEPK = concatTypedArrays(currBaseEPK, generateIntArray(size + 1));
			currBaseEPK = concatTypedArrays(currBaseEPK, Uint8Array.of(90));
			currentEPK = concatTypedArrays(currentEPK, textEncoder.encode('END$'));
			currentEPK = concatTypedArrays(currBaseEPK, new Uint8Array(pako.deflate(currentEPK, { level: 9 })));
			currentEPK = concatTypedArrays(currentEPK, textEncoder.encode(':::YEE:>'));
		}
		const blob = new Blob([ currentEPK ], { type: 'application/octet-stream' });
		currentEPK = null;
		old = false;
		return blob;
	}

	return async function(files, oldMode, fileev) {
		let onfile = function() {};
		if (fileev != null) {
			onfile = fileev;
		}
		currentEPK = null;
		old = oldMode;
		// files is same format as output from decompiler
		if (!old) {
			currentEPK = textEncoder.encode('HEAD');
			currentEPK = concatTypedArrays(currentEPK, generateUTFByte('file-type'));
			const fileType = 'epk/resources';
			currentEPK = concatTypedArrays(currentEPK, generateIntArray(fileType.length));
			currentEPK = concatTypedArrays(currentEPK, textEncoder.encode(fileType));
			currentEPK = concatTypedArrays(currentEPK, Uint8Array.of(62));
		}
		for (const file of files) {
			processFile(file.name, file.type, new Uint8Array(await file.data.arrayBuffer()));
			onfile();
		}
		return wrapItUp(files.length);
	};
};