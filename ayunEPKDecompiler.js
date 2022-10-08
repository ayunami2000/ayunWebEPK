window.decompileEPK = function() {
	let currentOffset = 0;

	let numFiles = 0;

	let onfile = function() {};

	function detectOldHeader(epkData) {
		const oldHeader = "EAGPKG!!";
		for (let i = 0; i < oldHeader.length; i++) {
			if (epkData[i] != oldHeader.charCodeAt(i)) return false;
		}
		return true;
	}

	function readASCII(epkData) {
		const len = read(epkData);
		let str = "";
		for (let i = 0; i < len; i++) {
			str += String.fromCharCode(read(epkData));
		}
		return str;
	}

	function read(epkData) {
		return epkData[currentOffset++];
	}

	function skip(num) {
		currentOffset += num;
	}

	function loadShort(epkData) {
		return (read(epkData) << 8) | read(epkData);
	}

	function loadInt(epkData) {
		return (read(epkData) << 24) | (read(epkData) << 16) | (read(epkData) << 8) | read(epkData);
	}

	function readUTF(epkData) {
		const len = loadShort(epkData);
		let str = "";
		for (let i = 0; i < len; i++) {
			str += String.fromCharCode(read(epkData));
		}
		return str;
	}

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

	function decompileOld(epkData) {
		readUTF(epkData);

		try {
			let zData = pako.inflate(epkData.slice(currentOffset));
			currentOffset = 0;
			return readFilesOld(zData);
		} catch (err) {
			return null;
		}
	}

	function decompileNew(epkData) {
		const vers = readASCII(epkData);
		
		if (!vers.startsWith("ver2.")) {
			return null;
		}

		skip(read(epkData));
		skip(loadShort(epkData));
		skip(8);

		numFiles = loadInt(epkData);

		const compressionType = String.fromCharCode(read(epkData));

		let zData = epkData.slice(currentOffset);
		
		if (compressionType == "Z" || compressionType == "G") {
			try {
				zData = pako.inflate(zData);
			} catch (err) {
				return null;
			}
		} else if (compressionType == "0") {
			// do nothing
		} else {
			return null;
		}

		currentOffset = 0;

		return readFilesNew(zData);
	}

	function readFilesOld(data) {
		let files = [];

		let file;
		while ((file = readFileOld(data)) != null) {
			if (file == -1) return null;
			files.push(file);
			onfile();
		}

		onfile = function() {};

		return files;
	}

	function readFileOld(data) {
		const s = readUTF(data);
		if (s == " end") {
			return null;
		} else if (s != "<file>") {
			return -1;
		}

		const path = readUTF(data);

		skip(20);

		const len = loadInt(data);
		const blob = new Blob([data.slice(currentOffset, currentOffset + len)]);
		skip(len);
		if (readUTF(data) != "</file>") {
			return -1;
		}

		return {
			type: "FILE",
			name: path,
			data: blob
		};
	}

	function readFilesNew(data) {
		let files = [];

		let file;
		while ((file = readFileNew(data)) != null) {
			if (file == -1) return null;
			files.push(file);
			onfile();
		}

		onfile = function() {};

		return files;
	}

	function readFileNew(data) {
		const type = String.fromCharCode(read(data), read(data), read(data), read(data));

		if (numFiles == 0) {
			if (type != "END$") {
				return -1;
			}
			return null;
		}

		if (type == "END$") {
			return -1;
		}

		const name = readASCII(data);
		const len = loadInt(data);
		let blob = null;

		if (type == "FILE") {
			if (len < 5) {
				return -1;
			}

			const crc = loadInt(data);
			const blobBuffer = data.slice(currentOffset, currentOffset + len - 5);
			skip(len - 5);
			blob = new Blob([blobBuffer]);

			if (crc != (crc32(blobBuffer) | 0)) {
				return -1;
			}

			if (read(data) != 58) {
				return -1;
			}
		} else {
			blob = new Blob([data.slice(currentOffset, currentOffset + len)]);
			skip(len);
		}

		if (read(data) != 62) {
			return -1;
		}

		numFiles--;

		return {
			type: type,
			name: name,
			data: blob
		};
	}

	return async function(rawBuffer, fileev) {
		if (fileev != null) {
			onfile = fileev;
		}

		let epkData = new Uint8Array(rawBuffer);

		if (detectOldHeader(epkData)) {
			epkData = epkData.slice(8);
			return decompileOld(epkData);
		}

		const header = "EAGPKG$$";
		for (let i = 0; i < header.length; i++) {
			if (epkData[i] != header.charCodeAt(i)) return null;
		}

		const endCode = ":::YEE:>";
		for (let i = 0; i < endCode.length; i++) {
			if (epkData[epkData.length - 8 + i] != endCode.charCodeAt(i)) return null;
		}

		epkData = epkData.slice(8, -8);
		return decompileNew(epkData);
	};
};