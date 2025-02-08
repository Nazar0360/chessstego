# ChessStego

ChessStego is a steganography toolkit that hides secret messages within the structure of chess game representations. It provides two unique methods of encoding and decoding messages:

- **FEN Encoding**: Embeds a message into the free squares of a fixed chess board configuration by interpreting the message as a mixed–radix number.
- **PGN Encoding**: Conceals a compressed UTF-8 message within the move choices of a legal chess game.

Both approaches allow you to transform an innocuous-looking chess position or game into a carrier for hidden information.

---

## Features

- **FEN-Based Steganography**
  - **Fixed Board Configuration**: Uses the board defined by `6bk/6rb/8/8/8/8/BR6/KB6`, which contains exactly 56 free (empty) squares.
  - **Mixed–Radix Encoding**: The first two free squares (using a restricted, base‑9 mapping) encode the message length, and the remaining squares encode the message (interpreted as a base‑28 integer) using a varying base determined by square location and knight–placement restrictions.
  - **Message Restrictions**: Only lowercase letters `a–z`, space, and backslash (`\`) are allowed, with a maximum message length of 38 characters.

- **PGN-Based Steganography**
  - **Legal Move Encoding**: Hides a compressed message in the choice of moves in a legal chess game. The encoding dynamically uses the number of legal moves at each step to determine how many bits to hide.
  - **Compression**: Uses zlib to compress the message before encoding, allowing any UTF-8 message to be embedded.
  - **Integration with python‑chess**: Ensures that the generated PGN represents a valid chess game.

- **JavaScript Implementations**
  - The repository also includes JavaScript versions of the FEN and PGN encoders/decoders.
  - A demo web page is available at [https://nazar0360.github.io/chessstego/](https://nazar0360.github.io/chessstego/).

---

## Installation

To get started with ChessStego, clone the repository and install the package:

```bash
git clone https://github.com/Nazar0360/chessstego.git
cd chessstego
pip install -e .
```

### Dependencies

- **Python 3.6+**
- **[python‑chess](https://pypi.org/project/chess/)** (required for the PGN module)
- Standard libraries such as `zlib`, `io`, and `math`

---

## Usage

ChessStego can be used both from the command line and as a module in your own Python projects.

### Command-Line Interface

Both the FEN and PGN modules support encoding and decoding via the command line.

#### FEN Encoding/Decoding

- **Encode a message into a FEN:**

  ```bash
  python -m chessstego.fen encode "your secret message"
  ```

  This command outputs a FEN string with your hidden message embedded in the free squares.

- **Decode a message from a FEN:**

  ```bash
  python -m chessstego.fen decode "FEN_STRING_HERE"
  ```

  This command extracts and displays the hidden message from the provided FEN.

#### PGN Encoding/Decoding

- **Encode a message into a PGN:**

  ```bash
  python -m chessstego.pgn encode "your secret message"
  ```

  This produces a PGN game (in move list format) where the moves encode your compressed message.

- **Decode a message from a PGN:**

  ```bash
  python -m chessstego.pgn decode "PGN_STRING_HERE"
  ```

  This extracts the compressed bit stream from the game and decompresses it to recover the original message.

### Web Interface

A web-based version is available at [https://nazar0360.github.io/chessstego/](https://nazar0360.github.io/chessstego/).

---

## How It Works

### FEN Module (`chessstego/fen.py`)

- **Encoding Process**:
  1. **Message Conversion**: The input message (restricted to lowercase letters, space, and backslash) is converted into a base‑28 integer.
  2. **Header Encoding**: The first two free squares (using a restricted, base‑9 mapping) encode the message length.
  3. **Message Encoding**: The remaining free squares encode the message integer using a mixed–radix system. The digit base for each free square is determined by its board position and specific knight restrictions.
  4. **FEN Generation**: The digits are mapped to chess piece symbols and placed on the free squares of the fixed board to produce the final FEN string.

- **Decoding Process**:
  1. **Extracting Digits**: The FEN is parsed, and the symbols from the free squares are converted back into digits.
  2. **Header Reading**: The first two digits reveal the length of the hidden message.
  3. **Message Reconstruction**: The remaining digits are used to reconstruct the original base‑28 integer, which is then converted back into the text message.

### PGN Module (`chessstego/pgn.py`)

- **Encoding Process**:
  1. **Compression**: The message is compressed using zlib.
  2. **Bitstream Construction**: A header of 32 bits (representing the length of the compressed bitstream) is prepended to the bitstream.
  3. **Legal Game Generation**: Starting from the initial chess position, the encoder simulates a legal chess game. At each move, the number of legal moves available is used to determine how many bits can be encoded. The move chosen encodes part of the message.
  4. **PGN Exporting**: The resulting sequence of moves is exported as a PGN game, which includes headers such as the result and termination details.

- **Decoding Process**:
  1. **Game Replay**: The PGN is parsed and replayed move by move.
  2. **Bit Extraction**: As each move is made, the embedded bits are extracted based on the number of legal moves at that point.
  3. **Decompression**: Once the header and full bitstream are recovered, the compressed message is decompressed to reveal the original text.

---

## Contributing

Contributions are welcome! If you have ideas for enhancements or additional features, please open an issue or submit a pull request on [GitHub](https://github.com/Nazar0360/chessstego).

---

## License

This project is licensed under the terms detailed in the [LICENSE.md](./LICENSE.md) file.

---

## Disclaimer

ChessStego is intended for educational and entertainment purposes only. The encoding techniques demonstrated here are not intended for secure communication or sensitive data protection.

**Authorship Disclaimer:**  
Please note that almost the entire project was generated by ChatGPT. However, the core idea, the ✨prompt engineering✨, and some fixes/adjustments were done by me (I'm too lazy/stupid to write it all manually).

---

Happy encoding!
