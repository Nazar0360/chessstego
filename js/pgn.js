/* 
  pgn.js
  Implements functions to encode/decode an arbitrary UTF-8 message into/from a legal PGN game.
  (This version compresses the message and embeds bits into move choices, and it now adds a 
  termination header (“resignation”) if the game is not over.)
*/

(function () {
	// ──────────────────────────────
	// Utility functions
	// ──────────────────────────────

	// Convert a Uint8Array (or array of bytes) into an array of bits (MSB first).
	function bytesToBits(bytes) {
		const bits = [];
		for (let byte of bytes) {
			for (let i = 7; i >= 0; i--) {
				bits.push((byte >> i) & 1);
			}
		}
		return bits;
	}

	// Convert an array of bits (MSB first) into a Uint8Array.
	function bitsToBytes(bits) {
		while (bits.length % 8 !== 0) bits.push(0);
		const bytes = [];
		for (let i = 0; i < bits.length; i += 8) {
			const byte = parseInt(bits.slice(i, i + 8).join(''), 2);
			bytes.push(byte);
		}
		return new Uint8Array(bytes);
	}

	// Convert an integer into an array of bits (of fixed length, MSB first).
	function intToBits(num, length) {
		const bits = [];
		for (let i = length - 1; i >= 0; i--) {
			bits.push((num >> i) & 1);
		}
		return bits;
	}

	// Convert an array of bits (MSB first) into an integer.
	function bitsToInt(bits) {
		return parseInt(bits.join(''), 2);
	}

	// Compress a message string into a bit array using pako.
	function compressMessageToBits(message) {
		const compressed = pako.deflate(message, { to: 'uint8array' });
		return bytesToBits(compressed);
	}

	// Decompress a bit array into a message string using pako.
	function decompressMessageFromBits(bits) {
		const bytes = bitsToBytes(bits);
		const decompressed = pako.inflate(bytes);
		return new TextDecoder("utf-8").decode(decompressed);
	}

	// ──────────────────────────────
	// PGN Encoding
	// ──────────────────────────────

	// Encode a message into a PGN game string.
	function encodeMessageToPGN(message) {
		let messageBits = compressMessageToBits(message);
		// First 32 bits encode the length of the message bitstream.
		const headerBits = intToBits(messageBits.length, 32);
		let bitstream = headerBits.concat(messageBits);

		let chess = new Chess();
		const movesEncoding = [];

		while (bitstream.length > 0) {
			if (chess.game_over()) throw "Game ended before encoding was complete.";
			let legalMoves = chess.moves({ verbose: true });
			// Sort legal moves in canonical order (by from/to/promotion).
			legalMoves.sort((a, b) => {
				const aStr = a.from + a.to + (a.promotion || '');
				const bStr = b.from + b.to + (b.promotion || '');
				return aStr.localeCompare(bStr);
			});
			const n = legalMoves.length;
			let b = 0;
			let chosenMove;
			if (n > 1) {
				b = Math.floor(Math.log2(n));
				// If not enough bits remain, pad with zeros.
				if (bitstream.length < b) while (bitstream.length < b) bitstream.push(0);
				const bitsForMove = bitstream.slice(0, b);
				let index = bitsToInt(bitsForMove) % n;
				bitstream = bitstream.slice(b);
				chosenMove = legalMoves[index];
			} else {
				chosenMove = legalMoves[0]; // Forced move.
			}
			movesEncoding.push(chosenMove.san);
			chess.move(chosenMove.san);
		}

		// Determine game result and termination header.
		let result, termination = "";
		if (chess.game_over()) {
			if (chess.in_checkmate()) {
				// The side not on turn delivered mate.
				result = (chess.turn() === 'w' ? "0-1" : "1-0");
			} else {
				result = "1/2-1/2";
			}
		} else {
			// If the game did not end naturally, choose a default result and add a termination header.
			result = (chess.turn() === 'w' ? "0-1" : "1-0");
			termination = "resignation";
		}

		// Build PGN header block.
		const headers = [];
		headers.push('[Event "?"]');
		headers.push('[Site "?"]');
		headers.push('[Date "????.??.??"]');
		headers.push('[Round "?"]');
		headers.push('[White "?"]');
		headers.push('[Black "?"]');
		headers.push('[Result "' + result + '"]');
		if (termination) headers.push('[Termination "' + termination + '"]');
		const headerBlock = headers.join("\n");

		// Build PGN move text.
		let moveText = "";
		for (let i = 0; i < movesEncoding.length; i++) {
			if (i % 2 === 0) {
				moveText += ((i / 2) + 1) + ". ";
			}
			moveText += movesEncoding[i] + " ";
		}
		moveText += result;

		return headerBlock + "\n\n" + moveText;
	}

	// ──────────────────────────────
	// PGN Decoding
	// ──────────────────────────────

	// Decode a message from a PGN game string.
	function decodeMessageFromPGN(pgnStr) {
		// First, remove header lines.
		const lines = pgnStr.split("\n").filter(line => line.trim() !== "");
		const moveLines = lines.filter(line => !line.startsWith('['));
		const movesText = moveLines.join(" ");
		// Remove move numbers and result tokens.
		const tokens = movesText.split(/\s+/).filter(token =>
			token && !/^\d+\./.test(token) && !/^1-0|0-1|1\/2-1\/2$/.test(token)
		);

		let chess = new Chess();
		let extractedBits = [];
		let headerRead = false;
		let messageLength = null;

		for (let token of tokens) {
			const legalMoves = chess.moves({ verbose: true });
			legalMoves.sort((a, b) => {
				const aStr = a.from + a.to + (a.promotion || '');
				const bStr = b.from + b.to + (b.promotion || '');
				return aStr.localeCompare(bStr);
			});
			const n = legalMoves.length;
			const b = (n > 1) ? Math.floor(Math.log2(n)) : 0;
			if (b > 0) {
				const index = legalMoves.findIndex(m => m.san === token);
				if (index === -1) throw "Move not found in legal moves during decoding.";
				const bits = intToBits(index, b);
				extractedBits = extractedBits.concat(bits);
			}
			chess.move(token);
			if (!headerRead && extractedBits.length >= 32) {
				messageLength = bitsToInt(extractedBits.slice(0, 32));
				headerRead = true;
			}
			if (headerRead && extractedBits.length >= 32 + messageLength) break;
		}

		if (!headerRead) throw "Could not extract header from PGN.";
		const messageBits = extractedBits.slice(32, 32 + messageLength);
		return decompressMessageFromBits(messageBits);
	}

	// Expose UI functions globally.
	window.encodePGN = function () {
		const input = document.getElementById("pgn-input").value;
		try {
			const pgn = encodeMessageToPGN(input);
			document.getElementById("pgn-output").value = pgn;
		} catch (err) {
			alert("Error: " + err);
		}
	};

	window.decodePGN = function () {
		const pgn = document.getElementById("pgn-decode-input").value;
		try {
			const message = decodeMessageFromPGN(pgn);
			document.getElementById("pgn-decode-output").value = message;
		} catch (err) {
			alert("Error: " + err);
		}
	};

})();
