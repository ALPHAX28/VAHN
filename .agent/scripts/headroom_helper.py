import sys
import os
import argparse

try:
    import headroom
except ImportError:
    print("Error: headroom-ai is not installed in the current Python environment.", file=sys.stderr)
    print("Please run: pip install headroom-ai", file=sys.stderr)
    sys.exit(1)

def compress_text(text: str, target_ratio: float = 0.5) -> str:
    """Compress a text string using headroom."""
    messages = [{"role": "user", "content": text}]
    try:
        # headroom.compress returns a CompressResult
        result = headroom.compress(messages, target_ratio=target_ratio)
        return result.messages[0]['content']
    except Exception as e:
        print(f"Error during headroom compression: {e}", file=sys.stderr)
        return text

def compress_file(file_path: str, target_ratio: float = 0.5) -> str:
    """Read a file, compress its content, and return the compressed text."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
    
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    return compress_text(content, target_ratio=target_ratio)

def main():
    parser = argparse.ArgumentParser(description="Headroom Context Compression Utility")
    subparsers = parser.add_subparsers(dest="command", help="Subcommands")

    # Compress file subcommand
    compress_parser = subparsers.add_parser("compress", help="Compress a file")
    compress_parser.add_argument("file", help="Path to the file to compress")
    compress_parser.add_argument("-r", "--ratio", type=float, default=0.5, help="Target compression ratio (default: 0.5)")
    compress_parser.add_argument("-o", "--output", help="Output file path (prints to stdout if not specified)")

    # Compress direct text subcommand
    text_parser = subparsers.add_parser("text", help="Compress text directly from stdin or argument")
    text_parser.add_argument("-t", "--text", help="Text to compress")
    text_parser.add_argument("-r", "--ratio", type=float, default=0.5, help="Target compression ratio (default: 0.5)")

    args = parser.parse_args()

    if args.command == "compress":
        try:
            compressed = compress_file(args.file, args.ratio)
            if args.output:
                with open(args.output, 'w', encoding='utf-8') as f:
                    f.write(compressed)
                print(f"Successfully compressed {args.file} and saved to {args.output}")
            else:
                print(compressed)
        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)
            
    elif args.command == "text":
        content = args.text
        if not content:
            # Read from stdin if no text argument provided
            content = sys.stdin.read()
        
        compressed = compress_text(content, args.ratio)
        print(compressed)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
