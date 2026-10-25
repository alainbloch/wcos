import { initDatabase } from '../src/models/database.js';
import { updatesService } from '../src/services/updatesService.js';
await initDatabase();
const articles = [
  {
    title: "The Western Circle of Swordfighter",
    date: "2026-05-04",
    category: "news",
    subcategory: "Events",
    pageLink: "hello-world",
    image: "/uploads/DSC_0550.jpg",
    body: "<ul><li>Updated events page and main page events news</li></ul>",
  },
  {
    title: "The Western Circle of Swordfighter 2",
    date: "2026-05-04",
    category: "news",
    subcategory: "Events",
    pageLink: "the-western-circle-of-swordfighter",
    image: "/uploads/DSC_0675.jpg",
    body: "<ul><li>Updated events page and main page events news</li></ul>",
  },
  {
    title: "The Western Circle of Swordfighter 3",
    date: "2026-05-04",
    category: "news",
    subcategory: "Ranking",
    pageLink: "the-western-circle-of-swordfighter-3",
    image: "/uploads/DSC_0724.jpg",
    body: "<ul><li>Updated ranking page and main page news</li></ul>",
  }
];
for (const a of articles) {
  const created = await updatesService.create(a);
  console.log("Created:", created.id, created.title, created.category, created.subcategory, created.pageLink, created.image);
}
