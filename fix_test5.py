with open('/Users/alainbloch/work/wcos/tests/integration/template-syntax.test.js', 'rb') as f:
    content = f.read()

# Replace the literal & with & (5 bytes)
content = content.replace(
    b"expect(response.payload).toContain('Links & Resources');",
    b"expect(response.payload).toContain('Links & Resources');"
)

with open('/Users/alainbloch/work/wcos/tests/integration/template-syntax.test.js', 'wb') as f:
    f.write(content)
print('Done')