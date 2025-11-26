const TurndownService = require('turndown');
const turndownService = new TurndownService();

const html = `
<h1>Hello World</h1>
<p>This is a <strong>test</strong> of the <a href="https://example.com">Markdown</a> converter.</p>
<ul>
  <li>Item 1</li>
  <li>Item 2</li>
</ul>
`;

const markdown = turndownService.turndown(html);
console.log("--- Original HTML ---");
console.log(html);
console.log("\n--- Converted Markdown ---");
console.log(markdown);
