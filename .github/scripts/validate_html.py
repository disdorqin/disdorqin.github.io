import sys, glob
from html.parser import HTMLParser

class Validator(HTMLParser):
    def error(self, message):
        raise Exception(message)

def main():
    files = glob.glob("**/*.html", recursive=True)
    ok = True
    for f in files:
        try:
            Validator().feed(open(f, encoding="utf-8").read())
        except Exception as e:  # noqa: BLE001
            print("INVALID HTML:", f, "->", e)
            ok = False
    print("Validated %d HTML file(s)." % len(files))
    sys.exit(0 if ok else 1)

if __name__ == "__main__":
    main()
