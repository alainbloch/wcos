with open('/Users/alainbloch/work/wcos/tests/integration/template-syntax.test.js', 'rb') as f:
    content = f.read()

# The file has literal & (1 byte: 0x26). We need to replace with & (5 bytes: 0x26 0x61 0x6d 0x70 0x3b)
old_bytes = b'Links ' + b'&' + b' Resources'
new_bytes = b'Links ' + b'&' + b'amp;' + b' Resources'

content = content.replace(old_bytes, new_bytes)

with open('/Users/alainbloch/work/wcos/tests/integration/template-syntax.test.js', 'wb') as f:
    f.write(content)
print('Done')
print('Old bytes hex:', old_bytes.hex())
print('New bytes hex:', new_bytes.hex())