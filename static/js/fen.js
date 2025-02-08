/* 
  fen.js
  Implements functions to encode/decode a text message (allowed characters: a–z, space, and backslash)
  into/from a chess FEN string.
  
  This version has been updated to match the newer Python implementation and uses BigInt for
  arbitrary-precision arithmetic when converting the message to/from a base‑28 integer.
  
  The fixed board (BASE_FEN) now has 56 free squares. The first two free squares (using a restricted,
  base‑9 mapping) encode the message length (up to 38 characters). The remaining free squares encode
  the message integer (interpreted in a mixed–radix system). For squares on rank 8 (row 0) or rank 1 (row 7)
  the allowed digit base is 9; otherwise it is normally 11 unless the square is one where a knight is
  forbidden—in which case it is 10.
  
  Knight restrictions:
	- Black knights are forbidden on b3 and c2 (coordinates [5,1] and [6,2]).
	- White knights are forbidden on f7 and g6 (coordinates [1,5] and [2,6]).
  
  Piece mappings:
	- Restricted mapping (base 9; no pawns):
		0: null, 1: "Q", 2: "q", 3: "R", 4: "r",
		5: "B", 6: "b", 7: "N", 8: "n"
	- Full mapping (base 11; alternating white/black):
		0: null, 1: "Q", 2: "q", 3: "R", 4: "r",
		5: "B", 6: "b", 7: "N", 8: "n", 9: "P", 10: "p"
	- Full mapping for squares where a black knight is forbidden (base 10; omit "n"):
		0: null, 1: "Q", 2: "q", 3: "R", 4: "r",
		5: "B", 6: "b", 7: "N", 8: "P", 9: "p"
	- Full mapping for squares where a white knight is forbidden (base 10; omit "N"):
		0: null, 1: "Q", 2: "q", 3: "R", 4: "r",
		5: "B", 6: "b", 7: "n", 8: "P", 9: "p"
  
  Message conversion:
	The allowed characters are "abcdefghijklmnopqrstuvwxyz \\" (26 letters, a space, and a backslash).
	They are interpreted as digits in base 28.
*/

(function () {
	// --- Constants and settings ---

	// Fixed base board (FEN piece–placement field). This board has 56 free squares.
	const BASE_FEN = "6bk/6rb/8/8/8/8/BR6/KB6";
	const REST_FEN_FIELDS = "w - - 1 1";

	// Maximum allowed message length.
	const MAX_MESSAGE_LENGTH = 38;

	// Allowed characters for messages.
	// (Note: In a JS string, "\\" represents a literal backslash.)
	const ALPHABET = "abcdefghijklmnopqrstuvwxyz \\";
	const BASE_MESSAGE = ALPHABET.length; // 28

	// --- Knight forbidden squares ---
	// Coordinates are [row, col] with row 0 = rank 8 and row 7 = rank 1.
	const blackKnightForbiddenCoords = new Set(["5,1", "6,2"]);
	const whiteKnightForbiddenCoords = new Set(["1,5", "2,6"]);

	// --- Helper functions ---

	// Multiply all elements of an array (using BigInt).
	function prod(arr) {
		return arr.reduce((a, b) => a * BigInt(b), 1n);
	}

	// Expand a FEN piece–placement field into an 8×8 board (2D array). Empty squares are null.
	function expandFenPiecePlacement(pieceField) {
		const ranks = pieceField.split('/');
		if (ranks.length !== 8) throw "FEN must have 8 ranks.";
		const board = [];
		for (let rank of ranks) {
			const row = [];
			for (let ch of rank) {
				if (/\d/.test(ch)) {
					const count = parseInt(ch, 10);
					for (let i = 0; i < count; i++) row.push(null);
				} else {
					row.push(ch);
				}
			}
			if (row.length !== 8) throw "Rank does not have 8 squares.";
			board.push(row);
		}
		return board;
	}

	// Convert a board (2D array) back into a FEN piece–placement string.
	function boardToFen(board) {
		return board.map(row => {
			let count = 0, rowStr = "";
			for (let cell of row) {
				if (cell === null) count++;
				else {
					if (count > 0) { rowStr += count; count = 0; }
					rowStr += cell;
				}
			}
			if (count > 0) rowStr += count;
			return rowStr;
		}).join('/');
	}

	// Get the list of free coordinates (cells that are null).
	function getFreeCoords(board) {
		const coords = [];
		for (let r = 0; r < 8; r++) {
			for (let c = 0; c < 8; c++) {
				if (board[r][c] === null) coords.push([r, c]);
			}
		}
		return coords;
	}

	// Return the allowed digit base for a coordinate.
	// For squares on rank 8 (row 0) or rank 1 (row 7) the base is 9; otherwise 11.
	// Additionally, if the square is one where a knight is forbidden, reduce the base to 10.
	function getDigitBase(coord) {
		const [r, c] = coord;
		let base = (r === 0 || r === 7) ? 9 : 11;
		if (base === 11 && (blackKnightForbiddenCoords.has(r + "," + c) || whiteKnightForbiddenCoords.has(r + "," + c))) {
			base = 10;
		}
		return base;
	}

	// --- Piece Mappings ---

	// Restricted mapping (base 9): no pawns allowed.
	const digitToPieceRestricted = {
		0: null,
		1: "Q",
		2: "q",
		3: "R",
		4: "r",
		5: "B",
		6: "b",
		7: "N",
		8: "n"
	};
	const pieceToDigitRestricted = invertMapping(digitToPieceRestricted);

	// Full mapping (base 11): alternating white and black pieces.
	const digitToPieceFull = {
		0: null,
		1: "Q",
		2: "q",
		3: "R",
		4: "r",
		5: "B",
		6: "b",
		7: "N",
		8: "n",
		9: "P",
		10: "p"
	};
	const pieceToDigitFull = invertMapping(digitToPieceFull);

	// Custom full mapping for squares where a black knight is forbidden (base 10; omit "n").
	const digitToPieceFullBlack = {
		0: null,
		1: "Q",
		2: "q",
		3: "R",
		4: "r",
		5: "B",
		6: "b",
		7: "N",
		8: "P",
		9: "p"
	};
	const pieceToDigitFullBlack = invertMapping(digitToPieceFullBlack);

	// Custom full mapping for squares where a white knight is forbidden (base 10; omit "N").
	const digitToPieceFullWhite = {
		0: null,
		1: "Q",
		2: "q",
		3: "R",
		4: "r",
		5: "B",
		6: "b",
		7: "n",
		8: "P",
		9: "p"
	};
	const pieceToDigitFullWhite = invertMapping(digitToPieceFullWhite);

	// Invert a mapping: piece → digit.
	function invertMapping(mapping) {
		const inv = {};
		for (let key in mapping) {
			if (mapping[key] !== null) {
				inv[mapping[key]] = parseInt(key, 10);
			}
		}
		return inv;
	}

	// --- Mixed–radix conversion functions (using BigInt) ---

	function intToMixedRadix(n, bases) {
		// n is a BigInt.
		const digits = [];
		for (let i = 0; i < bases.length; i++) {
			const p = prod(bases.slice(i + 1));  // BigInt product of remaining bases.
			const d = n / p;  // BigInt division (floored).
			if (d >= BigInt(bases[i])) throw "Integer too large for given bases.";
			digits.push(Number(d));  // d is small, safe to convert.
			n = n % p;
		}
		return digits;
	}

	function mixedRadixToInt(digits, bases) {
		let n = 0n;
		for (let i = 0; i < digits.length; i++) {
			const p = prod(bases.slice(i + 1));
			n += BigInt(digits[i]) * p;
		}
		return n;
	}

	// --- Message conversion functions (base 28, using BigInt) ---

	function messageToInt(message) {
		let n = 0n;
		for (let ch of message) {
			const idx = ALPHABET.indexOf(ch);
			if (idx === -1)
				throw "Message must contain only allowed characters: " + ALPHABET;
			n = n * BigInt(BASE_MESSAGE) + BigInt(idx);
		}
		return n;
	}

	function intToMessage(n, length) {
		const digits = new Array(length).fill(0);
		for (let i = length - 1; i >= 0; i--) {
			digits[i] = Number(n % BigInt(BASE_MESSAGE));
			n = n / BigInt(BASE_MESSAGE);
		}
		if (n !== 0n) throw "Integer too large for given length.";
		return digits.map(d => ALPHABET[d]).join('');
	}

	// --- Main encoding/decoding routines ---

	function encodeMessageToFEN(message) {
		if ([...message].some(ch => ALPHABET.indexOf(ch) === -1))
			throw "Message must contain only allowed characters: " + ALPHABET;
		const L = message.length;
		if (L > MAX_MESSAGE_LENGTH)
			throw "Message too long; maximum length is " + MAX_MESSAGE_LENGTH + " characters.";
		const msgInt = messageToInt(message);

		const baseBoard = expandFenPiecePlacement(BASE_FEN);
		const freeCoords = getFreeCoords(baseBoard);
		if (freeCoords.length !== 56)
			throw "Base board must have 56 free squares.";
		const freeBases = freeCoords.map(coord => getDigitBase(coord));

		// Header: first 2 free squares (restricted mapping, base 9) encode the message length.
		const headerBases = freeBases.slice(0, 2);
		if (L >= prod(headerBases))
			throw "Message length too large to encode in header.";
		const headerDigits = intToMixedRadix(BigInt(L), headerBases);

		// Message portion: remaining free squares encode the message integer.
		const messageBases = freeBases.slice(2);
		const capacity = prod(messageBases);
		if (msgInt >= capacity)
			throw "Message integer too large to encode in available free squares.";
		const messageDigits = intToMixedRadix(msgInt, messageBases);

		const allDigits = headerDigits.concat(messageDigits);
		const board = expandFenPiecePlacement(BASE_FEN);
		for (let i = 0; i < freeCoords.length; i++) {
			const [r, c] = freeCoords[i];
			const base = getDigitBase(freeCoords[i]);
			let symbol;
			if (base === 9) {
				if (!(allDigits[i] in digitToPieceRestricted))
					throw "Digit out of range for restricted mapping.";
				symbol = digitToPieceRestricted[allDigits[i]];
			} else {
				const coordKey = r + "," + c;
				if (blackKnightForbiddenCoords.has(coordKey)) {
					if (!(allDigits[i] in digitToPieceFullBlack))
						throw "Digit out of range for black knight restricted mapping.";
					symbol = digitToPieceFullBlack[allDigits[i]];
				} else if (whiteKnightForbiddenCoords.has(coordKey)) {
					if (!(allDigits[i] in digitToPieceFullWhite))
						throw "Digit out of range for white knight restricted mapping.";
					symbol = digitToPieceFullWhite[allDigits[i]];
				} else {
					if (!(allDigits[i] in digitToPieceFull))
						throw "Digit out of range for full mapping.";
					symbol = digitToPieceFull[allDigits[i]];
				}
			}
			board[r][c] = symbol;
		}
		return boardToFen(board) + " " + REST_FEN_FIELDS;
	}

	function decodeMessageFromFEN(fen) {
		const parts = fen.split(" ");
		if (parts.length !== 6)
			throw "FEN must have 6 fields.";
		const pieceField = parts[0];
		const board = expandFenPiecePlacement(pieceField);
		const baseBoard = expandFenPiecePlacement(BASE_FEN);
		const freeCoords = getFreeCoords(baseBoard);
		if (freeCoords.length !== 56)
			throw "Base board must have 56 free squares.";
		const digits = [];
		for (let coord of freeCoords) {
			const [r, c] = coord;
			const cell = board[r][c];
			const base = getDigitBase(coord);
			let d;
			if (base === 9) {
				if (cell === null) d = 0;
				else {
					if (!(cell in pieceToDigitRestricted))
						throw `Unexpected symbol '${cell}' in restricted square at ${coord}.`;
					d = pieceToDigitRestricted[cell];
				}
			} else {
				const coordKey = r + "," + c;
				if (blackKnightForbiddenCoords.has(coordKey)) {
					if (cell === null) d = 0;
					else {
						if (!(cell in pieceToDigitFullBlack))
							throw `Unexpected symbol '${cell}' in black knight restricted square at ${coord}.`;
						d = pieceToDigitFullBlack[cell];
					}
				} else if (whiteKnightForbiddenCoords.has(coordKey)) {
					if (cell === null) d = 0;
					else {
						if (!(cell in pieceToDigitFullWhite))
							throw `Unexpected symbol '${cell}' in white knight restricted square at ${coord}.`;
						d = pieceToDigitFullWhite[cell];
					}
				} else {
					if (cell === null) d = 0;
					else {
						if (!(cell in pieceToDigitFull))
							throw `Unexpected symbol '${cell}' in full square at ${coord}.`;
						d = pieceToDigitFull[cell];
					}
				}
			}
			digits.push(d);
		}
		const freeBases = freeCoords.map(coord => getDigitBase(coord));
		const headerBases = freeBases.slice(0, 2);
		const L = Number(mixedRadixToInt(digits.slice(0, 2), headerBases));
		const messageBases = freeBases.slice(2);
		const msgInt = mixedRadixToInt(digits.slice(2), messageBases);
		return intToMessage(msgInt, L);
	}

	// --- Expose UI functions globally ---

	window.encodeFEN = function () {
		const input = document.getElementById("fen-input").value.trim();
		try {
			const fen = encodeMessageToFEN(input);
			document.getElementById("fen-output").value = fen;
		} catch (err) {
			alert("Error: " + err);
		}
	};

	window.decodeFEN = function () {
		const fen = document.getElementById("fen-decode-input").value.trim();
		try {
			const message = decodeMessageFromFEN(fen);
			document.getElementById("fen-decode-output").value = message;
		} catch (err) {
			alert("Error: " + err);
		}
	};

})();
