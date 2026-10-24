with open('/Users/alainbloch/work/wcos/tests/integration/template-syntax.test.js', 'r') as f:
    content = f.read()

lines = content.split('\n')
for i, line in enumerate(lines):
    if "expect(response.payload).toContain" in line and "Links" in line:
        # Write literal & - the 5 characters & a m p ;
        lines[i] = "      expect(response.payload).toContain('Links & Resources');"
        print(f"Fixed line {i+1}: {repr(lines[i])}")

with open('/Users/alainbloch/work/wcos/tests/integration/template-syntax.test.js', 'w') as f:
    f.write('\n'.join(lines))
print('Done')