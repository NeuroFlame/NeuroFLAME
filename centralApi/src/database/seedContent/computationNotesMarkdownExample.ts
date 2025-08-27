export default `
repositoryUrl: "https://www.markdownguide.org/cheat-sheet/"
imageBuildSource: "https://www.markdownguide.org/cheat-sheet/"

# Heading 1

This is a sample Markdown file to demonstrate various features.

## Heading 2

### Heading 3

#### Heading 4

##### Heading 5

###### Heading 6

**Bold Text**

*Italic Text*

~~Strikethrough Text~~

**_Bold and Italic Text_**

> Blockquote

1. Ordered List Item 1
2. Ordered List Item 2
   - Nested Unordered List Item
     - Deeper Nested Item

- Unordered List Item 1
- Unordered List Item 2
  - Nested Unordered List Item
    - Deeper Nested Item

[Link to OpenAI](https://www.openai.com)

![Sample Image](https://via.placeholder.com/150)

\`Inline Code\`

\`\`\`javascript
// Code Block
function helloWorld() {
    console.log("Hello, world!");
}
\`\`\`

| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Row 1    | Data     | More Data|
| Row 2    | Data     | More Data|
| Row 3    | Data     | More Data|

---

Horizontal Rule

- [x] Task 1
- [ ] Task 2
- [ ] Task 3

Here's a footnote[^1].

[^1]: This is the footnote.

Markdown also supports emojis :smile: :+1:.

# YAML Front Matter Content

- **Title**: Sample Computation Notes
- **Author**: John Doe
- **Date**: 2024-08-02
`
