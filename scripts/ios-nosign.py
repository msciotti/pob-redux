#!/usr/bin/env python3
"""Turn code signing off in the generated Xcode project (unsigned build for sideloading)."""
import re, sys
p = sys.argv[1]
s = open(p).read()
add = 'CODE_SIGNING_ALLOWED = NO;\n\t\t\t\tCODE_SIGNING_REQUIRED = NO;\n\t\t\t\tCODE_SIGN_IDENTITY = "";\n\t\t\t\t'
s, n = re.subn(r'buildSettings = \{\n(\s*)', lambda m: 'buildSettings = {\n' + m.group(1) + add, s)
open(p, 'w').write(s)
print("patched", n, "build configs")
