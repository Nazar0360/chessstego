"""
chessstego package

This package provides two ways to hide a message in chess data:
- FEN encoding (in fen.py)
- PGN encoding (in pgn.py)
"""

from .fen import encode_message_to_fen, decode_message_from_fen
from .pgn import encode_message_to_pgn, decode_message_from_pgn
