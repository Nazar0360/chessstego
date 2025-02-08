#!/usr/bin/env python3
"""
Module: fen

This module implements functions to encode and decode a text message into a chess FEN.
The encoding hides a message (containing only lowercase letters a–z) in the free squares
of a fixed chess board configuration.

This version uses a starting board of "6bk/6rb/8/8/8/8/BR6/KB6 w - - 1 1" and enforces that
black knights cannot be placed on b3 and c2, and white knights cannot be placed on f7 and g6.
"""

import sys
from functools import reduce
import operator

##############################
# Helper functions and setup #
##############################

def prod(lst):
    return reduce(operator.mul, lst, 1)

# The fixed base board (piece–placement field) is updated.
BASE_FEN = "6bk/6rb/8/8/8/8/BR6/KB6"
REST_FEN_FIELDS = "w - - 1 1"

def expand_fen_piece_placement(piece_field):
    """Expand a FEN piece–placement field into an 8×8 board (list of 8 lists); empty squares are None."""
    ranks = piece_field.split('/')
    if len(ranks) != 8:
        raise ValueError("FEN must have 8 ranks.")
    board = []
    for rank in ranks:
        row = []
        for ch in rank:
            if ch.isdigit():
                row.extend([None] * int(ch))
            else:
                row.append(ch)
        if len(row) != 8:
            raise ValueError("Rank does not have 8 squares.")
        board.append(row)
    return board

def board_to_fen(board):
    """Compress an 8×8 board (list of lists) into a FEN piece–placement field."""
    fen_rows = []
    for row in board:
        count = 0
        row_str = ""
        for cell in row:
            if cell is None:
                count += 1
            else:
                if count:
                    row_str += str(count)
                    count = 0
                row_str += cell
        if count:
            row_str += str(count)
        fen_rows.append(row_str)
    return "/".join(fen_rows)

def get_free_coords(board):
    """Return the list of (row, col) coordinates where the board has None (empty)."""
    coords = []
    for r in range(8):
        for c in range(8):
            if board[r][c] is None:
                coords.append((r, c))
    return coords

# Define forbidden coordinates based on our restrictions.
# Coordinates are (row, col) with row 0 = rank8 and row 7 = rank1.
# Black knights forbidden on b3 and c2:
# b3: file b (col 1), rank3 (row = 8-3 = 5); c2: file c (col 2), rank2 (row = 8-2 = 6)
black_knight_forbidden_coords = {(5, 1), (6, 2)}
# White knights forbidden on f7 and g6:
# f7: file f (col 5), rank7 (row = 8-7 = 1); g6: file g (col 6), rank6 (row = 8-6 = 2)
white_knight_forbidden_coords = {(1, 5), (2, 6)}

def get_digit_base(coord):
    """
    Given a board coordinate (row, col), return the allowed digit base.
    For squares on rank8 (row 0) or rank1 (row 7) the base is 9 (no pawns allowed);
    otherwise the base is 11.
    Additionally, if the coordinate is one where a knight is forbidden (for black or white),
    reduce the base by 1.
    """
    r, _ = coord
    base = 9 if (r == 0 or r == 7) else 11
    # For full-mapping squares (base 11) with a forbidden knight, reduce the base.
    if base == 11 and (coord in black_knight_forbidden_coords or coord in white_knight_forbidden_coords):
        base = 10
    return base

# Mappings for free squares:
# Restricted mapping (base 9) remains unchanged.
digit_to_piece_restricted = {
    0: None,
    1: "Q",
    2: "R",
    3: "B",
    4: "N",
    5: "q",
    6: "r",
    7: "b",
    8: "n"
}
piece_to_digit_restricted = {v: k for k, v in digit_to_piece_restricted.items() if v is not None}

# Full mapping (base 11) for normal squares.
digit_to_piece_full = {
    0: None,
    1: "Q",
    2: "R",
    3: "B",
    4: "N",
    5: "P",
    6: "q",
    7: "r",
    8: "b",
    9: "n",
    10: "p"
}
piece_to_digit_full = {v: k for k, v in digit_to_piece_full.items() if v is not None}

# Custom full mapping for squares where black knight is forbidden (remove "n").
digit_to_piece_full_black = {
    0: None,
    1: "Q",
    2: "R",
    3: "B",
    4: "N",
    5: "P",
    6: "q",
    7: "r",
    8: "b",
    9: "p"
}
piece_to_digit_full_black = {v: k for k, v in digit_to_piece_full_black.items() if v is not None}

# Custom full mapping for squares where white knight is forbidden (remove "N").
digit_to_piece_full_white = {
    0: None,
    1: "Q",
    2: "R",
    3: "B",
    4: "P",
    5: "q",
    6: "r",
    7: "b",
    8: "n",
    9: "p"
}
piece_to_digit_full_white = {v: k for k, v in digit_to_piece_full_white.items() if v is not None}

# Mixed–radix conversion functions
def int_to_mixed_radix(n, bases):
    """
    Convert a nonnegative integer n into a list of digits in the mixed–radix system
    with the given list of bases. The returned list has length = len(bases).
    Assumes 0 <= n < prod(bases).
    """
    digits = []
    for i in range(len(bases)):
        p = prod(bases[i+1:]) if i+1 < len(bases) else 1
        d = n // p
        if d >= bases[i]:
            raise ValueError("Integer too large for the given bases.")
        digits.append(d)
        n %= p
    return digits

def mixed_radix_to_int(digits, bases):
    """
    Convert a list of mixed–radix digits (most significant first) with the given bases
    into an integer.
    """
    n = 0
    for i, d in enumerate(digits):
        p = prod(bases[i+1:]) if i+1 < len(bases) else 1
        n += d * p
    return n

# Message conversion functions (using base 26 with a=0, b=1, …, z=25)
def message_to_int(message):
    """
    Convert a message (string of lowercase letters a–z) into an integer in base 26.
    """
    n = 0
    for ch in message:
        if ch < 'a' or ch > 'z':
            raise ValueError("Message must contain only lowercase letters a-z.")
        n = n * 26 + (ord(ch) - ord('a'))
    return n

def int_to_message(n, length):
    """
    Convert an integer n into a base–26 string of the given length (with a=0, etc.).
    Pads with leading 'a's if necessary.
    """
    digits = [0] * length
    for i in range(length - 1, -1, -1):
        digits[i] = n % 26
        n //= 26
    if n != 0:
        raise ValueError("Integer too large to represent in the given length.")
    return "".join(chr(d + ord('a')) for d in digits)

##################################
# Main encoding/decoding routines
##################################

def encode_message_to_fen(message):
    """
    Encode a text message (only lowercase letters a-z) into the free squares
    of the base board. The first two free squares (in reading order) are used
    as a header (in the restricted, base-9 system) to encode the message length.
    The remaining free squares encode the message (interpreted as a base–26 integer)
    in a mixed–radix system.
    
    Finally, the free squares are filled with chess symbols using the appropriate mapping,
    and the complete FEN is output.
    
    Note: Because of capacity restrictions the maximum allowed message length is 39.
    """
    # Ensure the message is lowercase a-z.
    if any(ch < 'a' or ch > 'z' for ch in message):
        raise ValueError("Message must contain only lowercase letters a-z.")
    L = len(message)
    if L > 39:
        raise ValueError("Message too long; maximum length is 39 characters.")
    
    msg_int = message_to_int(message)
    
    # Get free squares from the fixed base board.
    base_board = expand_fen_piece_placement(BASE_FEN)
    free_coords = get_free_coords(base_board)
    if len(free_coords) != 56:
        raise ValueError("Base board does not have 56 free squares as expected.")
    
    # Determine the allowed base (radix) for each free square.
    free_bases = [get_digit_base(coord) for coord in free_coords]  # list of 56 numbers
    
    # The header: first 2 free squares (restricted, base 9 each)
    header_bases = free_bases[0:2]  # should be [9, 9]
    if L >= prod(header_bases):
        raise ValueError("Message length too large to encode in header.")
    header_digits = int_to_mixed_radix(L, header_bases)  # list of 2 digits
    
    # The message portion: remaining free squares
    message_bases = free_bases[2:]
    capacity = prod(message_bases)
    if msg_int >= capacity:
        raise ValueError("Message integer too large to encode in available free squares.")
    message_digits = int_to_mixed_radix(msg_int, message_bases)  # list of 54 digits
    
    # Combine header and message digits.
    all_digits = header_digits + message_digits  # total length 56 digits
    
    # Now fill the free squares in the base board with the appropriate chess symbols.
    board = expand_fen_piece_placement(BASE_FEN)
    for digit, coord in zip(all_digits, free_coords):
        r, c = coord
        base = get_digit_base(coord)
        if base == 9:
            # Use the restricted mapping.
            if digit not in digit_to_piece_restricted:
                raise ValueError("Digit out of range for restricted mapping.")
            symbol = digit_to_piece_restricted[digit]
        else:
            # Full mapping squares (base 11 normally, but may be reduced to 10 if restricted)
            if coord in black_knight_forbidden_coords:
                if digit not in digit_to_piece_full_black:
                    raise ValueError("Digit out of range for black knight restricted mapping.")
                symbol = digit_to_piece_full_black[digit]
            elif coord in white_knight_forbidden_coords:
                if digit not in digit_to_piece_full_white:
                    raise ValueError("Digit out of range for white knight restricted mapping.")
                symbol = digit_to_piece_full_white[digit]
            else:
                if digit not in digit_to_piece_full:
                    raise ValueError("Digit out of range for full mapping.")
                symbol = digit_to_piece_full[digit]
        board[r][c] = symbol  # if symbol is None, the square remains empty.
    
    new_piece_field = board_to_fen(board)
    return f"{new_piece_field} {REST_FEN_FIELDS}"

def decode_message_from_fen(fen):
    """
    Given a FEN produced by encode_message_to_fen, recover the hidden message.
    The free squares are identified using the fixed base board; for each such square the
    appropriate inverse mapping (restricted if on rank8 or rank1, or adjusted full mapping if knight restrictions apply)
    recovers the digit.
    The first two digits (in base 9) yield the message length; the remaining digits (mixed–radix)
    yield the message integer, which is then converted back to a base–26 string.
    """
    parts = fen.split()
    if len(parts) != 6:
        raise ValueError("FEN must have 6 fields.")
    piece_field = parts[0]
    board = expand_fen_piece_placement(piece_field)
    
    # Use the fixed base board to know which squares were originally free.
    base_board = expand_fen_piece_placement(BASE_FEN)
    free_coords = get_free_coords(base_board)
    if len(free_coords) != 56:
        raise ValueError("Base board does not have 56 free squares as expected.")
    
    # For each free square, use the proper inverse mapping to obtain the digit.
    digits = []
    for coord in free_coords:
        r, c = coord
        cell = board[r][c]
        base = get_digit_base(coord)
        if base == 9:
            if cell is None:
                d = 0
            else:
                if cell not in piece_to_digit_restricted:
                    raise ValueError(f"Unexpected symbol '{cell}' in restricted square at {coord}.")
                d = piece_to_digit_restricted[cell]
        else:
            if coord in black_knight_forbidden_coords:
                if cell is None:
                    d = 0
                else:
                    if cell not in piece_to_digit_full_black:
                        raise ValueError(f"Unexpected symbol '{cell}' in black knight restricted square at {coord}.")
                    d = piece_to_digit_full_black[cell]
            elif coord in white_knight_forbidden_coords:
                if cell is None:
                    d = 0
                else:
                    if cell not in piece_to_digit_full_white:
                        raise ValueError(f"Unexpected symbol '{cell}' in white knight restricted square at {coord}.")
                    d = piece_to_digit_full_white[cell]
            else:
                if cell is None:
                    d = 0
                else:
                    if cell not in piece_to_digit_full:
                        raise ValueError(f"Unexpected symbol '{cell}' in full square at {coord}.")
                    d = piece_to_digit_full[cell]
        digits.append(d)
    
    if len(digits) != 56:
        raise ValueError("Incorrect number of digits extracted.")
    
    # Recover the header (first 2 digits) to obtain the message length.
    free_bases = [get_digit_base(coord) for coord in free_coords]
    header_bases = free_bases[0:2]
    L = mixed_radix_to_int(digits[0:2], header_bases)
    
    # Recover the message portion (remaining digits) using the corresponding bases.
    message_bases = free_bases[2:]
    msg_int = mixed_radix_to_int(digits[2:], message_bases)
    
    # Convert the message integer back into a base–26 string of length L.
    message = int_to_message(msg_int, L)
    return message

##########################
# Command-line interface #
##########################

if __name__ == '__main__':
    if len(sys.argv) < 3:
        sys.exit("Usage: {} encode|decode <message_or_fen>".format(sys.argv[0]))
    
    mode = sys.argv[1].lower()
    if mode == "encode":
        # Input message is taken in lowercase.
        message = sys.argv[2].lower()
        try:
            fen = encode_message_to_fen(message)
            print("Encoded FEN:")
            print(fen)
        except Exception as e:
            sys.exit("Error: " + str(e))
    elif mode == "decode":
        fen = sys.argv[2]
        try:
            message = decode_message_from_fen(fen)
            print("Decoded message:")
            print(message)
        except Exception as e:
            sys.exit("Error: " + str(e))
    else:
        sys.exit("Mode must be 'encode' or 'decode'.")
