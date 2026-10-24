with open('/Users/alainbloch/work/wcos/tests/integration/template-syntax.test.js', 'rb') as f:
    content = f.read()

# The file has literal & (0x26). Replace with & (5 bytes)
old = b"expect(response.payload).toContain('Links & Resources');"
new = b"expect(response.payload).toContain('Links & Resources');"
content = content.replace(old, new)

with open('/Users/alainbloch/work/wcos/tests/integration/template-syntax.test.js', 'wb') as f:
    f.write(content)
print('Done')
print('Old hex:', old.hex())
print('New hex:', new.hex())