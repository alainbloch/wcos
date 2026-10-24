with open('/Users/alainbloch/work/wcos/tests/integration/template-syntax.test.js', 'rb') as f:
    content = f.read()

# The file has literal & (0x26). We need to replace with & (5 bytes: 0x26 0x61 0x6d 0x70 0x3b)
# Find the position of "Links & Resources" and replace the & with &

# Old pattern: 'Links & Resources' -> bytes: 4c 69 6e 6b 73 20 26 20 52 65 73 6f 75 72 63 65 73
# New pattern: 'Links & Resources' -> bytes: 4c 69 6e 6b 73 20 26 61 6d 70 3b 20 52 65 73 6f 75 72 63 65 73

old_bytes = b'Links & Resources'
new_bytes = b'Links & Resources'

content = content.replace(old_bytes, new_bytes)

with open('/Users/alainbloch/work/wcos/tests/integration/template-syntax.test.js', 'wb') as f:
    f.write(content)
print('Done')
print('Old bytes hex:', old_bytes.hex())
print('New bytes hex:', new_bytes.hex())