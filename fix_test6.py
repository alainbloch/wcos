with open('/Users/alainbloch/work/wcos/tests/integration/template-syntax.test.js', 'rb') as f:
    content = f.read()

# Replace the literal & (hex 26) with & (5 bytes: 26 61 6d 70 3b)
content = content.replace(
    b"expect(response.payload).toContain('Links & Resources');",
    b"expect(response.payload).toContain('Links & Resources');"
)

with open('/Users/alainbloch/work/wcos/tests/integration/template-syntax.test.js', 'wb') as f:
    f.write(content)
print('Done')