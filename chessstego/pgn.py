#!/usr/bin/env python3
"""
Module: pgn

This module implements functions to encode and decode a UTF-8 message into/from a chess PGN.
It hides a (compressed) message in the choice of moves from a legal game.
Note: This module requires the python–chess package.
"""

import chess
import chess.pgn
import math
import io
import zlib

# ===== Utility Functions ===== #

def bytes_to_bits(b: bytes) -> list:
    """Convert a bytes object into a list of bits (MSB first)."""
    return [(byte >> i) & 1 for byte in b for i in range(7, -1, -1)]

def bits_to_bytes(bits: list) -> bytes:
    """Convert a list of bits into a bytes object."""
    # Zero-pad to full bytes
    while len(bits) % 8 != 0:
        bits.append(0)
    return bytes(int(''.join(map(str, bits[i:i+8])), 2) for i in range(0, len(bits), 8))

def int_to_bits(num: int, length: int) -> list:
    """Convert an integer to a list of bits (MSB first) of fixed length."""
    return [(num >> i) & 1 for i in range(length - 1, -1, -1)]

def bits_to_int(bits: list) -> int:
    """Convert a list of bits (MSB first) to an integer."""
    return int(''.join(map(str, bits)), 2)

# ===== Compression / Decompression ===== #

def compress_message_to_bits(message: str) -> list:
    """Compress a message and convert to a bitstream."""
    compressed = zlib.compress(message.encode('utf-8'))
    return bytes_to_bits(compressed)

def decompress_message_from_bits(bits: list) -> str:
    """Convert a bitstream into a decompressed UTF-8 message."""
    return zlib.decompress(bits_to_bytes(bits)).decode('utf-8')

# ===== Encoding: Message -> PGN ===== #

def encode_message_to_pgn(message: str) -> str:
    """
    Encode a UTF-8 message into a PGN (only moves), ensuring a legal game.
    If the game ends prematurely, an error is raised.
    """
    message_bits = compress_message_to_bits(message)
    # First 32 bits encode the length of the message_bits
    header_bits = int_to_bits(len(message_bits), 32)
    bitstream = header_bits + message_bits
    
    board = chess.Board()
    moves_encoding = []
    
    while bitstream:
        if board.is_game_over():
            raise ValueError("Game ended before encoding was complete.")
        
        legal_moves = sorted(board.legal_moves, key=lambda m: m.uci())
        n = len(legal_moves)
        if n > 1:
            b = int(math.floor(math.log(n, 2)))
            # If we don't have enough bits, pad with zeros.
            if len(bitstream) < b:
                bitstream.extend([0] * (b - len(bitstream)))
            index = bits_to_int(bitstream[:b]) % n
            bitstream = bitstream[b:]
        else:
            index = 0  # Forced move
        
        chosen_move = legal_moves[index]
        board.push(chosen_move)
        moves_encoding.append(chosen_move)
    
    # The termination headers. If game is not over, we mark it with a "resignation" header.
    result = board.result() if board.is_game_over() else ("0-1" if board.turn == chess.WHITE else "1-0")
    termination = None if board.is_game_over() else "resignation"
    
    game = chess.pgn.Game()
    game.headers["Result"] = result
    if termination:
        game.headers["Termination"] = termination
    
    node = game
    for move in moves_encoding:
        node = node.add_main_variation(move)
    
    exporter = chess.pgn.StringExporter(headers=True, variations=False, comments=False)
    return game.accept(exporter)

# ===== Decoding: PGN -> Message ===== #

def decode_message_from_pgn(pgn_str: str) -> str:
    """
    Decode a message from a PGN game by replaying it and extracting the encoded bits.
    """
    pgn_io = io.StringIO(pgn_str)
    game = chess.pgn.read_game(pgn_io)
    if game is None:
        raise ValueError("Invalid PGN input.")
    
    board = chess.Board()
    extracted_bits = []
    header_read = False
    message_length = None
    
    for move in game.mainline_moves():
        legal_moves = sorted(board.legal_moves, key=lambda m: m.uci())
        n = len(legal_moves)
        b = int(math.floor(math.log(n, 2))) if n > 1 else 0
        
        if b > 0:
            index = legal_moves.index(move)
            extracted_bits.extend(int_to_bits(index, b))
        
        board.push(move)
        
        if not header_read and len(extracted_bits) >= 32:
            message_length = bits_to_int(extracted_bits[:32])
            header_read = True
        
        if header_read and len(extracted_bits) >= 32 + message_length:
            break
    
    if not header_read:
        raise ValueError("Could not extract header from the game.")
    
    message_bits = extracted_bits[32:32 + message_length]
    return decompress_message_from_bits(message_bits)

##########################
# Command-line Interface #
##########################

if __name__ == '__main__':
    import sys

    if not sys.stdin.isatty():
        piped_data = sys.stdin.read().strip()
        if len(sys.argv) >= 2:
            mode = sys.argv[1].lower()
        else:
            sys.exit("Usage: {} encode|decode".format(sys.argv[0]))

        if mode == "encode":
            try:
                pgn = encode_message_to_pgn(piped_data)
                print("Encoded PGN:")
                print(pgn)
            except Exception as e:
                sys.exit("Error: " + str(e))
        elif mode == "decode":
            try:
                message = decode_message_from_pgn(piped_data)
                print("Decoded message:")
                print(message)
            except Exception as e:
                sys.exit("Error: " + str(e))
        else:
            sys.exit("Mode must be 'encode' or 'decode'.")
    else:
        if len(sys.argv) < 3:
            sys.exit("Usage: {} encode|decode <message_or_pgn>".format(sys.argv[0]))
        
        mode = sys.argv[1].lower()
        if mode == "encode":
            message = sys.argv[2]
            try:
                pgn = encode_message_to_pgn(message)
                print("Encoded PGN:")
                print(pgn)
            except Exception as e:
                sys.exit("Error: " + str(e))
        elif mode == "decode":
            pgn_str = sys.argv[2]
            try:
                message = decode_message_from_pgn(pgn_str)
                print("Decoded message:")
                print(message)
            except Exception as e:
                sys.exit("Error: " + str(e))
        else:
            sys.exit("Mode must be 'encode' or 'decode'.")
