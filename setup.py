from setuptools import setup, find_packages

setup(
    name="chessstego",
    version="0.1.0",
    description="Hide messages in chess data using FEN and PGN encodings.",
    long_description=open("README.md", encoding="utf-8").read(),
    long_description_content_type="text/markdown",
    author="Nazar0360",
    author_email="83352561+Nazar0360@users.noreply.github.com",
    url="https://github.com/Nazar0360/chessstego",
    packages=find_packages(),
    install_requires=[
        "python-chess",  # For chess functionality in the Python module.
    ],
    python_requires=">=3.6",
    classifiers=[
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.6",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    entry_points={
        "console_scripts": [
            "chessstego-fen=chessstego.fen:main",
            "chessstego-pgn=chessstego.pgn:main",
        ],
    },
)
